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
 */

export type OrgContextSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  orgId: string | null;
  role: string | null;
  userId: string | null;
};

// ── Mutable snapshot (primary) ───────────────────────────────────────────────
// Written by SecureAuthContext on every render that changes auth/org state.
// Read by courseStore synchronously — no effect-commit delay.
let latestSnapshot: OrgContextSnapshot | null = null;
let snapshotWrittenAt: number = 0;

export const writeBridgeSnapshot = (snapshot: OrgContextSnapshot): void => {
  latestSnapshot = snapshot;
  snapshotWrittenAt = Date.now();
  if (typeof window !== 'undefined' && (window as any).__DEV_BRIDGE_LOG) {
    console.debug('[courseStoreOrgBridge] snapshot_written', {
      status: snapshot.status,
      orgId: snapshot.orgId,
      role: snapshot.role,
      userId: snapshot.userId,
      ts: snapshotWrittenAt,
    });
  }
};

export const readBridgeSnapshot = (): OrgContextSnapshot | null => latestSnapshot;

export const getBridgeSnapshotAge = (): number =>
  snapshotWrittenAt > 0 ? Date.now() - snapshotWrittenAt : Infinity;

// ── Closure-based resolver (legacy / secondary) ──────────────────────────────
let resolver: (() => OrgContextSnapshot | null) | null = null;
let resolverRegistered = false;

export const registerCourseStoreOrgResolver = (
  next: (() => OrgContextSnapshot | null) | null,
): void => {
  resolver = next;
  resolverRegistered = typeof next === 'function';
};

/**
 * Returns the best available org context snapshot.
 *
 * Priority:
 *  1. Mutable snapshot written by writeBridgeSnapshot() — always up-to-date
 *  2. Closure resolver (legacy) — may lag a React render behind
 *  3. null
 */
export const resolveOrgContextFromBridge = (): OrgContextSnapshot | null => {
  if (latestSnapshot !== null) {
    return latestSnapshot;
  }
  return resolver ? resolver() : null;
};

export const isOrgResolverRegistered = (): boolean =>
  latestSnapshot !== null || resolverRegistered;

/** Clears all bridge state. Call on logout / context unmount. */
export const clearBridgeSnapshot = (): void => {
  latestSnapshot = null;
  snapshotWrittenAt = 0;
  resolver = null;
  resolverRegistered = false;
};
