import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import Loading from '../ui/Loading';
import Button from '../ui/Button';
import buildSessionAuditHeaders from '../../utils/sessionAuditHeaders';
import { apiJson, ApiResponseError, AuthExpiredError, NotAuthenticatedError } from '../../lib/apiClient';
import {
  hasAdminPortalAccess,
  setAdminAccessSnapshot,
  getAdminAccessSnapshot,
  isAdminAccessSnapshotFresh,
  normalizeAdminAccessPayload,
  type AdminAccessPayload,
} from '../../lib/adminAccess';
import { supabase } from '../../lib/supabaseClient';
import { getCanonicalSession } from '../../lib/canonicalAuth';
import { logAuthRedirect } from '../../utils/logAuthRedirect';

type AuthMode = 'admin' | 'lms' | 'client';

interface RequireAuthProps {
  mode: AuthMode;
  children: ReactNode;
  loginPathOverride?: string;
}

const loginPathByMode: Record<AuthMode, string> = {
  admin: '/admin/login',
  lms: '/login',
  client: '/login',
};

const ADMIN_GATE_TIMEOUT_MS = 15000;

type AdminCapabilityPayload = AdminAccessPayload;

interface AdminCapabilityState {
  status: 'idle' | 'checking' | 'granted' | 'denied' | 'error';
  payload: AdminCapabilityPayload | null;
  reason?: string;
}

