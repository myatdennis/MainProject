import { hasSupabaseConfig } from '../lib/supabaseClient';

export type AuthHeaderSource = 'secureStorage' | 'supabase' | 'none';
export type AuthHeaders = Record<string, string> & { __authSource?: AuthHeaderSource };

type SupabaseSessionSnapshot = {
  token: string | null;
  userId: string | null;
  expiresAt: number;
};

const SUPABASE_TOKEN_SKEW_MS = 30 * 1000;
const SUPABASE_SESSION_RETRY_MS = 15 * 1000;

let supabaseSessionSnapshot: SupabaseSessionSnapshot | null = null;

const now = () => Date.now();

const isSnapshotFresh = (snapshot: SupabaseSessionSnapshot | null): boolean => {
  if (!snapshot) return false;
  return snapshot.expiresAt - SUPABASE_TOKEN_SKEW_MS > now();
};

const createRetrySnapshot = (): SupabaseSessionSnapshot => ({
  token: null,
  userId: null,
  expiresAt: now() + SUPABASE_SESSION_RETRY_MS,
});

const resolveSupabaseSessionSnapshot = async (): Promise<SupabaseSessionSnapshot | null> => {
  if (!hasSupabaseConfig()) return null;

  if (isSnapshotFresh(supabaseSessionSnapshot)) {
    return supabaseSessionSnapshot;
  }

  try {
    // Prefer canonical in-memory session snapshot; avoid reading Supabase
    // session directly from arbitrary modules.
    const { getCanonicalSession, waitForAuthReady } = await import('../lib/canonicalAuth');
    const cs = getCanonicalSession();
    if (cs && cs.accessToken) {
      supabaseSessionSnapshot = {
        token: cs.accessToken,
        userId: cs.userId ?? null,
        expiresAt: now() + 60 * 1000,
      };
      return supabaseSessionSnapshot;
    }
    const ready = await waitForAuthReady(2000).catch(() => null);
    if (ready && ready.accessToken) {
      supabaseSessionSnapshot = {
        token: ready.accessToken,
        userId: ready.userId ?? null,
        expiresAt: now() + 60 * 1000,
      };
      return supabaseSessionSnapshot;
    }
    supabaseSessionSnapshot = createRetrySnapshot();
    return supabaseSessionSnapshot;
  } catch (err) {
    console.warn('[requestContext] Supabase session lookup failed:', err);
    supabaseSessionSnapshot = createRetrySnapshot();
    return supabaseSessionSnapshot;
  }
};

export const resolveSupabaseAccessToken = async (): Promise<string | null> => {
  const snapshot = await resolveSupabaseSessionSnapshot();
  return snapshot?.token ?? null;
};

export const clearSupabaseAuthSnapshot = () => {
  supabaseSessionSnapshot = null;
};

export async function buildAuthHeaders(): Promise<AuthHeaders> {
  const headers: AuthHeaders = {
    'Content-Type': 'application/json',
  };

  try {
    const token = await resolveSupabaseAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers.__authSource = 'supabase';
    } else {
      headers.__authSource = 'none';
    }
  } catch (err) {
    // Keep best-effort — if session lookup fails, return minimal headers.
    const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
    console.warn('[requestContext] unable to resolve supabase session for auth headers', msg);
    headers.__authSource = 'none';
  }

  return headers;
}

export default buildAuthHeaders;
