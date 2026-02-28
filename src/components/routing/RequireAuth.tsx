import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';
import buildSessionAuditHeaders from '../../utils/sessionAuditHeaders';
import { apiJson, ApiResponseError, AuthExpiredError, NotAuthenticatedError } from '../../lib/apiClient';
import { hasAdminPortalAccess, setAdminAccessSnapshot, getAdminAccessSnapshot } from '../../lib/adminAccess';
import { supabase } from '../../lib/supabaseClient';
import { logAuthRedirect } from '../../utils/logAuthRedirect';

type AuthMode = 'admin' | 'lms';

interface RequireAuthProps {
  mode: AuthMode;
  children: ReactNode;
}

const loginPathByMode: Record<AuthMode, string> = {
  admin: '/admin/login',
  lms: '/lms/login',
};

const ADMIN_GATE_TIMEOUT_MS = 15000;

interface AdminCapabilityPayload {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    isPlatformAdmin?: boolean;
    activeOrgId?: string | null;
    adminOrgIds?: string[];
  };
  access?: {
    allowed?: boolean;
    via?: string;
    reason?: string | null;
    adminPortal?: boolean;
    admin?: boolean;
    capabilities?: Record<string, boolean | undefined>;
  };
  context?: Record<string, unknown> | null;
  error?: string;
  message?: string;
}

interface AdminCapabilityState {
  status: 'idle' | 'checking' | 'granted' | 'denied' | 'error';
  payload: AdminCapabilityPayload | null;
  reason?: string;
}

