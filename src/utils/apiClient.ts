import buildAuthHeaders from './requestContext';
import { buildApiUrl, assertNoDoubleApi } from '../config/apiBase';
import { guardRequest, SessionGateError } from '../lib/sessionGate';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';

const logApiDebug = (meta: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.debug('apiRequest', meta);
  }
};

// Key transform utilities to normalize wire format (snake_case) <-> client (camelCase)
const isObject = (val: any) => Object.prototype.toString.call(val) === '[object Object]';

const toSnake = (str: string) =>
  str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

const toCamel = (str: string) => str.replace(/[_-](\w)/g, (_, c) => (c ? c.toUpperCase() : ''));

// Avoid transforming arbitrary nested JSON blobs (e.g., lesson content bodies)
// When skip is true, we avoid transforming BOTH the key and its nested children.
const shouldSkipKeyTransform = (parentKey: string | null, key: string): boolean => {
  // Do not transform content bodies or any *_json blobs (and do not recurse into them)
  if (key === 'body') return true;
  if (key.endsWith('_json')) return true;
  if (parentKey && (parentKey.endsWith('_json') || parentKey === 'content' || parentKey === 'metadata')) return true;
  return false;
};

const transformKeysDeep = (
  input: any,
  direction: 'toSnake' | 'toCamel',
  parentKey: string | null = null,
): any => {
  if (Array.isArray(input)) {
    return input.map((v) => transformKeysDeep(v, direction, parentKey));
  }
  if (!isObject(input)) return input;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    const skip = shouldSkipKeyTransform(parentKey, k);
    const nextKey = skip ? k : direction === 'toSnake' ? toSnake(k) : toCamel(k);
    // If this key should be skipped, assign value as-is without recursing
    out[nextKey] = skip ? v : transformKeysDeep(v, direction, nextKey);
  }
  return out;
};

const buildUrl = (path: string) => buildApiUrl(path);

type SupabaseAuthCache = {
  token: string;
  expiresAt: number;
};

const SUPABASE_TOKEN_SKEW_MS = 30 * 1000;
let supabaseAuthCache: SupabaseAuthCache | null = null;
const clearSupabaseAuthCache = () => {
  supabaseAuthCache = null;
};

const resolveSupabaseAccessToken = async (): Promise<string | null> => {
  if (!hasSupabaseConfig) return null;
  if (supabaseAuthCache && supabaseAuthCache.expiresAt - SUPABASE_TOKEN_SKEW_MS > Date.now()) {
    return supabaseAuthCache.token;
  }

  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[apiRequest] Failed to resolve Supabase session:', error.message || error);
      return null;
    }
    const session = data?.session;
    const token = session?.access_token ?? null;
    if (!token) {
      clearSupabaseAuthCache();
      return null;
    }
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : Date.now() + 60 * 1000;
    supabaseAuthCache = { token, expiresAt };
    return token;
  } catch (err) {
    console.warn('[apiRequest] Supabase session lookup failed:', err);
    return null;
  }
};

const ensureSupabaseAuthHeader = async (headers: Headers) => {
  if (headers.has('Authorization')) return;
  const token = await resolveSupabaseAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
};

const logUnauthorized = (url: string, status: number, body: unknown) => {
  let preview: string;
  try {
    preview =
      typeof body === 'string'
        ? body
        : body
        ? JSON.stringify(body)
        : '(empty response body)';
  } catch {
    preview = String(body ?? '(unreadable body)');
  }
  console.warn('[apiRequest] 401 Unauthorized', { url, status, body: preview });
};

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface ApiRequestOptions extends RequestInit {
  /**
   * Additional expected HTTP status codes besides the 2xx range.
   */
  expectedStatus?: number | number[];
  /**
   * Optional validation step for the parsed response body.
   */
  validate?: (data: any) => void;
  /**
   * Skip JSON parsing even if content-type is application/json.
   */
  rawResponse?: boolean;
  /**
   * Disable automatic camel/snake case transformation.
   */
  noTransform?: boolean;
  /**
   * Optional timeout in milliseconds. If exceeded, the request is aborted.
   */
  timeoutMs?: number;
  /**
   * Force authentication even if the path isn't in the privileged list.
   */
  requireAuth?: boolean;
  /**
   * Allow anonymous access even when the path would normally be gated.
   */
  allowAnonymous?: boolean;
}


const shouldParseJson = (response: Response, options: ApiRequestOptions) => {
  if (options.rawResponse) return false;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json');
};

