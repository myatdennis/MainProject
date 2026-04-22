/**
 * courseStoreOrgBridge
 *
 * Provides a mutable, always-current snapshot of the auth/org state so that
 * courseStore can read it synchronously without depending on a stale React
 * effect closure.
 *
 * Design: SecureAuthContext writes to `latestSnapshot` via writeBridgeSnapshot()
 * on every render (inside a useEffect that runs BEFORE the auth_ready dispatch).
 * courseStore reads `latestSnapshot` directly via resolveOrgContextFromBridge()
 * — no effect-commit delay, no stale closure.
 *
 * The closure-based resolver (registerCourseStoreOrgResolver) is kept as a
 * secondary fallback for backward compatibility but is no longer the primary
 * read path.
 *
 * Singleton guard: state is kept on `window.__courseStoreOrgBridge` so that
 * if Vite ever bundles this module into more than one chunk (causing two
 * separate module instances), all instances still share the same object.
 */

export type OrgContextSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  membershipStatus: 'idle' | 'loading' | 'ready' | 'degraded' | 'error';
  activeOrgId: string | null;
  orgId: string | null;
  role: string | null;
  userId: string | null;
  updatedAt?: number;
};

export const BRIDGE_SNAPSHOT_EVENT = 'huddle:org_snapshot_updated';



// ── Window-object singleton (survives Vite chunk duplication) ────────────────
type BridgeStore = {
  latestSnapshot: OrgContextSnapshot | null;
  snapshotWrittenAt: number;
};

declare global {
  interface Window {
    __courseStoreOrgBridge?: BridgeStore;
  }
}

// ── BUILD FINGERPRINT ────────────────────────────────────────────────────────
// Token: 0b9c7f8e — bump this comment to force a new hash on every deploy.
// If this string does NOT appear in the browser console after a deploy, the
// browser is serving a cached/old bundle.
// Legacy build fingerprint retained via TRACE logs below.

const _getStore = (): BridgeStore => {
  if (!window.__courseStoreOrgBridge) {
    window.__courseStoreOrgBridge = {
      latestSnapshot: null,
      snapshotWrittenAt: 0,
    };
    // ...existing code...
  } else {
    // ...existing code...
  }
  return window.__courseStoreOrgBridge;
};



export const writeBridgeSnapshot = (snapshot: OrgContextSnapshot): void => {
  const store = _getStore();
  const normalized: OrgContextSnapshot = {
    membershipStatus: snapshot.membershipStatus,
    status:
      snapshot.status ||
      (snapshot.membershipStatus === 'ready' || snapshot.membershipStatus === 'degraded' ? 'ready' : 'loading'),
    activeOrgId: snapshot.activeOrgId ?? snapshot.orgId ?? null,
    orgId: snapshot.orgId ?? snapshot.activeOrgId ?? null,
    role: snapshot.role ?? null,
    userId: snapshot.userId ?? null,
    updatedAt: Date.now(),
  };
  store.latestSnapshot = normalized;
  store.snapshotWrittenAt = normalized.updatedAt ?? Date.now();
  // ...existing code...
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent(BRIDGE_SNAPSHOT_EVENT, {
          detail: {
            updatedAt: normalized.updatedAt,
            membershipStatus: normalized.membershipStatus,
            status: normalized.status,
          },
        }),
      );
    } catch (error) {
      console.warn('[courseStoreOrgBridge] Failed to dispatch snapshot event', error);
    }
  }
};

export const readBridgeSnapshot = (): OrgContextSnapshot | null => {
  const snapshot = _getStore().latestSnapshot;
  // ...existing code...
  return snapshot;
};

export const getBridgeSnapshotAge = (): number => {
  const { snapshotWrittenAt } = _getStore();
  return snapshotWrittenAt > 0 ? Date.now() - snapshotWrittenAt : Infinity;
};

// Legacy closure-based resolver and SSR fallback removed. Only window singleton is used.

/** Clears all bridge state. Call on explicit logout only. */
export const clearBridgeSnapshot = (): void => {
  const store = _getStore();
  store.latestSnapshot = null;
  store.snapshotWrittenAt = 0;
  // ...existing code...
};

/**
 * Backwards-compatible resolver used by older modules. Prefer `readBridgeSnapshot`
 * for the canonical, synchronous read path, but keep this exported symbol so
 * callers that import it don't break after the bridge refactor.
 */
export const resolveOrgContextFromBridge = (): OrgContextSnapshot | null => {
  return readBridgeSnapshot();
};

/**
 * Legacy registration API stub. The bridge no longer requires external
 * resolvers to be registered; return false to indicate no external resolver
 * is present.
 */
export const isOrgResolverRegistered = (): boolean => {
  return false;
};
