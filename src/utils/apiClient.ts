import buildAuthHeaders, { clearSupabaseAuthSnapshot, type AuthHeaderSource } from './requestContext';
import { buildApiUrl, assertNoDoubleApi } from '../config/apiBase';
import { shouldRequireSession, getActiveSession } from '../lib/sessionGate';
import { queueRefresh } from '../lib/refreshQueue';
import {
  getAccessToken as getStoredAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setSessionMetadata,
  clearAuth,
  setUserSession,
  setActiveOrgPreference,
} from '../lib/secureStorage';
import type { UserSession, SessionMetadata } from '../lib/secureStorage';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';

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
};

type InternalRequestOptions = ApiRequestOptions & {
  __retriedAfterRefresh?: boolean;
};

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

type SessionBootstrapPayload = {
  user?: UserSession | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  refreshExpiresAt?: number | null;
  activeOrgId?: string | null;
};

type AccessTokenResult = {
  token: string | null;
  source: AuthHeaderSource | null;
};

type HasSupabaseConfigExport = boolean | (() => boolean);

const isSupabaseConfigured = (): boolean => {
  const value = hasSupabaseConfig as HasSupabaseConfigExport;
  return typeof value === 'function' ? value() : Boolean(value);
};

const buildNotAuthenticatedError = (url: string) =>
  new ApiError('Please log in again.', 401, url, {
    code: 'not_authenticated',
    message: 'Please log in again.',
  });

const buildNetworkError = (url: string) =>
  new ApiError('Network error—please try again.', 0, url, {
    code: 'network_error',
    message: 'Network error—please try again.',
  });

const applySessionBootstrap = (payload: SessionBootstrapPayload | null, reason: string): boolean => {
  if (!payload?.user) {
    return false;
  }

  setUserSession(payload.user);

  if (payload.activeOrgId !== undefined) {
    setActiveOrgPreference(payload.activeOrgId);
  }

  const metadata: SessionMetadata = {};

  if (payload.accessToken) {
    setAccessToken(payload.accessToken, reason);
    metadata.accessIssuedAt = Date.now();
    if (payload.expiresAt) {
      metadata.accessExpiresAt = payload.expiresAt;
    }
  }

  if (payload.refreshToken) {
    setRefreshToken(payload.refreshToken, reason);
    metadata.refreshIssuedAt = Date.now();
    if (payload.refreshExpiresAt) {
      metadata.refreshExpiresAt = payload.refreshExpiresAt;
    }
  }

  if (Object.keys(metadata).length > 0) {
    setSessionMetadata(metadata);
  }

  return true;
};

const resolveAccessToken = async (): Promise<AccessTokenResult> => {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (!error) {
          const token = data?.session?.access_token ?? null;
          if (token) {
            return { token, source: 'supabase' };
          }
        } else if (import.meta.env?.DEV) {
          console.debug('[apiClient] Supabase session error', error.message || error);
        }
      }
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.debug('[apiClient] Supabase token lookup failed', error);
      }
    }
  }

  try {
    const stored = getStoredAccessToken();
    if (stored) {
      return { token: stored, source: 'secureStorage' };
    }
  } catch (error) {
    console.warn('[apiClient] Failed to read stored access token', error);
  }

  return { token: null, source: null };
};

const bootstrapSessionFromServer = async (): Promise<boolean> => {
  const sessionPath = '/api/auth/session';
  const sessionUrl = buildApiUrl(sessionPath);
  let response: Response;
  try {
    response = await apiRequestRaw(sessionPath, {
      method: 'GET',
      allowAnonymous: true,
      requireAuth: false,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        throw buildNotAuthenticatedError(sessionUrl);
      }
      if (error.status === 0) {
        throw buildNetworkError(sessionUrl);
      }
      throw error;
    }
    throw buildNetworkError(sessionUrl);
  }

  if (response.status === 401 || response.status === 403) {
    throw buildNotAuthenticatedError(sessionUrl);
  }

  const contentType = response.headers.get('content-type');
  const payload = (isJsonResponse(contentType) ? await safeParseJson(response) : await safeReadText(response)) as
    | SessionBootstrapPayload
    | null;

  if (!response.ok) {
    throw new ApiError(`Failed to load session (${response.status})`, response.status, sessionUrl, payload);
  }

  return applySessionBootstrap(payload, 'api_client_session_bootstrap');
};

