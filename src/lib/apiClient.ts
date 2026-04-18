import { supabase } from './supabaseClient';
import { getAccessToken as getStoredAccessToken, setAccessToken, setRefreshToken } from './secureStorage';
import { LEGACY_ORG_HEADER_NAME, ORG_HEADER_NAME, resolveOrgHeaderForRequest } from './orgContext';
import { buildApiUrl } from '../config/apiBase';
import buildAuthHeaders from '../utils/requestContext';

export class NotAuthenticatedError extends Error {
  constructor(message = '[apiFetch] No Supabase session/access_token available') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

export class AuthExpiredError extends Error {
  constructor(message = '[apiFetch] Supabase session expired') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export class ApiResponseError extends Error {
  status: number;
  body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`[apiJson] ${status} ${statusText}`);
    this.name = 'ApiResponseError';
    this.status = status;
    this.body = body;
  }
}

type ApiFetchOptions = {
  timeoutMs?: number;
};

const createAbortController = (timeoutMs?: number, upstream?: AbortSignal | null) => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const abortWithReason = (reason?: any) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abortWithReason(new DOMException('Request timed out', 'AbortError'));
    }, timeoutMs);
  }

  const handleUpstreamAbort = () => abortWithReason(upstream?.reason);
  if (upstream) {
    if (upstream.aborted) {
      handleUpstreamAbort();
    } else {
      upstream.addEventListener('abort', handleUpstreamAbort);
    }
  }

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (upstream) {
      upstream.removeEventListener('abort', handleUpstreamAbort);
    }
  };

  return { controller, cleanup };
};

export async function getAccessToken(): Promise<string | null> {
  const isE2EBypass =
    typeof window !== 'undefined' &&
    (Boolean((window as any).__E2E_BYPASS) ||
      Boolean((window as any).__E2E_SUPABASE_CLIENT));
  const storedToken = getStoredAccessToken() ?? null;
  if (isE2EBypass || storedToken) {
    return storedToken;
  }
  try {
    const { getCanonicalSession, waitForAuthReady } = await import('./canonicalAuth');
    const cs = getCanonicalSession();
    if (cs && cs.accessToken) return cs.accessToken;
    const ready = await waitForAuthReady(2000).catch(() => null);
    return ready?.accessToken ?? null;
  } catch (e) {
    // If canonicalAuth isn't available, treat as unauthenticated.
    return null;
  }
}

const ensureAccessToken = async (): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new NotAuthenticatedError();
  }
  return token;
};

const shouldStringifyBody = (body: any): boolean => {
  if (body == null) return false;
  if (typeof body === 'string') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return false;
  return typeof body === 'object';
};

const withAuthHeaders = (init: RequestInit, token: string): RequestInit => {
  const headers = new Headers(init.headers ?? undefined);
  headers.set('Authorization', `Bearer ${token}`);

  let body = init.body;
  if (shouldStringifyBody(body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(body);
  }

  return { ...init, headers, body };
};

const applyOrgHeadersIfNeeded = (init: RequestInit, path: string): RequestInit => {
  const orgId = resolveOrgHeaderForRequest(path);
  if (!orgId) {
    return init;
  }
  const headers = new Headers(init.headers ?? undefined);
  headers.set(ORG_HEADER_NAME, orgId);
  headers.set(LEGACY_ORG_HEADER_NAME, orgId);
  return { ...init, headers };
};

export async function apiFetchRaw(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const url = buildApiUrl(path);
  let attempt = 0;
  let authHeaders = await buildAuthHeaders();
  let token = authHeaders.Authorization?.replace(/^Bearer\s+/i, '') ?? null;
  if (!token) {
    token = await ensureAccessToken();
    authHeaders = {
      ...authHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  while (attempt < 2) {
    let requestInit: RequestInit = {
      ...init,
      headers: new Headers({
        ...(authHeaders as Record<string, string>),
        ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers as Record<string, string> | undefined) ?? {}),
      }),
    };
    requestInit = withAuthHeaders(requestInit, token);
    requestInit = applyOrgHeadersIfNeeded(requestInit, path);
    const { controller, cleanup } = createAbortController(options.timeoutMs, init.signal ?? null);

    let response: Response;
    try {
      response = await fetch(url, { ...requestInit, signal: controller.signal });
    } catch (error: any) {
      cleanup();
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    }
    cleanup();

    if (response.status !== 401) {
      return response;
    }

    if (attempt === 1) {
      throw new AuthExpiredError('[apiFetch] API still 401 after refresh; treating as logged-out');
    }

    const { data, error } = await supabase.auth.refreshSession();
    attempt += 1;
    if (error) {
      throw new AuthExpiredError(`[apiFetch] refreshSession failed: ${error.message}`);
    }
    token = data?.session?.access_token ?? null;
    if (!token) {
      throw new AuthExpiredError('[apiFetch] refreshSession returned no access_token');
    }
    setAccessToken(token, 'libApiClient:refresh');
    if (data?.session?.refresh_token) {
      setRefreshToken(data.session.refresh_token, 'libApiClient:refresh');
    }
    authHeaders = {
      ...authHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  throw new AuthExpiredError('[apiFetch] Unable to satisfy request');
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const response = await apiFetchRaw(path, init, options);
  const text = await response.text();
  if (!response.ok) {
    let parsedBody: any = null;
    try {
      parsedBody = text ? JSON.parse(text) : null;
    } catch {
      parsedBody = null;
    }
    const errorPayload =
      parsedBody && typeof parsedBody === 'object'
        ? parsedBody
        : text || null;
    const logPayload = {
      path,
      status: response.status,
      statusText: response.statusText,
      code: parsedBody?.code ?? parsedBody?.error ?? null,
      message: parsedBody?.message ?? null,
      hint: parsedBody?.hint ?? null,
      body: errorPayload,
    };
    console.error('[apiFetch] non_ok_response', logPayload);
    throw new ApiResponseError(response.status, response.statusText, text);
  }
  if (!text) {
    return null as T;
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T;
  }
  return text as unknown as T;
}

export async function apiJson<T>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, init, options);
}
