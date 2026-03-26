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
  orgId: string | null;
  role: string | null;
  userId: string | null;
};

const TRACE_TOKEN = 'SEV1_REAL_FIX_01';

if (typeof window !== 'undefined') {
  console.debug('[TRACE BUILD]', {
    token: TRACE_TOKEN,
    source: 'courseStoreOrgBridge',
    ts: Date.now(),
  });
}

// ── Window-object singleton (survives Vite chunk duplication) ────────────────
type BridgeStore = {
  latestSnapshot: OrgContextSnapshot | null;
  snapshotWrittenAt: number;
  resolver: (() => OrgContextSnapshot | null) | null;
  resolverRegistered: boolean;
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
  if (typeof window === 'undefined') {
    // SSR / non-browser: use a module-local fallback (never shared, but that's
    // acceptable in SSR where there is no cross-chunk singleton problem).
    return _ssrStore;
  }
  if (!window.__courseStoreOrgBridge) {
    window.__courseStoreOrgBridge = {
      latestSnapshot: null,
      snapshotWrittenAt: 0,
      resolver: null,
      resolverRegistered: false,
    };
    console.debug('[TRACE BRIDGE WRITE]', {
      token: TRACE_TOKEN,
      event: 'singleton_created',
      ts: Date.now(),
    });
  } else {
    console.debug('[TRACE BRIDGE WRITE]', {
      token: TRACE_TOKEN,
      event: 'singleton_reused',
      ts: Date.now(),
    });
  }
  return window.__courseStoreOrgBridge;
};

// SSR-only fallback (module-local, used when window is undefined)
const _ssrStore: BridgeStore = {
  latestSnapshot: null,
  snapshotWrittenAt: 0,
  resolver: null,
  resolverRegistered: false,
};

export const writeBridgeSnapshot = (snapshot: OrgContextSnapshot): void => {
  const store = _getStore();
  store.latestSnapshot = snapshot;
  store.snapshotWrittenAt = Date.now();
  console.debug('[TRACE BRIDGE WRITE]', {
    token: TRACE_TOKEN,
    snapshot,
    ts: store.snapshotWrittenAt,
  });
};

export const readBridgeSnapshot = (): OrgContextSnapshot | null => _getStore().latestSnapshot;

export const getBridgeSnapshotAge = (): number => {
  const { snapshotWrittenAt } = _getStore();
  return snapshotWrittenAt > 0 ? Date.now() - snapshotWrittenAt : Infinity;
};

// ── Closure-based resolver (legacy / secondary) ──────────────────────────────
export const registerCourseStoreOrgResolver = (
  next: (() => OrgContextSnapshot | null) | null,
): void => {
  const store = _getStore();
  store.resolver = next;
  store.resolverRegistered = typeof next === 'function';
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
  const store = _getStore();
  const result =
    store.latestSnapshot !== null
      ? store.latestSnapshot
      : store.resolver
        ? store.resolver()
        : null;
  console.debug('[TRACE BRIDGE READ]', {
    token: TRACE_TOKEN,
    status: result?.status ?? 'null',
    orgId: result?.orgId ?? null,
    role: result?.role ?? null,
    userId: result?.userId ?? null,
    source:
      store.latestSnapshot !== null
        ? 'snapshot'
        : store.resolver
          ? 'resolver'
          : 'none',
    ts: Date.now(),
  });
  return result;
};

export const isOrgResolverRegistered = (): boolean => {
  const store = _getStore();
  return store.latestSnapshot !== null || store.resolverRegistered;
};

/** Clears all bridge state. Call on explicit logout only — never in effect cleanup. */
export const clearBridgeSnapshot = (): void => {
  const store = _getStore();
  store.latestSnapshot = null;
  store.snapshotWrittenAt = 0;
  store.resolver = null;
  store.resolverRegistered = false;
  console.debug('[TRACE BRIDGE WRITE]', {
    token: TRACE_TOKEN,
    event: 'clear',
    ts: Date.now(),
  });
};
