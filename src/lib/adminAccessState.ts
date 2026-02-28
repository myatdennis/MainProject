import { getAdminAccessSnapshot, hasAdminPortalAccess } from './adminAccess';

export const getCurrentAdminAccessState = () => {
  const snapshot = getAdminAccessSnapshot();
  const adminPortalAllowed = hasAdminPortalAccess(snapshot?.payload ?? null);
  return { adminPortalAllowed, snapshot };
};

