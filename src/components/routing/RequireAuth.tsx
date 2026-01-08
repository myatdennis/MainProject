import { ReactNode, useEffect, useMemo, useRef } from 'react';
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
  const {
    authInitializing,
    isAuthenticated,
    memberships,
    activeOrgId,
    setActiveOrganization,
    reloadSession,
  } = useAuth();
  const location = useLocation();
  const surfaceReloadRef = useRef<AuthMode | null>(null);

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

  useEffect(() => {
    if (authInitializing) {
      return;
    }
    if (surfaceReloadRef.current === mode) {
      return;
    }
    surfaceReloadRef.current = mode;
    reloadSession({ surface: mode }).catch((error) => {
      console.warn(`[RequireAuth] Failed to reload session for ${mode} surface`, error);
      surfaceReloadRef.current = null;
    });
  }, [authInitializing, mode, reloadSession]);

  useEffect(() => {
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
    setActiveOrganization(requestedOrgId).catch((error) => {
      console.warn('[RequireAuth] Failed to switch active organization', error);
    });
  }, [requestedOrgId, memberships, activeOrgId, setActiveOrganization]);

  if (authInitializing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const allowed = mode === 'admin' ? isAuthenticated.admin : isAuthenticated.lms;
  const anyAuth = isAuthenticated.admin || isAuthenticated.lms;

  if (!allowed) {
    if (anyAuth) {
      return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }

    return (
      <Navigate
        to={loginPathByMode[mode]}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
