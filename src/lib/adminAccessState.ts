import { useMemo, useSyncExternalStore } from 'react';
import { useSecureAuth } from '../context/SecureAuthContext';
import {
  getAdminAccessSnapshot,
  hasAdminPortalAccess,
  subscribeAdminAccessSnapshot,
} from './adminAccess';

export const getCurrentAdminAccessState = () => {
  const snapshot = getAdminAccessSnapshot();
  const adminPortalAllowed = hasAdminPortalAccess(snapshot?.payload ?? null);
  return { adminPortalAllowed, snapshot };
};

const getSnapshot = () => getAdminAccessSnapshot();

export const useAdminAccessState = () => {
  const { isAuthenticated, session, sessionStatus, authInitializing } = useSecureAuth();
  const snapshot = useSyncExternalStore(subscribeAdminAccessSnapshot, getSnapshot, getSnapshot);

  const adminPortalAllowed = useMemo(() => {
    if (isAuthenticated?.admin) {
      return true;
    }
    return hasAdminPortalAccess(snapshot?.payload ?? null);
  }, [isAuthenticated?.admin, snapshot]);

  return {
    adminPortalAllowed,
    snapshot,
    hasSession: Boolean(session?.access_token),
    sessionStatus,
    authInitializing,
  };
};
