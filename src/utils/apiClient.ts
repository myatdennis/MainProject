import buildAuthHeaders, { clearSupabaseAuthSnapshot } from './requestContext';
import { buildApiUrl, assertNoDoubleApi } from '../config/apiBase';
import { shouldRequireSession, getActiveSession } from '../lib/sessionGate';
import { clearAuth } from '../lib/secureStorage';
import { getSupabase } from '../lib/supabaseClient';
import authorizedFetch, { NotAuthenticatedError, getAccessToken } from '../lib/authorizedFetch';

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
  timeoutMs?: number;
  requireAuth?: boolean;
  allowAnonymous?: boolean;
  noTransform?: boolean;
  credentials?: RequestCredentials;
};

type InternalRequestOptions = ApiRequestOptions & {
};
const devMode = Boolean(
  (import.meta as any)?.env?.DEV ?? (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'),
);

const isJsonResponse = (contentType: string | null) =>
  !!contentType && contentType.toLowerCase().includes('application/json');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

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

const CAMEL_PRESERVE_KEYS = new Set(['body']);
const shouldPreserveKey = (key: string) => {
  const normalized = key.toLowerCase();
  return CAMEL_PRESERVE_KEYS.has(normalized) || normalized.endsWith('_json');
};

const toCamelKey = (key: string) => key.replace(/_([a-z])/g, (_, c) => (c ? c.toUpperCase() : ''));
const toSnakeKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

const transformKeysDeep = (value: unknown, mode: 'camel' | 'snake', parentPreserve = false): any => {
  if (parentPreserve) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => transformKeysDeep(entry, mode, false));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const next: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    const preserve = shouldPreserveKey(key);
    const transformedKey = preserve ? key : mode === 'camel' ? toCamelKey(key) : toSnakeKey(key);
    next[transformedKey] = transformKeysDeep(entry, mode, preserve);
  }
  return next;
};

const normalizeErrorBody = (body: unknown): Record<string, any> => {
  if (isPlainObject(body)) {
    return { ...body };
  }
  if (typeof body === 'string' && body.trim()) {
    return { message: body };
  }
  if (body == null) {
    return { message: 'Too many requests' };
  }
  return { payload: body };
};

type ThrottleEntry = {
  retryAt: number;
  strikes: number;
};

const ROUTE_THROTTLE_STATE = new Map<string, ThrottleEntry>();
const BACKOFF_STEPS_MS = [500, 1500, 3000, 5000];

const getThrottleKey = (url: string): string => extractPathname(url) || url;

const clearThrottleEntry = (key: string) => {
  const existing = ROUTE_THROTTLE_STATE.get(key);
  if (existing && existing.retryAt <= Date.now()) {
    ROUTE_THROTTLE_STATE.delete(key);
  }
};

const parseRetryAfterHeader = (headerValue: string | null): number => {
  if (!headerValue) return 0;
  const numericDelay = Number(headerValue);
  if (!Number.isNaN(numericDelay) && numericDelay >= 0) {
    return Math.round(numericDelay * 1000);
  }
  const parsedDate = Date.parse(headerValue);
  if (!Number.isNaN(parsedDate)) {
    const delta = parsedDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return 0;
};

const scheduleThrottle = (key: string, delayMs: number, headerProvided: boolean) => {
  const entry = ROUTE_THROTTLE_STATE.get(key);
  const strikes = headerProvided ? 1 : Math.min((entry?.strikes ?? 0) + 1, BACKOFF_STEPS_MS.length);
  ROUTE_THROTTLE_STATE.set(key, {
    retryAt: Date.now() + delayMs,
    strikes,
  });
};

const getBackoffDelayMs = (key: string): number => {
  const entry = ROUTE_THROTTLE_STATE.get(key);
  const strikes = Math.min((entry?.strikes ?? 0) + 1, BACKOFF_STEPS_MS.length);
  return BACKOFF_STEPS_MS[strikes - 1] ?? BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1];
};

const assertNotThrottled = (url: string) => {
  const key = getThrottleKey(url);
  const entry = ROUTE_THROTTLE_STATE.get(key);
  if (entry && entry.retryAt > Date.now()) {
    const remaining = Math.max(entry.retryAt - Date.now(), 0);
    const payload = {
      throttled: true,
      retryAt: new Date(entry.retryAt).toISOString(),
      retryAfterMs: remaining,
      route: key,
    };
    throw new ApiError('Too Many Requests', 429, url, payload);
  }
  if (entry && entry.retryAt <= Date.now()) {
    ROUTE_THROTTLE_STATE.delete(key);
  }
  return key;
};

/**
 * Centralized auth failure handler: clears local state, signs out, and redirects.
 */
const handleAuthFailure = async () => {
  clearSupabaseAuthSnapshot();
  clearAuth();
  try {
    const supabase = await getSupabase();
    await supabase?.auth.signOut();
  } catch (error) {
    console.warn('[apiClient] Failed to sign out from Supabase', error);
  }
  if (typeof window !== 'undefined' && window.location) {
    window.location.replace('/admin/login');
  }
};

