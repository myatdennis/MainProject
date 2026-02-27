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

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : '') ||
  '';

const normalizeUrl = (target: string): string => {
  if (!target) return target;
  const absolutePattern = /^https?:\/\//i;
  if (absolutePattern.test(target)) {
    return target;
  }
  if (typeof window !== 'undefined' && target.startsWith('/')) {
    try {
      return new URL(target, window.location.origin).toString();
    } catch {
      return target;
    }
  }
  if (API_BASE) {
    const base = API_BASE.replace(/\/+$/, '');
    const path = target.startsWith('/') ? target : `/${target}`;
    return `${base}${path}`;
  }
  return target;
};

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

export const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[authorizedFetch] Supabase getSession failed', error);
      return null;
    }
    return data?.session?.access_token ?? null;
  } catch (sessionError) {
    console.warn('[authorizedFetch] Supabase session lookup failed', sessionError);
    return null;
  }
};

const resolveSupabaseAccessToken = async (): Promise<string> => {
  try {
    let token = await getAccessToken();
    if (token) {
      return token;
    }

    if (devMode) {
      console.warn('[authorizedFetch] Supabase session missing access_token, attempting refresh.');
    }

    token = await refreshSupabaseSession();
    if (token) {
      return token;
    }

    throw new NotAuthenticatedError('Supabase session is missing an access_token');
  } catch (error) {
    if (devMode && !(error instanceof NotAuthenticatedError)) {
      console.warn('[authorizedFetch] Failed to resolve Supabase session', error);
    }
    throw error instanceof NotAuthenticatedError ? error : new NotAuthenticatedError();
  }
};

const refreshSupabaseSession = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('[authorizedFetch] supabase.auth.refreshSession error', error);
      return null;
    }
    const refreshedToken = data?.session?.access_token ?? null;
    if (!refreshedToken && devMode) {
      console.warn('[authorizedFetch] refreshSession returned without access_token');
    }
    return refreshedToken;
  } catch (error) {
    console.warn('[authorizedFetch] Failed to refresh Supabase session', error);
    return null;
  }
};

const DEFAULT_TIMEOUT_MS = 12_000;

export type AuthorizedFetchOptions = {
  requireAuth?: boolean;
  timeoutMs?: number;
  requestLabel?: string;
};

const createAbortController = (timeoutMs: number, externalSignal?: AbortSignal | null) => {
  const controller = new AbortController();
  const buildAbortError = (message: string) => {
    if (typeof DOMException !== 'undefined') {
      return new DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  };
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(buildAbortError('Request timed out'));
        }, timeoutMs)
      : null;

  const handleExternalAbort = () => {
    controller.abort(
      externalSignal?.reason instanceof Error
        ? externalSignal.reason
        : buildAbortError('Aborted'),
    );
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort);
    }
  }

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', handleExternalAbort);
    }
  };

  return { controller, cleanup };
};

export default async function authorizedFetch(
  url: string,
  init: RequestInit = {},
  options: AuthorizedFetchOptions = {},
): Promise<Response> {
  const requireAuth =
    options.requireAuth === true
      ? true
      : options.requireAuth === false
      ? false
      : !isPublicEndpoint(url);
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const requestLabel = options.requestLabel || extractPathname(url);
  let attempt = 0;

  while (attempt < 2) {
    const headers = new Headers(init.headers || {});
    let token: string | null = null;

    if (requireAuth) {
      token = await resolveSupabaseAccessToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    const bodyIsFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const bodyIsString = typeof init.body === 'string';
    if (init.body && !bodyIsFormData && !bodyIsString && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (devMode && extractPathname(url) === '/api/admin/me') {
      console.debug('[authorizedFetch][dev] /api/admin/me Authorization', {
        attached: Boolean(token),
        tokenPreview: token ? `${token.slice(0, 6)}…${token.slice(-6)}` : null,
      });
    }

    const { controller, cleanup } = createAbortController(timeoutMs, init.signal);
    let response: Response;
    const targetUrl = normalizeUrl(url);
    try {
      response = await fetch(targetUrl, { ...init, headers, signal: controller.signal });
    } catch (error: any) {
      cleanup();
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (devMode) {
          console.warn('[authorizedFetch] request aborted', { url, requestLabel, attempt });
        }
        throw error;
      }
      throw error;
    } finally {
      cleanup();
    }
    if (response.status !== 401 || !requireAuth) {
      return response;
    }

    if (attempt === 0) {
      if (devMode) {
        console.debug('[authorizedFetch] 401 received. Attempting Supabase refresh.', { url, requestLabel });
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
