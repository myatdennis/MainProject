import { useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import Loading from '../ui/Loading';

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

export const RequireAuth = ({ mode, children, loginPathOverride }: RequireAuthProps) => {
  const { authInitialized, session } = useSecureAuth();
  const location = useLocation();
  const targetPath = loginPathOverride ?? loginPathByMode[mode];
  const hasSession = Boolean(session);
  const hasToken = Boolean(session?.access_token);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : location.pathname;
  const authCheckLogRef = useRef<string | null>(null);

  const authCheckSignature = `${pathname}:${hasSession}:${hasToken}:${authInitialized}`;
  if (authCheckLogRef.current !== authCheckSignature) {
    authCheckLogRef.current = authCheckSignature;
    console.log('[AUTH CHECK]', {
      hasSession,
      hasToken,
      pathname,
    });
  }

  if (!authInitialized) {
    return <Loading />;
  }

  if (!hasToken) {
    if (location.pathname === targetPath) {
      return null;
    }
    if (session?.access_token) {
      console.error('[AUTH VIOLATION] Redirect attempted while session exists', {
        pathname,
      });
      return null;
    }
    console.log('[AUTH REDIRECT]', {
      target: targetPath,
      reason: 'missing_session',
      pathname,
    });
    return <Navigate to={targetPath} replace state={{ from: location, reason: 'missing_session' }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