const buildNotAuthenticatedError = (url: string) =>
  new ApiError('Please log in again.', 401, url, {
    code: 'not_authenticated',
    message: 'Please log in again.',
  });

type UnauthorizedMeta = {
  credentials?: RequestCredentials;
};

const logUnauthorized = (url: string, status: number, body: unknown, meta?: UnauthorizedMeta) => {
  console.warn('[apiRequest] Unauthorized:', {
    url,
    status,
    body,
    credentialsEnabled: meta?.credentials ? meta.credentials !== 'omit' : true,
  });
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

const DEFAULT_TIMEOUT_MS = 15_000;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-csrf-token', 'csrf', 'x-supabase-key', 'apikey'];
const ADMIN_PATH_PATTERN = /\/api\/admin\b/i;
const AUTH_ENDPOINT_REGEX = /\/api\/auth\/(login|refresh|session)/i;
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

const redactHeaders = (headers?: Headers | Record<string, string> | null): Record<string, string> => {
  if (!headers) return {};

  const toEntries = (): Array<[string, string]> => {
    if (headers instanceof Headers) {
      const collected: Array<[string, string]> = [];
      headers.forEach((value, key) => {
        collected.push([key, value]);
      });
      return collected;
    }
    return Object.entries(headers as Record<string, string>);
  };

  return toEntries().reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = key.toLowerCase();
    acc[key] = SENSITIVE_HEADERS.includes(normalizedKey) ? '[REDACTED]' : value;
    return acc;
  }, {});
};

const shouldLogDebug = (url: string): boolean => {
  if (!import.meta.env?.DEV) return false;
  if (typeof window === 'undefined') return false;
  if (!(window as any).__API_DEBUG__) return false;
  const sensitivePath = AUTH_ENDPOINT_REGEX.test(url);
  if (sensitivePath) return false;
  return true;
};

const extractPathname = (target: string): string => {
  try {
    if (ABSOLUTE_URL_REGEX.test(target)) {
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

const PUBLIC_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/mfa/challenge',
  '/api/mfa/verify',
  '/api/health',
]);
const PUBLIC_ENDPOINT_PREFIXES = ['/api/diagnostics'];

const isPublicEndpoint = (target: string): boolean => {
  const normalized = extractPathname(target);
  if (PUBLIC_ENDPOINTS.has(normalized)) return true;
  return PUBLIC_ENDPOINT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const enforceAdminPrivileges = (
  url: string,
  allowAnonymous: boolean | undefined,
  session: ReturnType<typeof getActiveSession>,
) => {
  if (allowAnonymous || !session) return;
  const pathname = extractPathname(url);
  if (!ADMIN_PATH_PATTERN.test(pathname)) {
    return;
  }

  const hasAdminAccess =
    session?.isPlatformAdmin ||
    session?.platformRole === 'platform_admin' ||
    String(session?.role || '').toLowerCase() === 'admin';

  if (!hasAdminAccess) {
    throw new ApiError('Administrator privileges required', 403, url, {
      message: 'You need administrator access to perform this action.',
    });
  }
};

type PreparedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
  requiresSession: boolean;
  attachAuth: boolean;
  controller: AbortController;
  linkedSignals: AbortSignal[];
  abortForwarder: () => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  timeoutMs: number;
  credentials: RequestCredentials;
};

const prepareRequest = async (path: string, options: InternalRequestOptions = {}): Promise<PreparedRequest> => {
  assertNoDoubleApi(path);

  const method = options.method ?? 'GET';
  const url = buildApiUrl(path);
  const pathname = extractPathname(url);

  const requiresSession =
    shouldRequireSession(url, {
      requireAuth: options.requireAuth,
      allowAnonymous: options.allowAnonymous,
    }) && options.allowAnonymous !== true;
  const activeSession = getActiveSession();

  enforceAdminPrivileges(url, options.allowAnonymous, activeSession);

  // Build auth headers for EVERY request
  const authHeaders = await buildAuthHeaders();
  delete authHeaders.Authorization;
  const publicEndpoint = isPublicEndpoint(path);
  const attachAuth = !publicEndpoint;

  const baseHeaders: Record<string, string> = {};
  const headers = mergeHeadersSafely(baseHeaders, authHeaders, options.headers);

  if (import.meta.env?.DEV) {
    headers['X-Debug-Auth'] = attachAuth ? 'supabase' : 'public';
  }
  const methodAllowsBody = !['GET', 'HEAD'].includes(method);

  let body: BodyInit | undefined;
  if (methodAllowsBody && options.body != null) {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
    const rawBody = options.body as any;
    const isFormData = typeof FormData !== 'undefined' && rawBody instanceof FormData;
    const isBlob = typeof Blob !== 'undefined' && rawBody instanceof Blob;
    const isArrayBuffer = rawBody instanceof ArrayBuffer;
    const isArrayBufferView = typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(rawBody);
    const isSearchParams = typeof URLSearchParams !== 'undefined' && rawBody instanceof URLSearchParams;

    if (isFormData || isBlob || isArrayBuffer || isArrayBufferView || isSearchParams) {
      body = rawBody as BodyInit;
    } else if (typeof rawBody === 'string') {
      body = rawBody;
    } else if (isPlainObject(rawBody)) {
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json';
      }
      const transformedBody = options.noTransform ? rawBody : transformKeysDeep(rawBody, 'snake');
      body = JSON.stringify(transformedBody);
    } else {
      body = rawBody as BodyInit;
    }
  }
  const canLog = shouldLogDebug(url) && typeof console !== 'undefined' && typeof console.debug === 'function';
  const debugPayload = canLog
    ? {
        url,
        authMode: attachAuth ? 'supabase' : 'public',
        authHeaders: redactHeaders(authHeaders),
        mergedHeaders: redactHeaders(headers),
      }
    : null;

  const controller = new AbortController();
  const linkedSignals: AbortSignal[] = [];
  if (options.signal) {
    linkedSignals.push(options.signal);
  }
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), timeoutMs);
  }
  const abortForwarder = () => controller.abort(new DOMException('Aborted', 'AbortError'));
  linkedSignals.forEach((signal) => signal.addEventListener('abort', abortForwarder));

  if (debugPayload) {
    console.debug('[apiRequest][auth-debug]', debugPayload);
  }

  const preparedRequest: PreparedRequest = {
    url,
    method,
    headers,
    body,
    requiresSession,
    attachAuth,
    controller,
    linkedSignals,
    abortForwarder,
    timeoutId,
    timeoutMs,
    credentials: 'omit',
  };

  if (devMode) {
    const originForUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';

    let parsed: URL | null = null;
    try {
      parsed = new URL(url, originForUrl);
    } catch {
      parsed = null;
    }

  }

  return preparedRequest;
};

