import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';
import apiRequest, { ApiError } from '../../utils/apiClient';
import buildSessionAuditHeaders from '../../utils/sessionAuditHeaders';

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
  } = useAuth();
  const location = useLocation();
  const sessionRequestRef = useRef(false);
  const retryRef = useRef(false);
  const adminCheckAbortRef = useRef<AbortController | null>(null);
  const redirectLogRef = useRef<string | null>(null);
  const currentLoginPath = loginPathByMode[mode];
  const isOnModeLoginPath = location.pathname === currentLoginPath;
  const hasSession = Boolean(user);
  const surfaceState = surfaceAuthStatus?.[mode] ?? 'idle';
  const waitingForSurface = hasSession && surfaceState === 'checking';
  const waitingForOrgContext =
    mode === 'admin' && hasSession && memberships.length > 0 && orgResolutionStatus !== 'ready';
  const [adminCapability, setAdminCapability] = useState<AdminCapabilityState>({ status: 'idle', payload: null });
  const [adminGateStatus, setAdminGateStatus] = useState<'checking' | 'allowed' | 'unauthorized' | 'error'>(
    mode === 'admin' ? 'checking' : 'allowed',
  );
  const [adminGateError, setAdminGateError] = useState<string | null>(null);
  const adminGateKeyRef = useRef<string | null>(null);
  const adminGateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logGuardEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (!ROUTE_GUARD_DEBUG) {
        return;
      }
      const meta = {
        surface: mode,
        path: location.pathname,
        sessionStatus,
        surfaceStatus: surfaceState,
        orgResolutionStatus,
        hasSession,
        role: user?.role ?? null,
        ...payload,
      };
      console.info(`[RequireAuth][${mode}] ${event}`, meta);
    },
    [ROUTE_GUARD_DEBUG, location.pathname, mode, sessionStatus, surfaceState, orgResolutionStatus, hasSession, user?.role],
  );

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

      apiRequest<AdminCapabilityPayload>('/api/admin/me', {
        signal: controller.signal,
        headers: buildSessionAuditHeaders(),
      })
        .then((payload) => {
          if (controller.signal.aborted) {
            return;
          }

          const access = payload?.access;
          const user = payload?.user;

          if (!access || !user) {
            setAdminCapability({ status: 'error', payload: payload ?? null, reason: 'malformed_payload' });
            logGuardEvent('admin_capability_error', { reason: 'malformed_payload' });
            setAdminGateStatus('error');
            setAdminGateError('malformed_payload');
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

          if (error instanceof ApiError) {
            const body = (error.body ?? null) as AdminCapabilityPayload | { message?: string } | null;
            const reasonCode =
              body?.access?.reason ||
              (typeof body?.message === 'string' ? body.message : null) ||
              (body && typeof (body as { error?: string }).error === 'string' ? (body as { error?: string }).error : null) ||
              `status_${error.status}`;

            if (error.status === 401 || error.status === 403) {
              setAdminCapability({ status: 'denied', payload: body ?? null, reason: reasonCode });
              logGuardEvent('admin_capability_denied', { reason: reasonCode });
              setAdminGateStatus('unauthorized');
              setAdminGateError(reasonCode);
            } else {
              setAdminCapability({ status: 'error', payload: body ?? null, reason: reasonCode });
              logGuardEvent('admin_capability_error', { reason: reasonCode });
              setAdminGateStatus('error');
              setAdminGateError(reasonCode);
            }
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

  useEffect(() => {
    if (mode !== 'admin') {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
      }
      return;
    }
    if (adminGateStatus !== 'checking') {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
      }
      return;
    }
    if (adminGateTimeoutRef.current) {
      clearTimeout(adminGateTimeoutRef.current);
    }
    adminGateTimeoutRef.current = setTimeout(() => {
      adminCheckAbortRef.current?.abort();
      adminGateTimeoutRef.current = null;
      setAdminGateStatus('error');
      setAdminGateError('timeout');
      logGuardEvent('admin_gate_timeout', { timeoutMs: ADMIN_GATE_TIMEOUT_MS });
    }, ADMIN_GATE_TIMEOUT_MS);

    return () => {
      if (adminGateTimeoutRef.current) {
        clearTimeout(adminGateTimeoutRef.current);
        adminGateTimeoutRef.current = null;
      }
    };
  }, [mode, adminGateStatus, logGuardEvent]);

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

  const waitingForAdminGate = mode === 'admin' && hasSession && adminGateStatus === 'checking';

  const shouldShowSpinner =
    sessionStatus !== 'ready' || (hasSession && (waitingForSurface || waitingForOrgContext || waitingForAdminGate));

  if (shouldShowSpinner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (mode === 'admin' && hasSession && (adminGateStatus === 'unauthorized' || adminGateStatus === 'error')) {
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
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={handleAdminGateRetry} isFullWidth={true}>
              Try again
            </Button>
            <Button asChild variant="ghost" isFullWidth={true}>
              <Link to={loginPathByMode.admin} state={{ from: location, reason: adminGateStatus }}>
                Go to admin login
              </Link>
            </Button>
          </div>
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
      return <Navigate to={targetPath} state={{ from: location, reason: 'missing_session' }} replace />;
    }
    logGuardEvent('render_login_route', { reason: 'missing_session', target: targetPath });
    return null;
  }

  if (mode === 'admin') {
    if (!isAuthenticated.admin) {
      if (isOnModeLoginPath) {
        logGuardEvent('allow_admin_login_route', { reason: 'already_on_login_route' });
        return null;
      }
      logRedirectOnce('/admin/login', 'missing_admin_session_with_user');
      logGuardEvent('redirect_admin_login_unauthenticated', { reason: 'missing_admin_session_with_user' });
      return (
        <Navigate
          to="/admin/login"
          state={{ from: location, reason: 'non_admin_user' }}
          replace
        />
      );
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

  logGuardEvent('allow', { path: location.pathname, adminCapabilityStatus: adminCapability.status });
  return <>{children}</>;
};

export default RequireAuth;
