import { getSupabase } from './supabaseClient';
import { getAccessToken as getStoredAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './secureStorage';
import { LEGACY_ORG_HEADER_NAME, ORG_HEADER_NAME, resolveOrgHeaderForRequest } from './orgContext';

export class NotAuthenticatedError extends Error {
  constructor(message = 'Backend session is unavailable') {
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

const isE2EBypassActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__E2E_BYPASS);
};

const inferE2EBypassRole = (): 'admin' | 'learner' => {
  if (typeof window === 'undefined') return 'learner';
  const pathname = String(window.location?.pathname || '').toLowerCase();
  return pathname.startsWith('/admin') ? 'admin' : 'learner';
};

const refreshAuthToken = async (): Promise<boolean> => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      if (devMode) {
        console.warn('[authorizedFetch] no refresh token available');
      }
      return false;
    }

    const refreshResponse = await fetch(normalizeUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });

    if (!refreshResponse.ok) {
      if (devMode) {
        console.warn('[authorizedFetch] refresh request failed', { status: refreshResponse.status });
      }
      return false;
    }

    const json = await refreshResponse.json();
    if (!json || !json.accessToken) {
      return false;
    }

    setAccessToken(json.accessToken, 'authorizedFetch:refresh');
    if (json.refreshToken) {
      setRefreshToken(json.refreshToken, 'authorizedFetch:refresh');
    }
    return true;
  } catch (error) {
    console.warn('[authorizedFetch] token refresh failed', error);
    return false;
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
    const e2eBypass = isE2EBypassActive();

    if (e2eBypass) {
      headers.set('X-E2E-Bypass', 'true');
      if (!headers.has('X-User-Role')) {
        headers.set('X-User-Role', inferE2EBypassRole());
      }
      headers.delete('Authorization');
    }

    if (requireAuth && !e2eBypass) {
      token = getStoredAccessToken();
      if (!token) {
        const supabase = getSupabase();
        if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
          const sessionResult = await supabase.auth.getSession();
          token = sessionResult?.data?.session?.access_token ?? null;
        }
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const orgId = resolveOrgHeaderForRequest(url);
    if (orgId) {
      headers.set(ORG_HEADER_NAME, orgId);
      headers.set(LEGACY_ORG_HEADER_NAME, orgId);
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
      const isRefreshEndpoint = extractPathname(url).startsWith('/api/auth/refresh');

      if (!isRefreshEndpoint) {
        // Always attempt a refresh on first 401 for authenticated requests.
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          attempt += 1;
          console.info('[authorizedFetch] token refreshed after 401, retrying request', { url: extractPathname(url) });
          continue;
        }
      }

      // No refresh possible or refresh failed.
      return response;
    }

    return response;
  }

  return new Response(null, { status: 401 });
}
