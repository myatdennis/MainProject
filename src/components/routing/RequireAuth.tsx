import { ReactNode } from 'react';
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
  const { authInitializing, isAuthenticated } = useAuth();
  const location = useLocation();

  if (authInitializing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const allowed =
    mode === 'admin' ? isAuthenticated.admin : isAuthenticated.lms;
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
