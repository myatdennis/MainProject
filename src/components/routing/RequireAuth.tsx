import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

type AuthMode = 'admin' | 'lms';

interface RequireAuthProps {
  mode: AuthMode;
  children: ReactNode;
}

const loginPathByMode: Record<AuthMode, string> = {
  admin: '/admin/login',
  lms: '/lms/login',
};

export const RequireAuth = ({ mode, children }: RequireAuthProps) => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const ROUTE_GUARD_DEBUG = Boolean(env?.DEV || env?.VITE_ENABLE_ROUTE_GUARD_DEBUG === 'true');
  const {
    authInitializing,
    sessionStatus,
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
  const hasSession = Boolean(user);

  const logGuardEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (!ROUTE_GUARD_DEBUG) {
        return;
      }
      const meta = {
        surface: mode,
        path: location.pathname,
        sessionStatus,
        hasSession,
        role: user?.role ?? null,
        ...payload,
      };
      console.info(`[RequireAuth][${mode}] ${event}`, meta);
    },
    [ROUTE_GUARD_DEBUG, location.pathname, mode, sessionStatus, hasSession, user?.role],
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

  const normalizeRole = (role?: string | null) => (role ? role.trim().toLowerCase() : '');
  const ADMIN_ROLES = useMemo(() => new Set(['owner', 'admin', 'manager', 'editor', 'platform_admin']), []);
  const MEMBER_ROLES = useMemo(() => new Set(['member', 'viewer', 'learner', 'instructor', 'coach', 'participant']), []);

  const hasActiveMembership = useMemo(() => {
    return memberships.some((membership) => (membership.status ?? 'active').toLowerCase() === 'active');
  }, [memberships]);

  const adminRoleEligible = useMemo(() => {
    if (!user) {
      return false;
    }
    if (user.isPlatformAdmin) {
      return true;
    }
    if (ADMIN_ROLES.has(normalizeRole(user.role))) {
      return true;
    }
    if (
      activeMembership &&
      (activeMembership.status ?? 'active').toLowerCase() === 'active' &&
      ADMIN_ROLES.has(normalizeRole(activeMembership.role))
    ) {
      return true;
    }
    return memberships.some(
      (membership) =>
        (membership.status ?? 'active').toLowerCase() === 'active' && ADMIN_ROLES.has(normalizeRole(membership.role)),
    );
  }, [ADMIN_ROLES, activeMembership, memberships, user]);

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

  if (sessionStatus !== 'ready') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasSession) {
    const targetPath = loginPathByMode[mode];
    logGuardEvent('redirect_login', { target: targetPath, reason: 'missing_session' });
    return <Navigate to={targetPath} state={{ from: location, reason: 'missing_session' }} replace />;
  }

  if (mode === 'admin') {
    if (!isAuthenticated.admin) {
      logGuardEvent('redirect_non_admin_home', { reason: 'missing_admin_session_with_user' });
      return <Navigate to="/lms/dashboard" state={{ from: location, reason: 'non_admin_user' }} replace />;
    }
    if (!adminRoleEligible) {
      logGuardEvent('redirect_unauthorized', {
        reason: 'insufficient_admin_role',
        activeOrgId,
        requestedOrgId,
        memberships: memberships.length,
      });
      return <Navigate to="/lms/dashboard" state={{ from: location, reason: 'insufficient_admin_role' }} replace />;
    }
  } else {
    if (!isAuthenticated.lms) {
      logGuardEvent('redirect_login', { reason: 'missing_lms_session' });
      return <Navigate to={loginPathByMode.lms} state={{ from: location, reason: 'missing_lms_session' }} replace />;
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

  logGuardEvent('allow', { path: location.pathname });
  return <>{children}</>;
};

export default RequireAuth;
