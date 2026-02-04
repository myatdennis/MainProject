import { getSupabase, hasSupabaseConfig, SUPABASE_MISSING_CONFIG_MESSAGE } from '../lib/supabaseClient';
import { getUserSession, getActiveOrgPreference, getAccessToken } from '../lib/secureStorage';

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
    const supabase = await getSupabase();
    if (!supabase) {
      console.warn('[requestContext] Supabase configured but client not available');
      supabaseSessionSnapshot = createRetrySnapshot();
      return supabaseSessionSnapshot;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[requestContext] Failed to resolve Supabase session:', error.message || error);
      supabaseSessionSnapshot = createRetrySnapshot();
      return supabaseSessionSnapshot;
    }

    const session = data?.session ?? null;
    if (!session) {
      supabaseSessionSnapshot = createRetrySnapshot();
      return supabaseSessionSnapshot;
    }

    const expiresAt = session.expires_at ? session.expires_at * 1000 : now() + 60 * 1000;

    supabaseSessionSnapshot = {
      token: session.access_token ?? null,
      userId: session.user?.id ?? null,
      expiresAt: session.access_token ? expiresAt : now() + SUPABASE_SESSION_RETRY_MS,
    };

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

const resolveSupabaseUserId = async (): Promise<string | null> => {
  const snapshot = await resolveSupabaseSessionSnapshot();
  return snapshot?.userId ?? null;
};

export const clearSupabaseAuthSnapshot = () => {
  supabaseSessionSnapshot = null;
};

export const buildAuthHeaders = async (): Promise<AuthHeaders> => {
  const headers: AuthHeaders = {};
  let authSource: AuthHeaderSource = 'none';

  // 1) Prefer secure storage (your app’s own session)
  if (typeof window !== 'undefined') {
    try {
      const userSession = getUserSession();

      if (userSession) {
        if (userSession.id) headers['X-User-Id'] = String(userSession.id);
        if (userSession.role) headers['X-User-Role'] = String(userSession.role);

        const preferredOrgId =
          userSession.activeOrgId || userSession.organizationId || getActiveOrgPreference();
        if (preferredOrgId) headers['X-Org-Id'] = String(preferredOrgId);

        const token = getAccessToken();
        if (token && !headers.Authorization) {
          headers.Authorization = `Bearer ${token}`;
          authSource = 'secureStorage';
        }
      } else {
        const fallbackOrg = getActiveOrgPreference();
        if (fallbackOrg) headers['X-Org-Id'] = String(fallbackOrg);
      }
    } catch (err) {
      console.warn('[requestContext] Failed to read secure storage:', err);
    }
  }

  // 2) Fallback to Supabase session
  if (hasSupabaseConfig()) {
    try {
      if (!headers.Authorization) {
        const supabaseToken = await resolveSupabaseAccessToken();
        if (supabaseToken) {
          headers.Authorization = `Bearer ${supabaseToken}`;
          authSource = 'supabase';
        }
      }

      if (!headers['X-User-Id']) {
        const supabaseUserId = await resolveSupabaseUserId();
        if (supabaseUserId) headers['X-User-Id'] = supabaseUserId;
      }
    } catch (err) {
      console.warn('[requestContext] Failed to add Supabase auth context:', err);
    }
  } else {
    headers['X-Supabase-Disabled'] = 'true';
    headers['X-Supabase-Reason'] = SUPABASE_MISSING_CONFIG_MESSAGE;
  }

  Object.defineProperty(headers, '__authSource', {
    value: authSource,
    enumerable: false,
    configurable: false,
  });

  return headers;
};

export default buildAuthHeaders;
