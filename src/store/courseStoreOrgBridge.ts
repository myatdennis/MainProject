export type OrgContextSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  orgId: string | null;
  role: string | null;
  userId: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Direct snapshot path (preferred, always-current)
//
// SecureAuthProvider writes here synchronously during every render so the
// bridge reflects the latest auth state before any useEffect fires.  This
// eliminates the effect-ordering race where huddle:auth_ready dispatched
// before the resolver-registration effect re-ran with fresh closed-over values.
// ─────────────────────────────────────────────────────────────────────────────
let directSnapshot: OrgContextSnapshot | null = null;

export const setOrgContextSnapshot = (snapshot: OrgContextSnapshot | null): void => {
  directSnapshot = snapshot;
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy closure path (kept for backwards-compatibility with tests that mock
// registerCourseStoreOrgResolver; direct snapshot takes priority when present)
// ─────────────────────────────────────────────────────────────────────────────
let resolver: (() => OrgContextSnapshot | null) | null = null;
let resolverRegistered = false;

export const registerCourseStoreOrgResolver = (next: (() => OrgContextSnapshot | null) | null): void => {
  resolver = next;
  resolverRegistered = typeof next === 'function';
};

export const resolveOrgContextFromBridge = (): OrgContextSnapshot | null => {
  // Direct snapshot is always preferred — it is set synchronously during render
  // so it reflects the current auth state with zero effect-ordering lag.
  if (directSnapshot !== null) return directSnapshot;
  return resolver ? resolver() : null;
};

export const isOrgResolverRegistered = (): boolean =>
  directSnapshot !== null || resolverRegistered;
