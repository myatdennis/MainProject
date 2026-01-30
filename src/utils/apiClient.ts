import buildAuthHeaders, { clearSupabaseAuthSnapshot, type AuthHeaderSource } from './requestContext';
import { buildApiUrl, assertNoDoubleApi } from '../config/apiBase';

export class ApiError extends Error {
  status: number;
  url: string;
  body: unknown;

  constructor(message: string, status: number, url: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiRequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const isJsonResponse = (contentType: string | null) =>
  !!contentType && contentType.toLowerCase().includes('application/json');

const safeParseJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const safeReadText = async (res: Response) => {
  try {
    return await res.text();
  } catch {
    return '';
  }
};

const logUnauthorized = (url: string, status: number, body: unknown) => {
  console.warn('[apiRequest] Unauthorized:', { url, status, body });
};

const mergeHeadersSafely = (
  base: Record<string, string>,
  auth: Record<string, string>,
  extra?: Record<string, string>
) => {
  // Important: auth should win over extra if extra tries to overwrite Authorization
  // but we also allow caller to set Authorization explicitly if they truly want to.
  const merged: Record<string, string> = { ...base, ...auth, ...(extra ?? {}) };

  // If caller passed Authorization: '' accidentally, restore auth Authorization.
  if (
    auth.Authorization &&
    (merged.Authorization === '' || merged.Authorization === undefined || merged.Authorization === null)
  ) {
    merged.Authorization = auth.Authorization;
  }

  return merged;
};

const readAuthSource = (headers: Record<string, string>): AuthHeaderSource => {
  const meta = (headers as { __authSource?: AuthHeaderSource }).__authSource;
  return meta ?? 'none';
};

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  assertNoDoubleApi(path);

  const method = options.method ?? 'GET';
  const url = buildApiUrl(path);

  // Build auth headers for EVERY request
  const authHeaders = await buildAuthHeaders();
  let authSource = readAuthSource(authHeaders);

  const baseHeaders: Record<string, string> = {};
  const hasBody = method !== 'GET' && method !== 'DELETE' && options.body !== undefined;

  if (hasBody) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  const headers = mergeHeadersSafely(baseHeaders, authHeaders, options.headers);
  const hasAuthorization = Boolean(headers.Authorization);
  const debugAuthSource: AuthHeaderSource | 'custom' =
    hasAuthorization && authSource === 'none' ? 'custom' : hasAuthorization ? authSource : 'none';

  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[apiRequest][auth-debug]', {
      url,
      hasAuthorization,
      authSource: debugAuthSource,
    });
  }

  const res = await fetch(url, {
    method,
    // Keep cookies enabled (safe even with Bearer tokens)
    credentials: 'include',
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const contentType = res.headers.get('content-type');

  // Handle 401: clear snapshot cache so next request re-resolves Supabase session
  if (res.status === 401) {
    clearSupabaseAuthSnapshot();
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    logUnauthorized(url, res.status, body);
    throw new ApiError('Unauthorized', res.status, url, body);
  }

  if (!res.ok) {
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    throw new ApiError(`Request failed with status ${res.status}`, res.status, url, body);
  }

  // No content
  if (res.status === 204) return undefined as T;

  // Parse JSON if possible, otherwise return text
  if (isJsonResponse(contentType)) {
    const data = await safeParseJson(res);
    return data as T;
  }

  const text = await safeReadText(res);
  return text as unknown as T;
}

export default apiRequest;
