import { supabase } from './supabaseClient';

export class NotAuthenticatedError extends Error {
  constructor(message = 'Supabase session is unavailable') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

const devMode = Boolean(
  (import.meta as any)?.env?.DEV ?? (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'),
);

const PUBLIC_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/mfa/challenge',
  '/api/mfa/verify',
  '/api/health',
]);
const PUBLIC_ENDPOINT_PREFIXES = ['/api/diagnostics'];

const extractPathname = (target: string): string => {
  try {
    if (/^https?:\/\//i.test(target)) {
      return new URL(target).pathname || '/';
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(target, window.location.origin).pathname || '/';
    }
    return target;
  } catch {
    return target;
  }
};

const isPublicEndpoint = (target: string): boolean => {
  const pathname = extractPathname(target);
  if (PUBLIC_ENDPOINTS.has(pathname)) return true;
  return PUBLIC_ENDPOINT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const resolveSupabaseAccessToken = async (): Promise<string> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new NotAuthenticatedError(error.message || 'Supabase session lookup failed');
    }
    const token = data?.session?.access_token ?? null;
    if (!token) {
      throw new NotAuthenticatedError('Supabase session is missing an access_token');
    }
    return token;
  } catch (error) {
    if (devMode && !(error instanceof NotAuthenticatedError)) {
      console.warn('[authorizedFetch] Failed to resolve Supabase session', error);
    }
    throw error instanceof NotAuthenticatedError ? error : new NotAuthenticatedError();
  }
};

const refreshSupabaseSession = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('[authorizedFetch] supabase.auth.refreshSession error', error);
      return false;
    }
    return Boolean(data?.session?.access_token);
  } catch (error) {
    console.warn('[authorizedFetch] Failed to refresh Supabase session', error);
    return false;
  }
};

export type AuthorizedFetchOptions = {
  requireAuth?: boolean;
};

export default async function authorizedFetch(
  url: string,
  init: RequestInit = {},
  options: AuthorizedFetchOptions = {},
): Promise<Response> {
  const requireAuth = options.requireAuth !== false && !isPublicEndpoint(url);
  let attempt = 0;

  while (attempt < 2) {
    const headers = new Headers(init.headers || {});
    let token: string | null = null;

    if (requireAuth) {
      token = await resolveSupabaseAccessToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (devMode && extractPathname(url) === '/api/admin/me') {
      console.debug('[authorizedFetch][dev] /api/admin/me Authorization', {
        attached: Boolean(token),
        tokenPreview: token ? `${token.slice(0, 6)}…${token.slice(-6)}` : null,
      });
    }

    const response = await fetch(url, { ...init, headers });
    if (response.status !== 401 || !requireAuth) {
      return response;
    }

    if (attempt === 0) {
      if (devMode) {
        console.debug('[authorizedFetch] 401 received. Attempting Supabase refresh.', { url });
      }
      const refreshed = await refreshSupabaseSession();
      attempt += 1;
      if (refreshed) {
        continue;
      }
      return response;
    }

    return response;
  }

  return new Response(null, { status: 401 });
}