const statusMatches = (status: number, expected?: number | number[]) => {
  if (!expected) return false;
  if (Array.isArray(expected)) return expected.includes(status);
  return expected === status;
};

export const apiRequest = async <T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const headers = options.headers instanceof Headers ? new Headers(options.headers) : new Headers(options.headers ?? {});
  const bodyIsFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const method = options.method ? options.method.toUpperCase() : 'GET';
  
  try {
    const authHeaders = await buildAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (value && !headers.has(key)) {
        headers.set(key, value);
      }
    });
  } catch (error) {
    console.warn('[apiRequest] Proceeding without auth headers due to error:', error);
  }
  await ensureSupabaseAuthHeader(headers);

  if (!bodyIsFormData && !headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  // Normalize outgoing JSON body to snake_case unless disabled
  let body = options.body as any;
  if (!options.noTransform && body && typeof body === 'string' && headers.get('Content-Type')?.includes('application/json')) {
    try {
      const parsed = JSON.parse(body);
      body = JSON.stringify(transformKeysDeep(parsed, 'toSnake'));
    } catch {
      // leave as-is if parsing fails
    }
  }

  // Compose AbortController for timeout and external signal
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  if (options.signal) signals.push(options.signal);
  const timeout = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), options.timeoutMs)
    : null;
  const onExternalAbort = () => controller.abort(new DOMException('Aborted', 'AbortError'));
  signals.forEach((sig) => sig.addEventListener('abort', onExternalAbort));

  const requestInit: RequestInit = {
    ...options,
    method,
    signal: controller.signal,
    headers,
    body,
  };

  if (typeof requestInit.credentials === 'undefined') {
    requestInit.credentials = 'include';
  }

  const url = buildUrl(path);
  assertNoDoubleApi(url);

  try {
    guardRequest(url, {
      requireAuth: options.requireAuth,
      allowAnonymous: options.allowAnonymous,
      reason: 'Blocked request with no authenticated session',
    });
  } catch (error) {
    if (error instanceof SessionGateError) {
      throw new ApiError(401, 'No authenticated session available', null, 'session_required');
    }
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (err: any) {
    if (timeout) clearTimeout(timeout as any);
    signals.forEach((sig) => sig.removeEventListener('abort', onExternalAbort));
    if (err?.name === 'AbortError') {
      throw new ApiError(0, 'Request aborted (timeout or cancel)', null, 'timeout');
    }
    throw err;
  }
  logApiDebug({ url, status: response.status, ok: response.ok });

  const okStatus = response.ok || statusMatches(response.status, options.expectedStatus);

  if (options.rawResponse) {
    if (!okStatus) {
      let responseText: string | null = null;
      try {
        responseText = await response.text();
      } catch (readError) {
        console.warn('[apiRequest] Failed to read raw response body', {
          url,
          status: response.status,
          error: readError,
        });
      }
      if (response.status === 401) {
        clearSupabaseAuthCache();
        logUnauthorized(url, response.status, responseText);
      }
      const message = responseText || `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message, responseText);
    }
    if (timeout) clearTimeout(timeout as any);
    signals.forEach((sig) => sig.removeEventListener('abort', onExternalAbort));
    return response as unknown as T;
  }

  const parseJson = shouldParseJson(response, options);
  let responseBody: unknown = null;

  if (parseJson) {
    try {
  const raw = await response.json();
  responseBody = options.noTransform ? raw : transformKeysDeep(raw, 'toCamel');
    } catch (error) {
      console.error('[apiRequest] Failed to parse JSON:', error);
      if (okStatus) {
        throw new ApiError(response.status, 'Failed to parse JSON response', null);
      }
    }
  } else if (!okStatus) {
    responseBody = await response.text();
  }

  if (!okStatus) {
    if (response.status === 401) {
      clearSupabaseAuthCache();
      logUnauthorized(url, response.status, responseBody);
    } else {
      console.error('[apiRequest] Request failed with status:', response.status);
    }
    const errorMessage =
      typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody
        ? String((responseBody as any).message)
        : `Request failed with status ${response.status}`;
    const errorCode =
      typeof responseBody === 'object' && responseBody !== null && 'code' in responseBody
        ? String((responseBody as any).code)
        : undefined;
    throw new ApiError(response.status, errorMessage, responseBody, errorCode);
  }

  if (options.validate) {
    options.validate(responseBody);
  }

  if (timeout) clearTimeout(timeout as any);
  signals.forEach((sig) => sig.removeEventListener('abort', onExternalAbort));
  return responseBody as T;
};

export default apiRequest;