const ensureSessionViaRefresh = async (): Promise<boolean> => {
  const refreshUrl = buildApiUrl('/api/auth/refresh');

  return queueRefresh(async () => {
    let response: Response;
    try {
      response = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw buildNetworkError(refreshUrl);
      }
      if (error instanceof TypeError) {
        throw buildNetworkError(refreshUrl);
      }
      throw error;
    }

    const contentType = response.headers.get('content-type');
    const payload = (isJsonResponse(contentType) ? await safeParseJson(response) : await safeReadText(response)) as
      | SessionBootstrapPayload
      | null;

    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Please log in again.', response.status, refreshUrl, {
        code: 'not_authenticated',
        message: 'Please log in again.',
        details: payload,
      });
    }

    if (!response.ok) {
      throw new ApiError(`Refresh failed with status ${response.status}`, response.status, refreshUrl, payload);
    }

    const applied = applySessionBootstrap(payload, 'api_client_refresh');
    return applied;
  });
};

const SESSION_ENDPOINT_REGEX = /\/api\/auth\/session/i;

const containsNoTokenMessage = (payload: unknown): boolean => {
  const checkValue = (value: unknown) =>
    typeof value === 'string' && value.toLowerCase().includes('no token provided');
  if (!payload) return false;
  if (checkValue(payload)) return true;
  if (typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    return ['message', 'error', 'code', 'detail'].some((key) => checkValue(data[key]));
  }
  return false;
};

const isSessionPath = (target: string): boolean => SESSION_ENDPOINT_REGEX.test(extractPathname(target));

type UnauthorizedMeta = {
  hasAuthorization?: boolean;
  credentials?: RequestCredentials;
};

