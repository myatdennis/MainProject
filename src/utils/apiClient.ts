import buildAuthHeaders, { clearSupabaseAuthSnapshot, type AuthHeaderSource } from './requestContext';
import { buildApiUrl, assertNoDoubleApi } from '../config/apiBase';
import { guardRequest, SessionGateError, shouldRequireSession, getActiveSession } from '../lib/sessionGate';
import { queueRefresh } from '../lib/refreshQueue';
import {
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setSessionMetadata,
  clearAuth,
  setUserSession,
  setActiveOrgPreference,
} from '../lib/secureStorage';
import type { UserSession, SessionMetadata } from '../lib/secureStorage';

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

const bootstrapSessionFromServer = async (): Promise<boolean> => {
  const sessionUrl = buildApiUrl('/api/auth/session');
  let response: Response;
  try {
    response = await fetch(sessionUrl, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw buildNetworkError(sessionUrl);
    }
    if (error instanceof TypeError) {
      throw buildNetworkError(sessionUrl);
    }
    throw error;
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

const DEFAULT_TIMEOUT_MS = 15_000;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-csrf-token', 'csrf', 'x-supabase-key', 'apikey'];
const ADMIN_PATH_PATTERN = /\/api\/admin\b/i;
const AUTH_ENDPOINT_REGEX = /\/api\/auth\/(login|refresh|session)/i;
const REFRESH_ENDPOINT_REGEX = /\/api\/auth\/refresh\b/i;
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const REFRESH_CHANNEL_NAME = 'auth';
const REFRESH_WAIT_TIMEOUT = 5000;
const REFRESH_STORAGE_KEY = '__auth_refresh_event__';

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
  if (!refreshChannel && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify({ ...payload, sourceId: payload.sourceId ?? REFRESH_SOURCE_ID }));
    } catch (error) {
      console.warn('[apiRequest] Failed to broadcast refresh event via storage', error);
    }
  }
};

if (refreshChannel) {
  refreshChannel.addEventListener('message', (event) => handleExternalRefreshEvent(event.data));
} else if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== REFRESH_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as RefreshEvent;
      handleExternalRefreshEvent(parsed);
    } catch (error) {
      console.warn('[apiRequest] Failed to parse refresh event from storage', error);
    }
  });
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
  if (allowAnonymous) return;
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

const prepareRequest = async (path: string, options: InternalRequestOptions = {}) => {
  assertNoDoubleApi(path);

  const method = options.method ?? 'GET';
  const url = buildApiUrl(path);

  try {
    guardRequest(url, {
      requireAuth: options.requireAuth,
      allowAnonymous: options.allowAnonymous,
      reason: 'Blocked request with no authenticated session',
    });
  } catch (error) {
    if (error instanceof SessionGateError) {
      throw new ApiError('Authentication required', 401, url, {
        message: 'Please sign in to continue.',
      });
    }
    throw error;
  }

  const requiresAuth = shouldRequireSession(url, {
    requireAuth: options.requireAuth,
    allowAnonymous: options.allowAnonymous,
  });
  const activeSession = getActiveSession();
  if (requiresAuth && !options.allowAnonymous && !activeSession) {
    const message = 'Your session is out of sync. Please refresh the page to continue.';
    throw new ApiError(message, 401, url, {
      code: 'session_desynced',
      message,
    });
  }

  enforceAdminPrivileges(url, options.allowAnonymous, activeSession);

  // Build auth headers for EVERY request
  const authHeaders = await buildAuthHeaders();
  let authSource: AuthHeaderSource | 'custom' = readAuthSource(authHeaders);

  const baseHeaders: Record<string, string> = {};
  const headers = mergeHeadersSafely(baseHeaders, authHeaders, options.headers);
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

  if (requiresAuth && activeSession && !hasAuthorization) {
    throw new ApiError('Missing authorization token', 401, url, {
      message: 'Secure session token missing. Please sign in again.',
    });
  }

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
    controller,
    linkedSignals,
    abortForwarder,
    timeoutId,
  };
};

const executeFetch = async (
  input: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    controller: AbortController;
    linkedSignals: AbortSignal[];
    abortForwarder: () => void;
    timeoutId: ReturnType<typeof setTimeout> | null;
  },
): Promise<Response> => {
  const { url, method, headers, body, controller, linkedSignals, abortForwarder, timeoutId } = input;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
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
  const isRefreshRequest = isRefreshPath(prepared.url);
  const requiresSession =
    shouldRequireSession(path, { requireAuth: options.requireAuth, allowAnonymous: options.allowAnonymous }) &&
    !options.allowAnonymous;
  let activeSession = getActiveSession();

  if (requiresSession && !activeSession) {
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
    logUnauthorized(prepared.url, res.status, body);
    throw new ApiError('Unauthorized', res.status, prepared.url, body);
  }

  if (!res.ok) {
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    throw new ApiError(`Request failed with status ${res.status}`, res.status, prepared.url, body);
  }

  return res;
};

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const res = await sendRequest(path, options);

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