export const RequireAuth = ({ mode, children }: RequireAuthProps) => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const ROUTE_GUARD_DEBUG = Boolean(env?.DEV || env?.VITE_ENABLE_ROUTE_GUARD_DEBUG === 'true');
  const {
    authInitializing,
    sessionStatus,
    surfaceAuthStatus,
    orgResolutionStatus,
    isAuthenticated,
    memberships,
    activeOrgId,
    setActiveOrganization,
    loadSession,
    user,
    organizationIds,
    logout,
  } = useSecureAuth();
  const location = useLocation();
  const sessionRequestRef = useRef(false);
  const retryRef = useRef(false);
  const adminCheckAbortRef = useRef<AbortController | null>(null);
  const redirectLogRef = useRef<string | null>(null);
  const currentLoginPath = loginPathByMode[mode];
  const isOnModeLoginPath = location.pathname === currentLoginPath;
  const hasSession = Boolean(user);
  const surfaceState = surfaceAuthStatus?.[mode] ?? 'idle';
  const effectiveSurfaceState =
    surfaceState === 'idle' && sessionStatus === 'ready' && orgResolutionStatus === 'ready' ? 'ready' : surfaceState;
  const waitingForSurface = hasSession && effectiveSurfaceState === 'checking';
  const waitingForOrgContext =
    mode === 'admin' && hasSession && memberships.length > 0 && !activeOrgId && orgResolutionStatus !== 'ready';
  const [adminCapability, setAdminCapability] = useState<AdminCapabilityState>({ status: 'idle', payload: null });
  const [adminGateStatus, setAdminGateStatus] = useState<'checking' | 'allowed' | 'unauthorized' | 'error'>(
    mode === 'admin' ? 'checking' : 'allowed',
  );
  const adminAccessPayload = adminCapability.payload ?? getAdminAccessSnapshot()?.payload ?? null;
  const adminPortalAllowed = hasAdminPortalAccess(adminAccessPayload) || Boolean(isAuthenticated?.admin);
  const [adminGateError, setAdminGateError] = useState<string | null>(null);
  const adminGateKeyRef = useRef<string | null>(null);
  const adminGateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyIdentityStatus, setCopyIdentityStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const logGuardEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (!ROUTE_GUARD_DEBUG) {
        return;
      }
      const meta = {
        surface: mode,
        path: location.pathname,
        sessionStatus,
        surfaceStatus: effectiveSurfaceState,
        orgResolutionStatus,
        hasSession,
        role: user?.role ?? null,
        ...payload,
      };
      console.info(`[RequireAuth][${mode}] ${event}`, meta);
    },
    [ROUTE_GUARD_DEBUG, location.pathname, mode, sessionStatus, effectiveSurfaceState, orgResolutionStatus, hasSession, user?.role],
  );

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

  const activeMembership = useMemo(() => {
    if (!activeOrgId) {
      return null;
    }
    return memberships.find((membership) => membership.orgId === activeOrgId) ?? null;
  }, [activeOrgId, memberships]);

  const requestedOrgId = useMemo(() => {
    if (!location.search) {
      return null;
    }
    try {
      const params = new URLSearchParams(location.search);
      return params.get('orgId') ?? params.get('organizationId');
    } catch (error) {
      console.warn('[RequireAuth] Failed to parse orgId from search params', error);
      return null;
    }
  }, [location.search]);

  const requestSessionLoad = useCallback(
    (reason: 'initial' | 'retry', options?: { force?: boolean }) => {
      if (!options?.force && sessionStatus === 'ready') {
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
    [loadSession, logGuardEvent, mode, sessionStatus],
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
    if (sessionStatus !== 'ready') {
      requestSessionLoad('initial');
    } else {
      sessionRequestRef.current = false;
    }
  }, [sessionStatus, requestSessionLoad]);

  useEffect(() => {
    if (sessionStatus !== 'ready' || hasSession || retryRef.current) {
      return;
    }
    retryRef.current = true;
    requestSessionLoad('retry', { force: true });
  }, [sessionStatus, hasSession, requestSessionLoad]);

  useEffect(() => {
    if (sessionStatus !== 'ready') {
      return;
    }
    if (!requestedOrgId || requestedOrgId === activeOrgId) {
      return;
    }
    if (!memberships.length) {
      return;
    }
    const hasMembership = memberships.some((membership) => membership.orgId === requestedOrgId);
    if (!hasMembership) {
      return;
    }
    logGuardEvent('apply_requested_org', { requestedOrgId });
    setActiveOrganization(requestedOrgId).catch((error) => {
      console.warn('[RequireAuth] Failed to switch active organization', error);
    });
  }, [requestedOrgId, memberships, activeOrgId, setActiveOrganization, logGuardEvent, sessionStatus]);

  useEffect(() => {
    if (authInitializing || sessionStatus !== 'ready') {
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
      if (sessionStatus !== 'ready' || !hasSession) {
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
        .then((payload) => {
          if (controller.signal.aborted) {
            return;
          }

          const access = payload?.access;
          const user = payload?.user;
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
            adminOrgs: user?.adminOrgIds?.length ?? 0,
          });
          applyServerActiveOrg(user?.activeOrgId ?? null);
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
                parsed = JSON.parse(error.body) as AdminCapabilityPayload;
              } catch {
                parsed = null;
              }
            }
            if (parsed) {
              setAdminAccessSnapshot(parsed);
            }
            const reasonCode = deriveReasonFromPayload(parsed, `status_${error.status}`);

            if (error.status === 401 || error.status === 403) {
              if (error.status === 401) {
                void logout('admin');
              }
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
      const { data } = await supabase.auth.getSession();
      const supabaseUser = data?.session?.user;
      const payload = {
        id: supabaseUser?.id ?? user?.id ?? 'unknown',
        email: supabaseUser?.email ?? user?.email ?? 'unknown',
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
    if (sessionStatus !== 'ready' || !hasSession) {
      adminGateKeyRef.current = null;
      return () => {};
    }
    const key = `${user?.id ?? 'anon'}:${activeOrgId ?? 'none'}`;
    if (adminGateKeyRef.current === key) {
      return () => {};
    }
    adminGateKeyRef.current = key;
    beginAdminCapabilityCheck('initial');
    return () => {};
  }, [mode, sessionStatus, hasSession, user?.id, activeOrgId, beginAdminCapabilityCheck, adminGateStatus]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }
    if (adminGateStatus === 'unauthorized' || adminGateStatus === 'error') {
      logGuardEvent('admin_gate_blocked_screen', { status: adminGateStatus, error: adminGateError });
    }
  }, [mode, adminGateStatus, adminGateError, logGuardEvent]);

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
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
      }
      return;
    }

    const waiting = hasSession && adminGateStatus === 'checking';

    adminGateStateRef.current.waiting = waiting;

    if (!waiting) {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
        if ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) || process.env?.NODE_ENV !== 'production') {
          console.log('[RequireAuth][admin] gate_timeout cleared', {
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
    if ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) || process.env?.NODE_ENV !== 'production') {
      console.log('[RequireAuth][admin] gate_timeout started', {
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
        if ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) || process.env?.NODE_ENV !== 'production') {
          console.log('[RequireAuth][admin] gate_timeout ignored (state ready)', latest);
        }
        return;
      }
      adminCheckAbortRef.current?.abort();
      setAdminGateStatus('error');
      setAdminGateError('timeout');
      logGuardEvent('admin_gate_timeout', { timeoutMs: ADMIN_GATE_TIMEOUT_MS });
      if ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) || process.env?.NODE_ENV !== 'production') {
        console.log('[RequireAuth][admin] gate_timeout fired', latest);
      }
    }, ADMIN_GATE_TIMEOUT_MS);

    return () => {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
        if ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) || process.env?.NODE_ENV !== 'production') {
          console.log('[RequireAuth][admin] gate_timeout cleanup');
        }
      }
    };
  }, [
    mode,
    hasSession,
    adminGateStatus,
    sessionStatus,
    orgResolutionStatus,
    effectiveSurfaceState,
    logGuardEvent,
  ]);

  const normalizeRole = (role?: string | null) => (role ? role.trim().toLowerCase() : '');
  const ADMIN_ROLES = useMemo(() => new Set(['owner', 'admin', 'manager', 'editor', 'platform_admin']), []);
  const MEMBER_ROLES = useMemo(() => new Set(['member', 'viewer', 'learner', 'instructor', 'coach', 'participant']), []);

  const hasActiveMembership = useMemo(() => {
    return memberships.some((membership) => (membership.status ?? 'active').toLowerCase() === 'active');
  }, [memberships]);

  const lmsRoleEligible = useMemo(() => {
    if (!user) {
      return false;
    }
    if (user.isPlatformAdmin || ADMIN_ROLES.has(normalizeRole(user.role))) {
      return true;
    }
    if (
      activeMembership &&
      (activeMembership.status ?? 'active').toLowerCase() === 'active' &&
      MEMBER_ROLES.has(normalizeRole(activeMembership.role))
    ) {
      return true;
    }
    if (hasActiveMembership) {
      return true;
    }
    return MEMBER_ROLES.has(normalizeRole(user.role));
  }, [ADMIN_ROLES, MEMBER_ROLES, activeMembership, hasActiveMembership, user]);

  const statusesReady = sessionStatus === 'ready' && orgResolutionStatus === 'ready' && effectiveSurfaceState === 'ready';
  const waitingForAdminGate = mode === 'admin' && hasSession && adminGateStatus === 'checking';

  const shouldShowSpinner =
    !statusesReady || (hasSession && (waitingForSurface || waitingForOrgContext)) || waitingForAdminGate;

  if (shouldShowSpinner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (
    mode === 'admin' &&
    hasSession &&
    statusesReady &&
    (adminGateStatus === 'unauthorized' || adminGateStatus === 'error')
  ) {
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
        sessionStatus,
        orgResolutionStatus,
        surfaceStatus: effectiveSurfaceState,
      });
      return <Navigate to={targetPath} state={{ from: location, reason: 'missing_session' }} replace />;
    }
    logGuardEvent('render_login_route', { reason: 'missing_session', target: targetPath });
    return null;
  }

  if (mode === 'admin') {
    if (typeof window !== 'undefined') {
      console.log('[RequireAuth][admin] gate_state', {
        sessionStatus,
        orgResolutionStatus,
        surfaceStatus: effectiveSurfaceState,
        hasSession,
        role: user?.role ?? null,
        adminPortalAllowed,
      });
    }
  } else {
    if (!isAuthenticated.lms) {
      const lmsTarget = loginPathByMode.lms;
      if (!isOnModeLoginPath) {
        logRedirectOnce(lmsTarget, 'missing_lms_session');
        logGuardEvent('redirect_login', { reason: 'missing_lms_session' });
        return <Navigate to={lmsTarget} state={{ from: location, reason: 'missing_lms_session' }} replace />;
      }
      logGuardEvent('render_login_route', { reason: 'missing_lms_session', target: lmsTarget });
      return null;
    }
    if (!lmsRoleEligible) {
      logGuardEvent('redirect_unauthorized', {
        reason: 'no_active_membership',
        activeOrgId,
        requestedOrgId,
        memberships: memberships.length,
      });
      return (
        <Navigate
          to="/unauthorized"
          state={{ from: location, reason: 'no_active_membership', surface: 'lms', activeOrgId, requestedOrgId }}
          replace
        />
      );
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
  return <>{children}</>;
};

export default RequireAuth;