const logUnauthorized = (url: string, status: number, body: unknown, meta?: UnauthorizedMeta) => {
  if (status === 401 && isSessionPath(url) && containsNoTokenMessage(body)) {
    return;
  }
  if (status === 401 && SESSION_ENDPOINT_REGEX.test(extractPathname(url))) {
    const bodyDetails =
      body && typeof body === 'object'
        ? {
            message: (body as Record<string, unknown>).message,
            code: (body as Record<string, unknown>).code,
          }
        : { message: typeof body === 'string' ? body : undefined, code: undefined };
    console.debug('[apiRequest][session-unauthorized]', {
      url,
      hasAuthorization: Boolean(meta?.hasAuthorization),
      credentialsEnabled: meta?.credentials ? meta.credentials !== 'omit' : true,
      ...bodyDetails,
    });
  }

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

const DEFAULT_TIMEOUT_MS = 15_000;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-csrf-token', 'csrf', 'x-supabase-key', 'apikey'];
const ADMIN_PATH_PATTERN = /\/api\/admin\b/i;
const AUTH_ENDPOINT_REGEX = /\/api\/auth\/(login|refresh|session)/i;
const REFRESH_ENDPOINT_REGEX = /\/api\/auth\/refresh\b/i;
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const REFRESH_CHANNEL_NAME = 'auth';
const REFRESH_WAIT_TIMEOUT = 5000;

type RefreshEvent = {
  type: 'REFRESH';
  status: 'started' | 'success' | 'failure';
  ts: number;
  sourceId?: string;
};

const refreshChannel =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(REFRESH_CHANNEL_NAME)
    : null;

const REFRESH_SOURCE_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `auth-refresh-${Math.random().toString(16).slice(2)}`;

let refreshInProgress = false;
let refreshWaiters: Array<(ok: boolean) => void> = [];

const notifyRefreshWaiters = (ok: boolean) => {
  if (refreshWaiters.length === 0) return;
  const pending = [...refreshWaiters];
  refreshWaiters = [];
  pending.forEach((resolve) => {
    try {
      resolve(ok);
    } catch (error) {
      console.warn('[apiRequest] Failed to notify refresh waiter', error);
    }
  });
};

const applyRefreshEventLocally = (event: RefreshEvent) => {
  if (!event || typeof event !== 'object') return;
  if (event.type !== 'REFRESH') return;
  if (event.status === 'started') {
    refreshInProgress = true;
    return;
  }
  const ok = event.status === 'success';
  refreshInProgress = false;
  notifyRefreshWaiters(ok);
};

const handleExternalRefreshEvent = (event: unknown) => {
  if (!event || typeof event !== 'object') return;
  const payload = event as RefreshEvent;
  if (payload.sourceId && payload.sourceId === REFRESH_SOURCE_ID) {
    return;
  }
  applyRefreshEventLocally(payload);
};

const broadcastRefreshEvent = (status: RefreshEvent['status']) => {
  const payload: RefreshEvent = { type: 'REFRESH', status, ts: Date.now(), sourceId: REFRESH_SOURCE_ID };
  applyRefreshEventLocally(payload);
  try {
    refreshChannel?.postMessage(payload);
  } catch (error) {
    console.warn('[apiRequest] Failed to broadcast refresh event via channel', error);
  }
};

if (refreshChannel) {
  refreshChannel.addEventListener('message', (event) => handleExternalRefreshEvent(event.data));
}

const waitForRefreshCompletion = (): Promise<boolean> => {
  if (!refreshInProgress) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const callback = (ok: boolean) => {
      cleanup();
      resolve(ok);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, REFRESH_WAIT_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeoutId);
      refreshWaiters = refreshWaiters.filter((fn) => fn !== callback);
    };

    refreshWaiters.push(callback);
  });
};

const markRefreshStarted = () => {
  broadcastRefreshEvent('started');
};

const markRefreshFinished = (ok: boolean) => {
  broadcastRefreshEvent(ok ? 'success' : 'failure');
};

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
  controller: AbortController;
  linkedSignals: AbortSignal[];
  abortForwarder: () => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  hasAuthorization: boolean;
  credentials: RequestCredentials;
};

const prepareRequest = async (path: string, options: InternalRequestOptions = {}): Promise<PreparedRequest> => {
  assertNoDoubleApi(path);

  const method = options.method ?? 'GET';
  const url = buildApiUrl(path);

  const requiresSession =
    shouldRequireSession(url, {
      requireAuth: options.requireAuth,
      allowAnonymous: options.allowAnonymous,
    }) && options.allowAnonymous !== true;
  let activeSession = getActiveSession();

  enforceAdminPrivileges(url, options.allowAnonymous, activeSession);

  // Build auth headers for EVERY request
  const authHeaders = await buildAuthHeaders();
  let overrideAuthSource: AuthHeaderSource | null = null;

  if (!authHeaders.Authorization) {
    const { token, source } = await resolveAccessToken();
    if (token) {
      authHeaders.Authorization = `Bearer ${token}`;
      overrideAuthSource = source;
    }
  }

  let authSource: AuthHeaderSource | 'custom' = overrideAuthSource ?? readAuthSource(authHeaders);

  const baseHeaders: Record<string, string> = {};
  const headers = mergeHeadersSafely(baseHeaders, authHeaders, options.headers);

  if (import.meta.env?.DEV) {
    headers['X-Debug-Auth'] = authHeaders.Authorization ? (overrideAuthSource ?? readAuthSource(authHeaders) ?? 'none') : 'none';
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
      body = JSON.stringify(rawBody);
    } else {
      body = rawBody as BodyInit;
    }
  }
  const hasAuthorization = Boolean(headers.Authorization);
  if (!['secureStorage', 'supabase'].includes(authSource) && hasAuthorization) {
    authSource = 'custom';
  }
  const debugAuthSource: AuthHeaderSource | 'custom' =
    hasAuthorization && authSource === 'none' ? 'custom' : hasAuthorization ? authSource : 'none';

  const canLog = shouldLogDebug(url) && typeof console !== 'undefined' && typeof console.debug === 'function';
  const debugPayload = canLog
    ? {
        url,
        hasAuthorization,
        authSource: debugAuthSource,
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

  return {
    url,
    method,
    headers,
    body,
    requiresSession,
    controller,
    linkedSignals,
    abortForwarder,
    timeoutId,
    hasAuthorization,
    credentials: 'include',
  };
};