export const RequireAuth = ({ mode, children, loginPathOverride }: RequireAuthProps) => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const ROUTE_GUARD_DEBUG = Boolean(env?.DEV || env?.VITE_ENABLE_ROUTE_GUARD_DEBUG === 'true');
  const {
    authInitializing,
    authStatus,
    sessionStatus,
    surfaceAuthStatus,
    orgResolutionStatus,
    membershipStatus,
    hasActiveMembership,
    isAuthenticated,
    memberships,
    activeOrgId,
    setActiveOrganization,
    setRequestedOrgHint,
    loadSession,
    reloadSession,
    user,
    organizationIds,
    logout,
  } = useSecureAuth();
  const location = useLocation();
  const params = useParams<Record<string, string | undefined>>();
  // Once authentication succeeds once, this ref stays true for the lifetime of
  // the component.  After this point the spinner is NEVER shown for route
  // transitions — only the initial cold-start boot needs the loading screen.
  const hasResolvedAuthRef = useRef(false);
  const sessionRequestRef = useRef(false);
  const retryRef = useRef(false);
  const adminCheckAbortRef = useRef<AbortController | null>(null);
  const redirectLogRef = useRef<string | null>(null);
  const currentLoginPath = loginPathOverride ?? loginPathByMode[mode];
  const isOnModeLoginPath = location.pathname === currentLoginPath;
  const hasSession = Boolean(user);
  const sessionLoading = sessionStatus === 'loading';
  const sessionAuthenticated = sessionStatus === 'authenticated';
  const surfaceState = surfaceAuthStatus?.[mode] ?? 'idle';
  const effectiveSurfaceState =
    surfaceState === 'idle' && sessionAuthenticated && orgResolutionStatus === 'ready' ? 'ready' : surfaceState;

  // Resolve admin access snapshot once so we can use it for both the gate-status
  // seed and the membership-wait bypass below.
  const existingSnapshot = mode === 'admin' ? getAdminAccessSnapshot() : null;
  const snapshotGranted =
    existingSnapshot !== null &&
    isAdminAccessSnapshotFresh() &&
    hasAdminPortalAccess(existingSnapshot.payload);
  // If we already confirmed admin access (via a fresh snapshot or isAuthenticated.admin),
  // don't block rendering while memberships are still resolving.
  // The render gate now relies exclusively on hasResolvedAuthRef; this check is
  // retained only for future gate-key logic that may need it.

  // Seed the gate as 'allowed' immediately if we have a fresh snapshot so we never
  // flash a full-screen spinner on internal admin navigation.
  const [adminCapability, setAdminCapability] = useState<AdminCapabilityState>(
    snapshotGranted && existingSnapshot?.payload
      ? { status: 'granted', payload: existingSnapshot.payload }
      : { status: 'idle', payload: null },
  );
  const [adminGateStatus, setAdminGateStatus] = useState<'checking' | 'allowed' | 'unauthorized' | 'error'>(
    mode !== 'admin' ? 'allowed' : snapshotGranted ? 'allowed' : 'checking',
  );
  const adminAccessPayload = adminCapability.payload ?? getAdminAccessSnapshot()?.payload ?? null;
  const adminPortalAllowed = hasAdminPortalAccess(adminAccessPayload) || Boolean(isAuthenticated?.admin);
  const [adminGateError, setAdminGateError] = useState<string | null>(null);
  const adminGateKeyRef = useRef<string | null>(null);
  const adminGateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyIdentityStatus, setCopyIdentityStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [membershipRetrying, setMembershipRetrying] = useState(false);

  const logGuardEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (!ROUTE_GUARD_DEBUG) {
        return;
      }
      const meta = {
        surface: mode,
        path: location.pathname,
        sessionStatus,
        membershipStatus,
        surfaceStatus: effectiveSurfaceState,
        orgResolutionStatus,
        hasSession,
        role: user?.role ?? null,
        ...payload,
      };
      console.info(`[RequireAuth][${mode}] ${event}`, meta);
    },
    [
      ROUTE_GUARD_DEBUG,
      location.pathname,
      mode,
      sessionStatus,
      membershipStatus,
      effectiveSurfaceState,
      orgResolutionStatus,
      hasSession,
      user?.role,
    ],
  );

  const handleMembershipRetry = useCallback(async () => {
    if (membershipRetrying) {
      return;
    }
    setMembershipRetrying(true);
    logGuardEvent('membership_retry', { surface: mode });
    try {
      await reloadSession({ surface: mode, force: true });
    } catch (error) {
      console.warn('[RequireAuth] membership_retry_failed', error);
    } finally {
      setMembershipRetrying(false);
    }
  }, [membershipRetrying, mode, reloadSession, logGuardEvent]);

  useEffect(() => {
    const isDev =
      (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
    if (!isDev) return;
    if (!hasSession) return;
    if (surfaceState === effectiveSurfaceState) return;
    console.debug('[RequireAuth] surface_status_adjust', {
      rawSurfaceStatus: surfaceState,
      effectiveSurfaceStatus: effectiveSurfaceState,
      sessionStatus,
      orgResolutionStatus,
      path: location.pathname,
    });
  }, [surfaceState, effectiveSurfaceState, hasSession, sessionStatus, orgResolutionStatus, location.pathname]);

  const logRedirectOnce = useCallback(
    (target: string, reason: string) => {
      if (!ROUTE_GUARD_DEBUG) {
        return;
      }
      const navKey = `${location.key || 'static'}:${location.pathname}`;
      const signature = `${navKey}|${target}`;
      if (redirectLogRef.current === signature) {
        return;
      }
      redirectLogRef.current = signature;
      console.info(`[RequireAuth][${mode}] redirect`, {
        path: location.pathname,
        target,
        sessionStatus,
        hasSession,
        reason,
      });
    },
    [ROUTE_GUARD_DEBUG, location.key, location.pathname, mode, sessionStatus, hasSession],
  );

  const applyServerActiveOrg = useCallback(
    (orgId: string | null | undefined) => {
      if (!orgId || orgId === activeOrgId) {
        return;
      }
      const hasMembership = memberships.some((membership) => membership.orgId === orgId);
      if (!hasMembership) {
        return;
      }
      logGuardEvent('sync_active_org_from_admin_me', { orgId });
      setActiveOrganization(orgId).catch((error) => {
        console.warn('[RequireAuth] Failed to sync active organization', error);
      });
    },
    [activeOrgId, memberships, setActiveOrganization, logGuardEvent],
  );

  // activeMembership is retained for future guard logic (e.g. feature-flag gating by membership tier).
  const activeMembership = useMemo(() => {
    if (!activeOrgId) {
      return null;
    }
    return memberships.find((membership) => membership.orgId === activeOrgId) ?? null;
  }, [activeOrgId, memberships]);
  void activeMembership;

  const requestedOrgParam = useMemo(() => {
    let param: string | null = null;
    if (location.search) {
      try {
        const query = new URLSearchParams(location.search);
        param = query.get('orgId') ?? query.get('organizationId');
      } catch (error) {
        console.warn('[RequireAuth] Failed to parse orgId from search params', error);
      }
    }
    if (param) {
      return param;
    }
    return params.orgId ?? params.organizationId ?? null;
  }, [location.search, params.orgId, params.organizationId]);

  useEffect(() => {
    setRequestedOrgHint(requestedOrgParam ?? null);
  }, [requestedOrgParam, setRequestedOrgHint]);

  const requestSessionLoad = useCallback(
    (reason: 'initial' | 'retry' | 'surface_transition', options?: { force?: boolean }) => {
      if (!options?.force && (sessionStatus === 'authenticated' || hasSession)) {
        return;
      }
      if (sessionRequestRef.current) {
        return;
      }
      sessionRequestRef.current = true;
      logGuardEvent('load_session', { reason });
      loadSession({ surface: mode })
        .catch((error) => {
          console.warn(`[RequireAuth] Failed to load session for ${mode}`, error);
        })
        .finally(() => {
          sessionRequestRef.current = false;
        });
    },
    [hasSession, loadSession, logGuardEvent, mode, sessionStatus],
  );

  useEffect(() => {
    redirectLogRef.current = null;
  }, [location.pathname, location.key]);

  useEffect(() => {
    return () => {
      adminCheckAbortRef.current?.abort();
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sessionLoading || authInitializing || authStatus === 'booting') {
      if (!sessionLoading) {
        sessionRequestRef.current = false;
      }
      return;
    }

    requestSessionLoad('initial');
  }, [sessionLoading, requestSessionLoad, authInitializing, authStatus]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || hasSession || retryRef.current) {
      return;
    }
    retryRef.current = true;
    requestSessionLoad('retry', { force: true });
  }, [sessionStatus, hasSession, requestSessionLoad]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      return;
    }
    if (!requestedOrgParam || requestedOrgParam === activeOrgId) {
      return;
    }
    if (!memberships.length) {
      return;
    }
    const hasMembership = memberships.some((membership) => membership.orgId === requestedOrgParam);
    if (!hasMembership) {
      return;
    }
    logGuardEvent('apply_requested_org', { requestedOrgId: requestedOrgParam });
    setActiveOrganization(requestedOrgParam).catch((error) => {
      console.warn('[RequireAuth] Failed to switch active organization', error);
    });
  }, [requestedOrgParam, memberships, activeOrgId, setActiveOrganization, logGuardEvent, sessionStatus]);

  useEffect(() => {
    if (authInitializing || sessionStatus !== 'authenticated') {
      return;
    }
    if (activeOrgId) {
      return;
    }
    if (!memberships.length) {
      if (organizationIds.length === 1) {
        setActiveOrganization(organizationIds[0]).catch((error) => {
          console.warn('[RequireAuth] Failed to set fallback organization from organizationIds', error);
        });
      }
      return;
    }

    const fallbackMembership =
      memberships.find((membership) => (membership.status ?? 'active').toLowerCase() === 'active') ?? memberships[0];

    if (fallbackMembership) {
      logGuardEvent('auto_select_active_org', { fallbackOrgId: fallbackMembership.orgId });
      setActiveOrganization(fallbackMembership.orgId).catch((error) => {
        console.warn('[RequireAuth] Failed to set fallback active organization', error);
      });
    }
  }, [authInitializing, sessionStatus, activeOrgId, memberships, organizationIds, setActiveOrganization, logGuardEvent]);

  const beginAdminCapabilityCheck = useCallback(
    (reason: string) => {
      if (mode !== 'admin') {
        return;
      }
      if (sessionStatus !== 'authenticated' || !hasSession) {
        return;
      }

      adminCheckAbortRef.current?.abort();
      const controller = new AbortController();
      adminCheckAbortRef.current = controller;
      setAdminCapability({ status: 'checking', payload: null });
      setAdminGateStatus('checking');
      setAdminGateError(null);
      logGuardEvent('admin_gate_check', { reason });

      apiJson<AdminCapabilityPayload>('/admin/me', {
        signal: controller.signal,
        headers: buildSessionAuditHeaders(),
      })
        .then((rawPayload) => {
          const payload = normalizeAdminAccessPayload(rawPayload);
          if (controller.signal.aborted) {
            return;
          }

          if (!payload) {
            setAdminCapability({ status: 'error', payload: null, reason: 'malformed_payload' });
            logGuardEvent('admin_capability_error', { reason: 'malformed_payload' });
            setAdminGateStatus('error');
            setAdminGateError('malformed_payload');
            return;
          }

          const access = payload.access;
          const user = (payload.user ?? null) as Record<string, unknown> | null;
          const portalAllowed = hasAdminPortalAccess(payload);
          setAdminAccessSnapshot(payload);

          if (!access || !user) {
            setAdminCapability({ status: 'error', payload: payload ?? null, reason: 'malformed_payload' });
            logGuardEvent('admin_capability_error', { reason: 'malformed_payload' });
            setAdminGateStatus('error');
            setAdminGateError('malformed_payload');
            return;
          }

          if (!portalAllowed) {
            setAdminCapability({ status: 'denied', payload, reason: access.reason ?? 'access_denied' });
            logGuardEvent('admin_capability_denied', { reason: access.reason ?? 'access_denied' });
            setAdminGateStatus('unauthorized');
            setAdminGateError(access.reason ?? 'access_denied');
            return;
          }

          setAdminCapability({ status: 'granted', payload });
          logGuardEvent('admin_capability_granted', {
            via: access.via ?? 'unknown',
            adminOrgs: Array.isArray((user as any)?.adminOrgIds) ? (user as any).adminOrgIds.length : 0,
          });
          const derivedActiveOrg =
            typeof (user as any)?.activeOrgId === 'string' ? ((user as any).activeOrgId as string) : null;
          applyServerActiveOrg(derivedActiveOrg);
          setAdminGateStatus('allowed');
          setAdminGateError(null);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          const deriveReasonFromPayload = (payload: AdminCapabilityPayload | null, fallback: string) => {
            if (!payload) return fallback;
            return (
              payload.access?.reason ||
              payload.reason ||
              payload.error ||
              payload.message ||
              (payload.context && typeof payload.context === 'object' && 'reason' in payload.context
                ? String((payload.context as { reason?: string }).reason)
                : null) ||
              fallback
            );
          };

          if (error instanceof ApiResponseError) {
            let parsed: AdminCapabilityPayload | null = null;
            if (error.body) {
              try {
                parsed = normalizeAdminAccessPayload(JSON.parse(error.body) as AdminCapabilityPayload);
              } catch {
                parsed = null;
              }
            }
            if (parsed) {
              setAdminAccessSnapshot(parsed);
            }
            const reasonCode = deriveReasonFromPayload(parsed, `status_${error.status}`);

            if (error.status === 401 || error.status === 403) {
              setAdminCapability({ status: 'denied', payload: parsed, reason: reasonCode });
              logGuardEvent('admin_capability_denied', { reason: reasonCode });
              setAdminGateStatus('unauthorized');
              setAdminGateError(reasonCode);
            } else {
              setAdminCapability({ status: 'error', payload: parsed, reason: reasonCode });
              logGuardEvent('admin_capability_error', { reason: reasonCode });
              setAdminGateStatus('error');
              setAdminGateError(reasonCode);
            }
            return;
          }

          if (error instanceof NotAuthenticatedError || error instanceof AuthExpiredError) {
            setAdminAccessSnapshot(null);
            const reasonCode = 'session_missing';
            setAdminCapability({ status: 'denied', payload: null, reason: reasonCode });
            logGuardEvent('admin_capability_denied', { reason: reasonCode });
            setAdminGateStatus('unauthorized');
            setAdminGateError(reasonCode);
            return;
          }

          const reasonCode =
            error instanceof Error ? `unexpected_${error.name ?? 'error'}` : 'unexpected_admin_capability_failure';
          console.warn('[RequireAuth] Admin capability fetch failed', error);
          setAdminCapability({ status: 'error', payload: null, reason: reasonCode });
          logGuardEvent('admin_capability_error', { reason: reasonCode });
          setAdminGateStatus('error');
          setAdminGateError(reasonCode);
        });
    },
    [mode, sessionStatus, hasSession, logGuardEvent, applyServerActiveOrg],
  );

  const handleAdminGateRetry = useCallback(() => {
    beginAdminCapabilityCheck('manual_retry');
  }, [beginAdminCapabilityCheck]);

  const handleCopyAdminIdentity = useCallback(async () => {
    if (!navigator?.clipboard) {
      setCopyIdentityStatus('error');
      return;
    }
    try {
      const cs = getCanonicalSession();
      const payload = {
        id: cs.userId ?? user?.id ?? 'unknown',
        email: cs.userEmail ?? user?.email ?? 'unknown',
      };
      await navigator.clipboard.writeText(`User ID: ${payload.id}\nEmail: ${payload.email}`);
      setCopyIdentityStatus('copied');
      setTimeout(() => setCopyIdentityStatus('idle'), 3000);
    } catch (error) {
      console.warn('[RequireAuth] Failed to copy admin identity', error);
      setCopyIdentityStatus('error');
      setTimeout(() => setCopyIdentityStatus('idle'), 3000);
    }
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (mode !== 'admin') {
      if (adminGateStatus !== 'allowed') {
        setAdminGateStatus('allowed');
      }
      adminGateKeyRef.current = null;
      return () => {};
    }
    if (sessionStatus !== 'authenticated' || !hasSession) {
      adminGateKeyRef.current = null;
      return () => {};
    }
    // Key on userId:membershipStatus instead of userId:activeOrgId.
    // activeOrgId transitions null → real-value asynchronously and would fire
    // the gate check twice on every admin page load. membershipStatus is stable
    // once resolved ('ready'/'degraded') and only changes on meaningful auth events.
    const key = `${user?.id ?? 'anon'}:${membershipStatus}`;
    if (adminGateKeyRef.current === key) {
      return () => {};
    }
    // Only fire the gate check once membership is actually resolved — not while
    // it is still 'idle' or 'loading', which would trigger a redundant second check.
    if (membershipStatus !== 'ready' && membershipStatus !== 'degraded') {
      return () => {};
    }
    adminGateKeyRef.current = key;
    beginAdminCapabilityCheck('initial');
    return () => {};
  }, [mode, sessionStatus, hasSession, user?.id, membershipStatus, beginAdminCapabilityCheck, adminGateStatus]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }
    if (adminGateStatus === 'unauthorized' || adminGateStatus === 'error') {
      logGuardEvent('admin_gate_blocked_screen', { status: adminGateStatus, error: adminGateError });
    }
  }, [mode, adminGateStatus, adminGateError, logGuardEvent]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }
    if (!hasSession || !sessionAuthenticated) {
      return;
    }
    if (!adminPortalAllowed || adminGateStatus === 'allowed') {
      return;
    }
    setAdminGateStatus('allowed');
    setAdminGateError(null);
    setAdminCapability((current) => {
      if (current.status === 'granted') {
        return current;
      }
      return {
        status: 'granted',
        payload: current.payload ?? getAdminAccessSnapshot()?.payload ?? null,
        reason: current.reason,
      };
    });
  }, [mode, hasSession, sessionAuthenticated, adminPortalAllowed, adminGateStatus]);

  const adminGateStateRef = useRef({
    waiting: false,
    sessionStatus,
    orgResolutionStatus,
    effectiveSurfaceState,
    adminGateStatus,
    hasSession,
  });
  const adminGateTransitionRef = useRef<string | null>(null);

  useEffect(() => {
    adminGateStateRef.current = {
      waiting: mode === 'admin' && hasSession && adminGateStatus === 'checking',
      sessionStatus,
      orgResolutionStatus,
      effectiveSurfaceState,
      adminGateStatus,
      hasSession,
    };
  }, [mode, hasSession, sessionStatus, orgResolutionStatus, effectiveSurfaceState, adminGateStatus]);

  useEffect(() => {
    if (!ROUTE_GUARD_DEBUG || mode !== 'admin') {
      return;
    }
    const snapshotSignature = JSON.stringify({
      adminPortalAllowed: adminPortalAllowed ? true : false,
      adminGateStatus,
      sessionStatus,
      orgResolutionStatus,
      surfaceStatus: effectiveSurfaceState,
    });
    if (adminGateTransitionRef.current === snapshotSignature) {
      return;
    }
    adminGateTransitionRef.current = snapshotSignature;
    console.debug('[RequireAuth][admin] gate_transition', {
      adminPortalAllowed,
      adminGateStatus,
      sessionStatus,
      orgResolutionStatus,
      surfaceStatus: effectiveSurfaceState,
    });
  }, [
    ROUTE_GUARD_DEBUG,
    mode,
    adminPortalAllowed,
    adminGateStatus,
    sessionStatus,
    orgResolutionStatus,
    effectiveSurfaceState,
  ]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }
    if (adminGateTimeoutRef.current) {
      clearTimeout(adminGateTimeoutRef.current);
      adminGateTimeoutRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }

    const waiting = hasSession && adminGateStatus === 'checking' && !adminPortalAllowed;

    adminGateStateRef.current.waiting = waiting;

    if (!waiting) {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
        if (import.meta.env.DEV) {
          console.debug('[RequireAuth][admin] gate_timeout cleared', {
            adminGateStatus,
            sessionStatus,
            orgResolutionStatus,
            surfaceStatus: effectiveSurfaceState,
          });
        }
      }
      return;
    }

    if (adminGateTimeoutRef.current) {
      clearTimeout(adminGateTimeoutRef.current);
    }
    if (import.meta.env.DEV) {
      console.debug('[RequireAuth][admin] gate_timeout started', {
        timeoutMs: ADMIN_GATE_TIMEOUT_MS,
        adminGateStatus,
        sessionStatus,
        orgResolutionStatus,
        surfaceStatus: effectiveSurfaceState,
      });
    }
    adminGateTimeoutRef.current = setTimeout(() => {
      adminGateTimeoutRef.current = null;
      const latest = adminGateStateRef.current;
      if (!latest.waiting) {
        if (import.meta.env.DEV) {
          console.debug('[RequireAuth][admin] gate_timeout ignored (state ready)', latest);
        }
        return;
      }
      adminCheckAbortRef.current?.abort();
      setAdminGateStatus('error');
      setAdminGateError('timeout');
      logGuardEvent('admin_gate_timeout', { timeoutMs: ADMIN_GATE_TIMEOUT_MS });
      if (import.meta.env.DEV) {
        console.debug('[RequireAuth][admin] gate_timeout fired', latest);
      }
    }, ADMIN_GATE_TIMEOUT_MS);

    return () => {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
        if (import.meta.env.DEV) {
          console.debug('[RequireAuth][admin] gate_timeout cleanup');
        }
      }
    };
  }, [
    mode,
    hasSession,
    adminPortalAllowed,
    adminGateStatus,
    sessionStatus,
    orgResolutionStatus,
    effectiveSurfaceState,
    logGuardEvent,
  ]);

  const surfaceCheckPending = sessionAuthenticated && hasSession && effectiveSurfaceState === 'idle';

  useEffect(() => {
    if (!surfaceCheckPending) {
      return;
    }
    requestSessionLoad('surface_transition', { force: true });
  }, [requestSessionLoad, surfaceCheckPending]);

  const statusesReady =
    sessionAuthenticated && orgResolutionStatus === 'ready' && effectiveSurfaceState === 'ready';

  // Once authentication succeeds at least once, we NEVER block rendering for route changes.
  // Subsequent navigations must always render immediately — no spinner flash.
  if (sessionAuthenticated) {
    hasResolvedAuthRef.current = true;
  }

  // ── GATE 1: Bootstrap in progress ────────────────────────────────────────
  // authInitializing is the CANONICAL signal that bootstrap has not yet
  // completed.  While it is true, authStatus/sessionStatus may transiently
  // show 'unauthenticated' before the server session resolves.  We must
  // NEVER redirect during this window.
  //
  // We use authStatus === 'booting' OR authInitializing === true as the
  // composite in-progress signal:
  //   - 'booting'        → runBootstrap has not yet called applySessionPayload
  //   - authInitializing → runBootstrap is executing (covers edge where
  //                        authStatus flips to 'unauthenticated' transiently
  //                        before the server session call resolves)
  const bootstrapInProgress = authInitializing || authStatus === 'booting';

  if (import.meta.env.DEV) {
    console.debug('[REQUIRE_AUTH_EVAL]', {
      pathname: location.pathname,
      authInitializing,
      authStatus,
      sessionStatus,
      membershipStatus,
      activeOrgId,
    });
  }

  // Bootstrap-only gate: block rendering exclusively during the first cold-start
  // load (before we have any confirmed auth state).  Once hasResolvedAuthRef is
  // true we skip every spinner condition — the admin gate and membership checks
  // run in the background and update state without blocking the page render.
  const shouldShowBootstrapSpinner =
    !hasResolvedAuthRef.current && bootstrapInProgress;

  if (shouldShowBootstrapSpinner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
  <Loading size="lg" />
      </div>
    );
  }

  if (
    mode === 'admin' &&
    hasSession &&
    statusesReady &&
    (adminGateStatus === 'unauthorized' || adminGateStatus === 'error')
  ) {
    if (import.meta.env.DEV) {
      console.debug('[REQUIRE_AUTH_UNAUTHORIZED]', {
        pathname: location.pathname,
        authStatus,
        membershipStatus,
        reason: adminGateError ?? adminGateStatus,
      });
    }
    const heading = adminGateStatus === 'unauthorized' ? 'Admin access required' : 'Unable to verify admin access';
    const description =
      adminGateStatus === 'unauthorized'
        ? 'Your current account does not have permission to use the admin portal. You can switch accounts or head back to the login screen.'
        : 'We hit a snag while confirming your admin access. You can retry the check or jump back to the login screen.';

    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-ink/5 bg-white p-10 text-center shadow-soft">
          <h2 className="font-heading text-2xl text-ink">{heading}</h2>
          <p className="mt-3 text-base text-ink/80">
            {description}
            {adminGateError ? (
              <span className="mt-2 block text-sm text-ink/60">Details: {adminGateError}</span>
            ) : null}
            <span className="mt-4 block text-sm text-ink/70">
              Ask an admin to add you to the <code className="rounded bg-cloud px-1 py-0.5 text-ink">admin_users</code> allowlist table.
            </span>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button onClick={handleAdminGateRetry} isFullWidth={true} className="sm:flex-1">
              Try again
            </Button>
            <Button onClick={handleCopyAdminIdentity} variant="secondary" isFullWidth={true} className="sm:flex-1">
              Copy User ID
            </Button>
            <Button asChild variant="ghost" isFullWidth={true} className="sm:flex-1">
              <Link to={loginPathByMode.admin} state={{ from: location, reason: adminGateStatus }}>
                Go to admin login
              </Link>
            </Button>
          </div>
          {copyIdentityStatus === 'copied' ? (
            <p className="mt-3 text-xs text-emerald-600">Admin identity copied.</p>
          ) : null}
          {copyIdentityStatus === 'error' ? (
            <p className="mt-3 text-xs text-rose-600">Unable to copy user info. Please try again.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!hasSession) {
    // Do not show a spinner here — the bootstrap spinner at the top of this
    // function already handles all pre-auth loading states.
    //
    // CRITICAL: do NOT redirect while bootstrap is still in progress.
    // authStatus can transiently be 'unauthenticated' before /auth/session
    // resolves, which would produce a false redirect.  Only redirect after
    // authInitializing === false AND authStatus is definitively settled.
    if (bootstrapInProgress) {
      // Bootstrap still running — render nothing and wait for the real state.
      return null;
    }
    if (sessionStatus === 'loading') {
      return null;
    }
    // Bootstrap is complete.  If auth is not definitively unauthenticated,
    // something is still resolving (e.g. authStatus='error') — don't redirect.
    if (authStatus !== 'unauthenticated') {
      return null;
    }
    const targetPath = currentLoginPath;
    if (isOnModeLoginPath) {
      logGuardEvent('bypass_login_gate', { reason: 'missing_session_on_login_path', target: targetPath });
      return null;
    }
    if (location.pathname !== targetPath) {
      logRedirectOnce(targetPath, 'missing_session');
      logGuardEvent('redirect_login', { target: targetPath, reason: 'missing_session' });
      logAuthRedirect('RequireAuth.redirect_missing_session', {
        path: location.pathname,
        target: targetPath,
        authStatus,
        authInitializing,
        sessionStatus,
        orgResolutionStatus,
        surfaceStatus: effectiveSurfaceState,
      });
      if (import.meta.env.DEV) {
        console.debug('[REQUIRE_AUTH_REDIRECT]', {
          pathname: location.pathname,
          authInitializing,
          authStatus,
          membershipStatus,
          target: targetPath,
        });
      }
      return <Navigate to={targetPath} state={{ from: location, reason: 'missing_session' }} replace />;
    }
    logGuardEvent('render_login_route', { reason: 'missing_session', target: targetPath });
    return null;
  }

  if (mode === 'lms' && membershipStatus === 'error') {
    logGuardEvent('render_membership_error', {
      membershipStatus,
      membershipCount: memberships.length,
      activeOrgId,
    });
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-ink/5 bg-white p-10 text-center shadow-soft">
          <h2 className="font-heading text-2xl text-ink">Trouble loading your account</h2>
          <p className="mt-3 text-base text-ink/80">We couldn't confirm your organization membership. Please retry the check or sign out and back in.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button onClick={handleMembershipRetry} isFullWidth={true} className="sm:flex-1" disabled={membershipRetrying}>
              {membershipRetrying ? 'Retrying...' : 'Retry now'}
            </Button>
            <Button onClick={() => logout('lms')} variant="ghost" isFullWidth={true} className="sm:flex-1">
              Sign out
            </Button>
          </div>
          <p className="mt-4 text-xs text-ink/60">If this keeps happening, please contact support.</p>
        </div>
      </div>
    );
  }

  if (mode === 'admin') {
    if (ROUTE_GUARD_DEBUG && typeof window !== 'undefined') {
      console.debug('[RequireAuth][admin] gate_state', {
        sessionStatus,
        orgResolutionStatus,
        surfaceStatus: effectiveSurfaceState,
        hasSession,
        role: user?.role ?? null,
        adminPortalAllowed,
      });
    }
  } else {
    const clientSurfaceAllowed =
      mode === 'client'
        ? Boolean(isAuthenticated.client || isAuthenticated.lms)
        : Boolean(isAuthenticated.lms || isAuthenticated.client);
    const clientTarget = loginPathByMode[mode];
    const surfaceWaitingForAuth = sessionAuthenticated && hasSession && surfaceState !== 'ready' && surfaceState !== 'error';

    if (!clientSurfaceAllowed) {
      if (surfaceWaitingForAuth) {
        return (
          <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
            <Loading size="lg" />
          </div>
        );
      }

      const surfaceReady = surfaceState === 'ready';
      // If the current session is an admin-only account (no client surface),
      // send the user to the admin portal instead of leaving the client page
      // blank. Only do this after the current surface has been resolved.
      if (isAuthenticated?.admin && surfaceReady) {
        if (location.pathname !== '/admin') {
          return <Navigate to="/admin" replace />;
        }
      }
      if (!isOnModeLoginPath) {
        // Guard: same bootstrap-in-progress check — do not redirect while
        // auth is still initializing.  isAuthenticated.lms is false transiently
        // during bootstrap before the session payload is applied.
        if (bootstrapInProgress) {
          return null;
        }
        if (sessionStatus === 'loading') {
          return null;
        }
        // Only redirect once auth is definitively settled as unauthenticated.
        if (authStatus !== 'unauthenticated') {
          return null;
        }
        const reason = mode === 'client' ? 'missing_client_session' : 'missing_lms_session';
        logRedirectOnce(clientTarget, reason);
        logGuardEvent('redirect_login', { reason });
        if (import.meta.env.DEV) {
          console.debug('[REQUIRE_AUTH_REDIRECT]', {
            pathname: location.pathname,
            authInitializing,
            authStatus,
            membershipStatus,
            target: clientTarget,
          });
        }
        return <Navigate to={clientTarget} state={{ from: location, reason }} replace />;
      }
      logGuardEvent('render_login_route', {
        reason: mode === 'client' ? 'missing_client_session' : 'missing_lms_session',
        target: clientTarget,
      });
      return null;
    }
    const hasMembershipContext = memberships.length > 0 || Boolean(activeOrgId);
    const shouldShowMembershipWarning =
      hasSession &&
      sessionAuthenticated &&
      (membershipStatus === 'ready' || membershipStatus === 'degraded') &&
      !hasActiveMembership &&
      hasMembershipContext;

    if (shouldShowMembershipWarning) {
      logGuardEvent('membership_warning', {
        reason: 'no_active_membership',
        activeOrgId,
        membershipCount: memberships.length,
        membershipStatus,
      });
    }
  }

  if (mode === 'admin' && adminPortalAllowed && isOnModeLoginPath) {
    logAuthRedirect('RequireAuth.admin_on_login', {
      path: location.pathname,
      target: '/admin',
    });
    return <Navigate to="/admin" replace />;
  }

  logGuardEvent('allow', { path: location.pathname, adminCapabilityStatus: adminCapability.status });
  if (import.meta.env.DEV) {
    console.debug('[REQUIRE_AUTH_ALLOW]', {
      pathname: location.pathname,
      authStatus,
      membershipStatus,
    });
  }
  if (import.meta.env.DEV) {
    console.debug('[REQUIRE AUTH RENDER]', location.pathname, {
      mode,
      hasSession,
      sessionStatus,
      authStatus,
      adminGateStatus,
      hasResolvedAuth: hasResolvedAuthRef.current,
    });
  }
  const membershipBanner =
    membershipStatus === 'degraded' ? (
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="font-semibold">Membership sync delayed.</strong>{' '}
          We're having trouble confirming your organization membership. Select your organization again or retry the check
          below—your access stays active, but some assignments may be limited until we reconnect.
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMembershipRetry}
          disabled={membershipRetrying}
          className="self-start rounded-full border border-amber-300 bg-white px-4 py-1 text-amber-900 hover:bg-amber-100 sm:self-auto"
        >
          {membershipRetrying ? 'Retrying...' : 'Retry now'}
        </Button>
      </div>
    ) : null;

  return (
    <>
      {membershipBanner}
      {mode === 'lms' &&
        sessionAuthenticated &&
        (membershipStatus === 'ready' || membershipStatus === 'degraded') &&
        !hasActiveMembership &&
        (memberships.length > 0 || activeOrgId) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong className="font-semibold">Access limited.</strong> We couldn't confirm your active organization right
            now, but your session is still valid. You can continue browsing limited content or retry the membership check.
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMembershipRetry}
                disabled={membershipRetrying}
                className="rounded-full border border-amber-300 bg-white px-4 py-1 text-amber-900 hover:bg-amber-100"
              >
                {membershipRetrying ? 'Retrying...' : 'Retry membership check'}
              </Button>
            </div>
          </div>
        )}
      {children}
    </>
  );
};

export default RequireAuth;
