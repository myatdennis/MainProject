import { hasSupabaseConfig } from '../lib/supabaseClient';

export type AuthHeaderSource = 'supabase' | 'none';
export type AuthHeaders = Record<string, string> & { __authSource?: AuthHeaderSource };

type SupabaseSessionSnapshot = {
  token: string | null;
  userId: string | null;
  expiresAt: number;
};

const resolveSupabaseSessionSnapshot = async (): Promise<SupabaseSessionSnapshot | null> => {
  if (!hasSupabaseConfig()) return null;

  try {
    const { getSessionCached } = await import('../lib/sessionCache');
    const session = await getSessionCached();
    if (session) {
      return {
        token: session?.access_token ?? null,
        userId: session?.user?.id ?? null,
        expiresAt: session?.expires_at ?? 0,
      };
    }
    return null;
  } catch (err) {
    console.warn('[requestContext] Supabase session lookup failed:', err);
    return null;
  }
};

export const resolveSupabaseAccessToken = async (): Promise<string | null> => {
  const snapshot = await resolveSupabaseSessionSnapshot();
  return snapshot?.token ?? null;
};

export const clearSupabaseAuthSnapshot = () => {
  return;
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