const executeFetch = async (input: PreparedRequest): Promise<Response> => {
  const { url, method, headers, body, controller, linkedSignals, abortForwarder, timeoutId, credentials } = input;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out', 0, url, { message: 'The request exceeded the allowed time.' });
    }
    throw error;
  }
  if (timeoutId) clearTimeout(timeoutId);
  linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
  return res;
};

const isRefreshPath = (url: string): boolean => {
  const pathname = extractPathname(url);
  return REFRESH_ENDPOINT_REGEX.test(pathname);
};

const sendRequest = async (path: string, options: InternalRequestOptions = {}): Promise<Response> => {
  const prepared = await prepareRequest(path, options);
  const isAdminRequest = ADMIN_PATH_PATTERN.test(extractPathname(prepared.url));
  let activeSession = getActiveSession();
  if (import.meta.env?.VITEST && isAdminRequest) {
    console.debug('[apiClient][admin-check]', {
      hasSessionBeforeRefresh: Boolean(activeSession),
      hasAuthHeader: prepared.hasAuthorization,
    });
  }
  const isRefreshRequest = isRefreshPath(prepared.url);
  const requiresSession = prepared.requiresSession;

  if (requiresSession && !activeSession && !prepared.hasAuthorization) {
    try {
      const refreshed = await ensureSessionViaRefresh();
      if (refreshed) {
        await bootstrapSessionFromServer();
      }
      activeSession = getActiveSession();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw buildNetworkError(prepared.url);
    }

    if (!activeSession) {
      if (isAdminRequest) {
        throw new ApiError('Authentication required', 401, prepared.url, {
          message: 'Please sign in to continue.',
        });
      }
      throw buildNotAuthenticatedError(prepared.url);
    }
  }

  if (isRefreshRequest) {
    markRefreshStarted();
  }

  let res: Response;
  try {
    res = await executeFetch(prepared);
  } catch (error) {
    if (isRefreshRequest) {
      markRefreshFinished(false);
    }
    throw error;
  }

  if (isRefreshRequest) {
    markRefreshFinished(res.ok);
  }

  const contentType = res.headers.get('content-type');
  if (res.status === 401) {
    const canWaitForRefresh =
      !options.__retriedAfterRefresh &&
      !isRefreshRequest &&
      refreshInProgress;

    if (canWaitForRefresh) {
      const refreshResult = await waitForRefreshCompletion();
      if (refreshResult) {
        const retryOptions: InternalRequestOptions = { ...options, __retriedAfterRefresh: true };
        return sendRequest(path, retryOptions);
      }
    }

    clearSupabaseAuthSnapshot();
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    logUnauthorized(prepared.url, res.status, body, {
      hasAuthorization: prepared.hasAuthorization,
      credentials: prepared.credentials,
    });
    throw new ApiError('Unauthorized', res.status, prepared.url, body);
  }

  if (!res.ok) {
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    throw new ApiError(`Request failed with status ${res.status}`, res.status, prepared.url, body);
  }

  return res;
};

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await sendRequest(path, options);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      isSessionPath(path) &&
      containsNoTokenMessage(error.body)
    ) {
      return null as T;
    }
    throw error;
  }

  const contentType = res.headers.get('content-type');

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

export async function apiRequestRaw(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  return sendRequest(path, options);
}

export default apiRequest;
