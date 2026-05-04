import { getSupabase } from './supabaseClient';
import { resolveOrgHeaderForRequest, getGlobalActiveOrgIdForApi } from './orgContext';
import { GLOBAL_ORG_ID } from '../constants/org';
import { resolveApiUrl } from '../config/apiBase';
import { API_BASE } from '../config/api';
import { getNativeFetch } from './nativeFetch';
import { assertApiReady, ApiReadinessError } from './apiReadiness';

const isTest = process.env.NODE_ENV === 'test';

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

const normalizeUrl = (target: string): string => {
  if (!target) return target;
  // Hard fail early on any accidental double /api prefix — this catches
  // both absolute and relative occurrences before network requests go out.
  if (String(target).includes('/api/api')) {
    throw new Error('[FATAL] DOUBLE API PREFIX: ' + String(target));
  }
  const absolutePattern = /^https?:\/\//i;
  if (absolutePattern.test(target)) {
    try {
      const parsed = new URL(target);
      const host = String(parsed.hostname || '').toLowerCase();
      const path = String(parsed.pathname || '');
      if (host.endsWith('.supabase.co') && /^\/functions\/v1(?:\/|$)/i.test(path)) {
        const normalizedPath = `${path.replace(/^\/functions\/v1/i, '') || '/'}${parsed.search || ''}${parsed.hash || ''}`;
        return resolveApiUrl(normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`);
      }
    } catch {
      // Fall through to the raw target if URL parsing fails.
    }
    return target;
  }
  // If target is a relative API path, prefer the explicit API_BASE so the
  // frontend always calls the canonical backend origin (development vs prod).
  try {
    if (target.startsWith('/api')) {
      // Ensure no double slash when joining
      const suffix = target.replace(/^\/+/, '');
      const candidate = `${API_BASE.replace(/\/$/, '')}/${suffix}`;
      if (String(candidate).includes('/api/api')) {
        // If the join produced a double /api, prefer resolveApiUrl which
        // contains normalization logic; additionally hard-fail to prevent
        // routing mistakes.
        throw new Error('[FATAL] DOUBLE API PREFIX: ' + String(candidate));
      }
      return candidate;
    }
  } catch {
    // fall back to existing behavior
  }
  return resolveApiUrl(target);
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

const isAuthEndpoint = (target: string): boolean => extractPathname(target).startsWith('/api/auth');

// intentionally omitted cookie snapshot helper — not used anymore

const isE2EBypassActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__E2E_BYPASS);
};

const stripProductionOverrideHeaders = (headers: Headers): void => {
  if (!import.meta.env.PROD) return;
  headers.delete('X-Org-Id');
  headers.delete('X-Organization-Id');
  headers.delete('X-User-Role');
  headers.delete('X-E2E-Bypass');
};

const inferE2EBypassRole = (): 'admin' | 'learner' => {
  if (typeof window === 'undefined') return 'learner';
  const pathname = String(window.location?.pathname || '').toLowerCase();
  return pathname.startsWith('/admin') ? 'admin' : 'learner';
};

const DEFAULT_TIMEOUT_MS = 12_000;
let requestSequence = 0;

const nextRequestId = () => {
  requestSequence += 1;
  return `req-${requestSequence.toString(36)}`;
};

const requireSupabaseSessionToken = async (): Promise<string> => {
  const supabase = getSupabase();
  if (!supabase || typeof supabase.auth?.getSession !== 'function') {
    throw new NotAuthenticatedError('No session');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new NotAuthenticatedError('No session');
  }
  return session.access_token;
};

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
  const requestId = nextRequestId();
  const requireAuth =
    options.requireAuth === true
      ? true
      : options.requireAuth === false
      ? false
      : !isPublicEndpoint(url);

  // In test environments we default to not requiring auth unless the caller
  // explicitly set requireAuth: true. This prevents unit tests from being
  // forced into redirect/401 flows while preserving production semantics.
  const shouldRequireAuth = isTest ? (options.requireAuth === true ? true : false) : requireAuth;
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const requestLabel = options.requestLabel || extractPathname(url);
  let attempt = 0;

  while (attempt < 2) {
    const headers = new Headers(init.headers || {});
    // Attach request id for server-side correlation
    if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', requestId);
    if (devMode) {
      console.info('[request_start]', { requestId, url: extractPathname(url), attempt });
    }
    let token: string | null = null;
    const e2eBypass = isE2EBypassActive();
    const allowE2EBypass = e2eBypass && !import.meta.env.PROD;

    if (allowE2EBypass) {
      // Only allow E2E/test override headers in non-production environments.
      headers.set('X-E2E-Bypass', 'true');
      if (!headers.has('X-User-Role')) {
        headers.set('X-User-Role', inferE2EBypassRole());
      }
      headers.delete('Authorization');
    }

    let readiness;
    try {
      readiness = await assertApiReady({
        requireAuth: shouldRequireAuth && !allowE2EBypass,
        requireOrg: shouldRequireAuth && !allowE2EBypass,
      });
    } catch (error) {
      if (error instanceof ApiReadinessError) {
        throw new NotAuthenticatedError(error.message);
      }
      throw error;
    }

    if (shouldRequireAuth && !allowE2EBypass) {
      token = readiness.session?.access_token ?? await requireSupabaseSessionToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Resolve org header; if an org id is returned, attach it to requests so
    // server-side handlers that accept client-provided orgs can use it. When
    // the resolved value is null (including the special ALL_ORGS case) do not
    // attach any org header — the backend must enforce scoping.
    // Prefer explicit global override check so we never attach org headers
    // when the platform-wide sentinel is configured.
    const globalOverride = getGlobalActiveOrgIdForApi();
    const orgId: string | null =
      globalOverride === GLOBAL_ORG_ID
        ? null
        : resolveOrgHeaderForRequest(url);

    const bodyIsFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const bodyIsString = typeof init.body === 'string';
    if (init.body && !bodyIsFormData && !bodyIsString && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    // Attach org header when we have a concrete org id. Do not attach when
    // the resolved org is null or the special ALL_ORGS sentinel.
    if (orgId) {
      if (!headers.has('X-Organization-Id')) headers.set('X-Organization-Id', orgId);
      if (!headers.has('X-Org-Id')) headers.set('X-Org-Id', orgId);
    }

    stripProductionOverrideHeaders(headers);

    if (devMode && extractPathname(url) === '/api/admin/me') {
      console.debug('[authorizedFetch][dev] /api/admin/me Authorization', {
        attached: Boolean(token),
      });
    }

    const { controller, cleanup } = createAbortController(timeoutMs, init.signal);
    let response: Response;
    const targetUrl = normalizeUrl(url);
    try {
      // Attach Authorization only for internal API requests (not external services)
      try {
        const parsed = new URL(targetUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
        const apiOrigin = new URL(resolveApiUrl('/')).origin;
        if (parsed.origin === apiOrigin && token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      } catch {
        // If URL parsing fails, fall back to attaching Authorization when we have a token.
        if (token) headers.set('Authorization', `Bearer ${token}`);
      }
      if (isAuthEndpoint(targetUrl)) {
        if (import.meta.env?.DEV) {
          console.log('[AUTH REQUEST]', targetUrl);
        }
      }
      const native = getNativeFetch();
      // In test runs prefer the global fetch so test spies/mocks observe calls.
      const fetchImpl = (isTest ? (globalThis as any).fetch : undefined) ?? native ?? fetch;
      if (devMode) {
        console.log('[REQUEST]', {
          url: targetUrl,
          hasToken: !!token,
        });
      }
      response = await fetchImpl(targetUrl, {
        ...init,
        // Ensure credentials are always included so cookies are sent for auth
        credentials: 'include',
        headers,
        signal: controller.signal,
      } as any);
      if (isAuthEndpoint(targetUrl)) {
        if (import.meta.env?.DEV) {
          console.log('[AUTH RESPONSE]', response.status);
        }
      }
      if (devMode) {
        console.info('[request_success]', { requestId, url: extractPathname(url), status: response.status, attempt });
      }
    } catch (error: any) {
      cleanup();
      console.warn('[request_failure]', { requestId, url: extractPathname(url), attempt, error });
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
    // Do not hide 401s in tests here; let callers observe the real response so
    // higher-level logic (apiRequest) can decide how to handle auth failures.

    if (response.status !== 401 || !shouldRequireAuth) {
      return response;
    }

    if (attempt === 0) {
      const isRefreshEndpoint = extractPathname(url).startsWith('/api/auth/refresh');

      if (!isRefreshEndpoint) {
        try {
          const supabase = getSupabase();
          if (supabase && typeof supabase.auth?.refreshSession === 'function') {
            const {
              data: { session },
              error,
            } = await supabase.auth.refreshSession();
            if (!error && session?.access_token) {
              attempt += 1;
              console.info('[authorizedFetch] supabase.refreshSession succeeded after 401; retrying', { url: extractPathname(url) });
              continue;
            }
          }
        } catch (err) {
          // Return the original 401 when refresh fails.
        }
      }

      // No refresh possible or refresh failed.
      return response;
    }

    return response;
  }

  // If we exhausted retries, return the 401 response (no synthetic masking).
  return new Response(null, { status: 401 });
}
