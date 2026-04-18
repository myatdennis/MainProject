// A small singleton that represents the canonical session state as owned by
// SecureAuthContext. Other modules should import this to read the current
// access token/session synchronously without reaching directly into Supabase.
type SessionSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userEmail: string | null;
  activeOrgId: string | null;
  authenticated: boolean;
};

let snapshot: SessionSnapshot = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  userEmail: null,
  activeOrgId: null,
  authenticated: false,
};

type Listener = (next: SessionSnapshot) => void;
const listeners = new Set<Listener>();

export function getCanonicalSession(): SessionSnapshot {
  return { ...snapshot };
}

export function getCanonicalAccessToken(): string | null {
  return snapshot.accessToken;
}

export function isCanonicalAuthenticated(): boolean {
  return snapshot.authenticated === true;
}

export function setCanonicalSession(next: Partial<SessionSnapshot>) {
  snapshot = { ...snapshot, ...next } as SessionSnapshot;
  for (const l of Array.from(listeners)) {
    try {
      l(getCanonicalSession());
    } catch (e) {
      // swallow listener errors
      // eslint-disable-next-line no-console
      console.warn('[canonicalAuth] listener error', e);
    }
  }
}

export function clearCanonicalSession() {
  snapshot = {
    accessToken: null,
    refreshToken: null,
    userId: null,
    userEmail: null,
    activeOrgId: null,
    authenticated: false,
  };
  for (const l of Array.from(listeners)) {
    try {
      l(getCanonicalSession());
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[canonicalAuth] listener error', e);
    }
  }
}

export function subscribeCanonicalAuth(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function waitForAuthReady(timeoutMs = 10000): Promise<SessionSnapshot> {
  if (snapshot.authenticated) return Promise.resolve(getCanonicalSession());
  return new Promise<SessionSnapshot>((resolve, reject) => {
    let settled = false;
    const unsub = subscribeCanonicalAuth((next) => {
      if (next.authenticated) {
        if (!settled) {
          settled = true;
          unsub();
          resolve(next);
        }
      }
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          unsub();
        } catch {}
        reject(new Error('waitForAuthReady: timeout'));
      }
    }, timeoutMs);
    // guard to cleanup if resolved early (race)
    Promise.resolve().then(() => {
      if (snapshot.authenticated && !settled) {
        settled = true;
        clearTimeout(timer);
        try {
          unsub();
        } catch {}
        resolve(getCanonicalSession());
      }
    });
  });
}

export default {
  getCanonicalSession,
  getCanonicalAccessToken,
  isCanonicalAuthenticated,
  setCanonicalSession,
  clearCanonicalSession,
  subscribeCanonicalAuth,
  waitForAuthReady,
};