const executeFetch = async (input: PreparedRequest): Promise<Response> => {
  const {
    url,
    method,
    headers,
    body,
    controller,
    linkedSignals,
    abortForwarder,
    timeoutId,
    credentials,
    attachAuth,
    requiresSession,
  } = input;

  let res: Response;
  try {
    res = await authorizedFetch(
      url,
      {
        method,
        credentials,
        headers,
        body,
        signal: controller.signal,
      },
      {
        requireAuth: attachAuth && requiresSession,
        timeoutMs: input.timeoutMs,
        requestLabel: extractPathname(url),
      },
    );
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out', 0, url, { message: 'The request exceeded the allowed time.' });
    }
    if (error instanceof NotAuthenticatedError) {
      await handleAuthFailure();
      throw buildNotAuthenticatedError(url);
    }
    throw error;
  }
  if (timeoutId) clearTimeout(timeoutId);
  linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
  return res;
};

const internalAuthorizedFetch = async (
  path: string,
  options: InternalRequestOptions = {},
): Promise<Response> => {
  const prepared = await prepareRequest(path, options);

  if (prepared.attachAuth && prepared.requiresSession) {
    const token = await getAccessToken();
    if (!token) {
      await handleAuthFailure();
      throw buildNotAuthenticatedError(prepared.url);
    }
  }

  let throttleKey: string | null = null;
  throttleKey = assertNotThrottled(prepared.url);

  const res = await executeFetch(prepared);

  const contentType = res.headers.get('content-type');
  if (res.status === 401) {
    await handleAuthFailure();
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    logUnauthorized(prepared.url, res.status, body, {
      credentials: prepared.credentials,
    });
    throw new ApiError('Unauthorized', res.status, prepared.url, body);
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('retry-after');
    const retryDelayMsFromHeader = parseRetryAfterHeader(retryAfterHeader);
    const key = throttleKey ?? getThrottleKey(prepared.url);
    const delayMs = retryDelayMsFromHeader > 0 ? retryDelayMsFromHeader : getBackoffDelayMs(key);
    scheduleThrottle(key, delayMs, retryDelayMsFromHeader > 0);
    const rawBody = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    const normalizedBody = normalizeErrorBody(rawBody);
    normalizedBody.throttled = true;
    normalizedBody.retryAfterMs = delayMs;
    normalizedBody.retryAt = new Date(Date.now() + delayMs).toISOString();
    normalizedBody.route = key;
    if (!('code' in normalizedBody)) {
      normalizedBody.code = retryDelayMsFromHeader > 0 ? 'server_throttle' : 'client_throttle';
    }
    throw new ApiError('Too Many Requests', res.status, prepared.url, normalizedBody);
  }

  if (!res.ok) {
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    throw new ApiError(`Request failed with status ${res.status}`, res.status, prepared.url, body);
  }

  if (throttleKey) {
    ROUTE_THROTTLE_STATE.delete(throttleKey);
  }

  return res;
};

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const res = await internalAuthorizedFetch(path, options);
  const contentType = res.headers.get('content-type');

  // No content
  if (res.status === 204) return undefined as T;

  // Parse JSON if possible, otherwise return text
  if (isJsonResponse(contentType)) {
    const data = await safeParseJson(res);
    const transformed = options.noTransform ? data : transformKeysDeep(data, 'camel');
    return transformed as T;
  }

  const text = await safeReadText(res);
  return text as unknown as T;
}

export async function apiRequestRaw(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  return internalAuthorizedFetch(path, options);
}

export default apiRequest;
