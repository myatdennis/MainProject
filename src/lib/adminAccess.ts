export interface AdminAccessPayload {
  adminPortalAllowed?: boolean;
  access?: {
    adminPortal?: boolean;
    admin?: boolean;
    capabilities?: Record<string, boolean | undefined>;
  } | null;
  user?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
}

type Snapshot = {
  payload: AdminAccessPayload | null;
  fetchedAt: number;
};

const ADMIN_ACCESS_TTL_MS = 2 * 60 * 1000;

let snapshot: Snapshot | null = null;
const snapshotListeners = new Set<() => void>();

const notifySnapshotListeners = () => {
  snapshotListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[adminAccess] snapshot listener error', error);
    }
  });
};

export const hasAdminPortalAccess = (payload?: AdminAccessPayload | null): boolean => {
  if (!payload) {
    return false;
  }
  if (payload.adminPortalAllowed === true) {
    return true;
  }
  if (!payload.access) {
    return false;
  }
  const access = payload.access;
  return (
    access.allowed === true ||
    access.adminPortal === true ||
    access.admin === true ||
    Boolean(access.capabilities?.adminPortal)
  );
};

export const setAdminAccessSnapshot = (payload: AdminAccessPayload | null) => {
  snapshot = payload
    ? {
        payload,
        fetchedAt: Date.now(),
      }
    : null;
  notifySnapshotListeners();
};

export const getAdminAccessSnapshot = (): Snapshot | null => snapshot;

export const isAdminAccessSnapshotFresh = (ttlMs = ADMIN_ACCESS_TTL_MS): boolean => {
  if (!snapshot) {
    return false;
  }
  return Date.now() - snapshot.fetchedAt < ttlMs;
};

export const clearAdminAccessSnapshot = () => {
  snapshot = null;
  notifySnapshotListeners();
};

export const subscribeAdminAccessSnapshot = (listener: () => void) => {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
};

export { ADMIN_ACCESS_TTL_MS };
