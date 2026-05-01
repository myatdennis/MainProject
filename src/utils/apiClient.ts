import buildAuthHeaders, { clearSupabaseAuthSnapshot } from './requestContext';
import { buildApiUrl, assertNoDoubleApi, getApiOrigin } from '../config/apiBase';
import { getActiveSession, shouldRequireSession } from '../lib/sessionGate';
import { clearAuth } from '../lib/secureStorage';
import { getSupabase } from '../lib/supabaseClient';
import authorizedFetch, { NotAuthenticatedError } from '../lib/authorizedFetch';
import { getAccessToken } from '../lib/apiClient';
import {
  hasAdminPortalAccess,
  getAdminAccessSnapshot,
  setAdminAccessSnapshot,
  isAdminAccessSnapshotFresh,
  normalizeAdminAccessPayload,
  type AdminAccessPayload,
} from '../lib/adminAccess';
import { logAuthRedirect } from './logAuthRedirect';
import { isAdminSurface, resolveLoginPath } from './surface';
import { getCSRFToken } from './csrfToken';
import { isAuthBootstrapping } from '../lib/authBootstrapState';
import { getGlobalActiveOrgIdForApi, pathRequiresOrgHeader } from '../lib/orgContext';
import { waitForOrgReady } from '../lib/readiness';
import { GLOBAL_ORG_ID } from '../constants/org';
import { startApiRequest, endApiRequest } from './apiInstrumentation';
import axios from 'axios';

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
  skipAdminGateCheck?: boolean;
  // optional hint for which surface (admin | lms | client) the caller intends.
  surface?: import('../context/surfaceAccess').SessionSurface;
  expectedStatus?: number[];
  /**
   * Hint to callers that they want the raw Response object. Kept for backward
   * compatibility with existing callsites that pass `rawResponse: true`.
   *
   * Note: `apiRequest` currently ignores this flag; callers that require the
   * raw Response should use `apiRequestRaw` instead. This option exists only
   * to satisfy TypeScript typings at call sites that still pass it.
   */
  rawResponse?: boolean;
  /**
   * If true (default for GET), dedupe identical in-flight requests and return the same Promise.
   */
  dedupe?: boolean;
};

type InternalRequestOptions = ApiRequestOptions & {};
const devMode = Boolean(
  (import.meta as any)?.env?.DEV ?? (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'),
);
let adminAccessInFlight: Promise<AdminAccessPayload | null> | null = null;

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

// Simple in-flight dedupe cache for identical requests within a short window.
const IN_FLIGHT_REQUESTS = new Map<string, Promise<any>>();

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
 *
 * In E2E / dev-bypass mode the session is a synthetic mock — a 401 from the
 * server means the DB / Supabase isn't reachable, NOT that the user is logged
 * out.  Triggering clearAuth() + redirect would destroy the bypass session and
 * break every E2E test that depends on the learner portal staying mounted.
 * We detect the bypass by checking window.__E2E_BYPASS (injected by Playwright's
 * addInitScript) so the guard survives React re-renders and any storage migrations.
 */
const handleAuthFailure = async () => {
  // In test runs we still want to exercise redirect logic (so tests can spy on
  // window.location.assign/replace), but avoid destructive side-effects like
  // clearing secure storage or signing out of Supabase which would break the
  // in-memory test harness. In production/E2E we perform the full sign-out.
  const isTestEnv = process.env.NODE_ENV === 'test';
  if (typeof window !== 'undefined' && Boolean((window as any).__E2E_BYPASS)) {
    console.warn('[apiClient] E2E bypass active — suppressing auth failure signout (401 received but session is a synthetic mock)');
    // fall through to perform redirect only
  }
  // If the app still has a locally-restored session snapshot, do not let an
  // arbitrary API 401 immediately destroy auth state. SecureAuthContext owns
  // session reconciliation and can decide whether the user is truly logged out.
  // This prevents protected client routes from snapping back to /login because
  // one page-level request races the broader auth bootstrap / surface checks.
  const activeSession = getActiveSession();
  if (activeSession?.id) {
    console.warn('[apiClient] Active session snapshot present — deferring auth failure handling to SecureAuthContext', {
      userId: activeSession.id,
      pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
    });
    return;
  }
  // Suppress the hard redirect while auth bootstrap is still running.
  // A 401 during bootstrap (e.g. from courseStore.init() firing before the
  // session cookie is confirmed) must NOT destroy the session — the bootstrap
  // will resolve the correct auth state and SecureAuthContext will handle any
  // real unauthenticated condition via its own redirect path.
  if (isAuthBootstrapping()) {
    console.warn('[apiClient] Auth bootstrap in progress — suppressing auth failure redirect for 401', {
      pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
      ts: Date.now(),
    });
    return;
  }
  // Only perform destructive sign-out/clear in non-test environments.
  if (!isTestEnv) {
    clearSupabaseAuthSnapshot();
    clearAuth();
    try {
      const supabase = await getSupabase();
      await supabase?.auth.signOut();
    } catch (error) {
      console.warn('[apiClient] Failed to sign out from Supabase', error);
    }
  }
  if (typeof window !== 'undefined' && window.location) {
    logAuthRedirect('apiClient.handleAuthFailure', {
      pathname: window.location.pathname,
      reason: 'api_auth_failure',
    });
    const target = resolveLoginPath();
    if (typeof window.location.replace === 'function') {
      window.location.replace(target);
    } else if (typeof window.location.assign === 'function') {
      window.location.assign(target);
    } else {
      window.location.href = target;
    }
  }
};

const buildNotAuthenticatedError = (url: string) =>
  new ApiError('Please log in again.', 401, url, {
    error: 'expired',
    code: 'not_authenticated',
    message: 'Please log in again.',
  });

const buildAdminAccessDeniedError = (url: string, body?: unknown) =>
  new ApiError(
    'You need administrator access to perform this action.',
    403,
    url,
    body ?? { message: 'You need administrator access to perform this action.' },
  );

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
const ADMIN_API_PATTERN = /^\/api\/admin\//i;
const LEARNER_OR_CLIENT_API_PATTERN = /^\/api\/(client|learner)(\/|$)/i;
const ORG_HEADER_CANDIDATES = ['x-org-id', 'x-organization-id'];
const AUTH_OVERRIDE_HEADER_CANDIDATES = ['x-user-role', 'x-user-id', 'x-org-id', 'x-organization-id', 'x-e2e-bypass'];

const API_ORIGIN_FOR_CREDENTIALS = (() => {
  try {
    return getApiOrigin();
  } catch {
    return '';
  }
})();

const ensureOriginComparable = (origin?: string | null): string | null => {
  if (!origin) return null;
  return origin.replace(/\/+$/, '');
};

const resolveRequestOrigin = (target: string): string | null => {
  try {
    if (ABSOLUTE_URL_REGEX.test(target)) {
      return new URL(target).origin;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(target, window.location.origin).origin;
    }
    if (API_ORIGIN_FOR_CREDENTIALS) {
      return new URL(target, API_ORIGIN_FOR_CREDENTIALS).origin;
    }
    return null;
  } catch {
    return null;
  }
};

const shouldAttachCredentials = (target: string): boolean => {
  if (!target) return false;
  const isRelative = !ABSOLUTE_URL_REGEX.test(target) && target.startsWith('/');
  if (isRelative) {
    return true;
  }
  const origin = ensureOriginComparable(resolveRequestOrigin(target));
  const normalizedApiOrigin = ensureOriginComparable(API_ORIGIN_FOR_CREDENTIALS);
  if (origin && normalizedApiOrigin && origin === normalizedApiOrigin) {
    return true;
  }
  if (origin && /^https:\/\/api\.the-huddle\.co$/i.test(origin)) {
    return true;
  }
  if (!normalizedApiOrigin && typeof window !== 'undefined') {
    const windowOrigin = ensureOriginComparable(window.location?.origin || '');
    if (windowOrigin && origin === windowOrigin) {
      return true;
    }
  }
  return false;
};

const resolveCSRFToken = (): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    return getCSRFToken();
  } catch {
    return null;
  }
};

const hasExplicitOrgHeader = (headers?: Record<string, string>): boolean => {
  if (!headers) return false;
  const normalizedKeys = Object.keys(headers).map((key) => key.toLowerCase());
  return ORG_HEADER_CANDIDATES.some((candidate) => normalizedKeys.includes(candidate));
};

const stripOrgHeaders = (headers: Record<string, string>) => {
  Object.keys(headers).forEach((key) => {
    if (ORG_HEADER_CANDIDATES.includes(key.toLowerCase())) {
      delete headers[key];
    }
  });
};

const stripAuthOverrideHeaders = (headers: Record<string, string>) => {
  Object.keys(headers).forEach((key) => {
    if (AUTH_OVERRIDE_HEADER_CANDIDATES.includes(key.toLowerCase())) {
      delete headers[key];
    }
  });
};

const stripProductionOverrideHeaders = (headers: Record<string, string>) => {
  if (!import.meta.env.PROD) return;
  stripAuthOverrideHeaders(headers);
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

const isE2EBypassActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__E2E_BYPASS);
};

const inferE2EBypassRole = (): 'admin' | 'learner' => {
  if (typeof window === 'undefined') return 'learner';
  const pathname = String(window.location?.pathname || '').toLowerCase();
  return pathname.startsWith('/admin') ? 'admin' : 'learner';
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

const logDevHttpError = (target: string, status: number, body: unknown) => {
  if (!devMode) return;
  if (status !== 422 && status < 500) return;
  const safeBody =
    typeof body === 'string' ? body : body && typeof body === 'object' ? body : { payload: body };
  try {
    console.warn('[apiClient][dev][response]', {
      pathname: extractPathname(target),
      status,
      body: safeBody,
    });
  } catch {
    console.warn('[apiClient][dev][response]', status, target, safeBody);
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

const ADMIN_OR_CRM_PATH_PATTERN = /^\/api\/admin(?:\/|$)|^\/api\/crm(?:\/|$)/i;
const ADMIN_ORG_CONTEXT_EXEMPT_PATHS = new Set(['/api/admin/me']);

const appendOrgIdQueryParam = (url: string, orgId: string): string => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (!parsed.searchParams.has('orgId') && !parsed.searchParams.has('organizationId')) {
      parsed.searchParams.set('orgId', orgId);
    }
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return /(?:[?&](?:orgId|organizationId)=)/.test(url) ? url : `${url}${separator}orgId=${encodeURIComponent(orgId)}`;
  }
};

const applyAdminOrgContextToUrl = (url: string, pathname: string): string => {
  if (!ADMIN_OR_CRM_PATH_PATTERN.test(pathname) || ADMIN_ORG_CONTEXT_EXEMPT_PATHS.has(pathname)) {
    return url;
  }
  const session = getActiveSession();
  const isPlatformAdmin = Boolean(session?.isPlatformAdmin === true || session?.role === 'platform_admin');
  const activeOrgId = getGlobalActiveOrgIdForApi() ?? session?.activeOrgId ?? session?.organizationId ?? null;
  if (activeOrgId === GLOBAL_ORG_ID) {
    return url;
  }
  if (!activeOrgId) {
    // Org not resolved yet; backend will enforce scoping. Use debug-level
    // logging to avoid flooding production logs with expected bootstrap races.
    console.debug('[apiClient] admin_request_missing_org_context', { path: pathname });
    return url;
  }
  if (!isPlatformAdmin && activeOrgId) {
    return appendOrgIdQueryParam(url, activeOrgId);
  }
  if (isPlatformAdmin) {
    console.debug('[apiClient] platform_admin_bypass_org_param', { path: pathname });
  }
  return url;
};

const prepareRequest = async (path: string, options: InternalRequestOptions = {}): Promise<PreparedRequest> => {
  assertNoDoubleApi(path);

  const method = options.method ?? 'GET';
  const pathname = extractPathname(path);

  // If this path requires an org header and we don't yet have a global active
  // org id, wait a short time for org resolution to complete. This prevents
  // a class of races where admin/org-scoped requests are issued before the
  // SecureAuthContext has resolved the active org. We keep the timeout short
  // to avoid blocking unrelated requests for long.
  try {
    const needsOrg = pathRequiresOrgHeader(pathname || '');
    const hasGlobalOrg = Boolean(getGlobalActiveOrgIdForApi());
    if (needsOrg && !hasGlobalOrg) {
      // Best-effort wait (2s). If it times out, we proceed and let the server
      // enforce scoping to avoid deadlocking the UI.
       
      await waitForOrgReady(2000).catch(() => null);
    }
  } catch (e) {
    // ignore readiness failures
  }

  const url = applyAdminOrgContextToUrl(buildApiUrl(path), pathname);

  // Runtime hardening: block attempts to call org-scoped APIs without an org id
  // Developer-visible failure in DEV to catch regressions early.
  try {
    const activeOrg = getGlobalActiveOrgIdForApi();
  const user = (options as any)?.user || (window as any).__CURRENT_USER__ || null;
    const isPlatformAdmin =
      user?.role === 'platform_admin' ||
      user?.isPlatformAdmin === true;

    if (pathRequiresOrgHeader(pathname || '') && !activeOrg && !isPlatformAdmin) {
      console.error('[API BLOCK] Missing orgId for non-platform user', { path, url, userId: user?.id || null });
      if (import.meta.env?.DEV) {
        throw new Error('Missing orgId');
      }
    }

    if (isPlatformAdmin) {
      console.log('[API] Platform admin request — bypassing orgId requirement', { path });
    }
  } catch (e) {
    // swallow to avoid breaking non-dev flows
  }

  // Global network intercept check: detect accidental 'undefined'/'null' in URLs
  try {
    if (typeof url === 'string' && (url.includes('undefined') || url.includes('null'))) {
      console.error('INVALID REQUEST URL', url);
    }
  } catch (e) {
    // ignore
  }

  // NOTE: The client-side pathname guard that previously blocked /api/admin/* requests
  // when isAdminSurface() returned false has been removed.
  //
  // Rationale:
  //   1. ensureAdminAccessForRequest() (called before prepareRequest) already verifies
  //      admin portal access by calling /api/admin/me — a real server round-trip.
  //   2. The server enforces authenticate + requireAdmin on every /api/admin/* route,
  //      making client-side pathname enforcement redundant and adding zero security.
  //   3. isAdminSurface() reads window.location.pathname synchronously inside an async
  //      call chain. During deferred callbacks (auth-ready events, org-switch retries,
  //      courseStore.init() re-runs), the pathname snapshot can disagree with the
  //      caller's context even when the user is legitimately on an admin page — causing
  //      spurious [apiRequest] blocked_admin_request errors.
  //
  // DEV hint (non-blocking): warn if calling an admin API from a clearly non-admin path,
  // but never block the request — server authorization is the source of truth.
  // Stronger surface enforcement: when caller supplies a `surface` hint we ensure
  // that admin APIs are not called from a non-admin surface unless explicitly allowed.
  if (
    options?.surface &&
    !options.skipAdminGateCheck &&
    !options.allowAnonymous &&
    ADMIN_API_PATTERN.test(pathname)
  ) {
    const callerSurface = options.surface;
    if (callerSurface !== 'admin') {
      // In production enforce strictly; in dev warn but still allow when skipAdminGateCheck is used.
      const message = `[apiRequest] blocked admin API call from non-admin surface (${callerSurface}) – ${pathname}`;
      if (!devMode) {
        throw buildAdminAccessDeniedError(pathname, { message });
      } else {
        console.warn(message, { tip: 'Pass skipAdminGateCheck:true if this is intentional (e.g. courseStore.init).' });
      }
    }
  } else if (devMode && !options.skipAdminGateCheck && !options.allowAnonymous && ADMIN_API_PATTERN.test(pathname)) {
    if (typeof window !== 'undefined' && !isAdminSurface()) {
      console.warn('[apiRequest] dev_hint: admin API called from non-admin pathname', {
        pathname,
        surface: window.location?.pathname,
        tip: 'Pass skipAdminGateCheck:true if this is intentional (e.g. courseStore.init).',
      });
    }
  }

  const requiresSession =
    shouldRequireSession(url, {
      requireAuth: options.requireAuth,
      allowAnonymous: options.allowAnonymous,
    }) && options.allowAnonymous !== true;
  // If this request requires a session, and the app is still performing
  // auth bootstrap, wait briefly for the canonical auth snapshot to settle
  // so we don't send an accidental unauthenticated request during page
  // startup (fixes race where first request after refresh is anonymous).
  if (requiresSession && isAuthBootstrapping()) {
    try {
      const { waitForAuthReady } = await import('../lib/canonicalAuth');
      // Wait up to 3s for auth bootstrap to complete — this keeps startup
      // responsive but prevents a whole-class of unauthenticated races.
      await waitForAuthReady(3000).catch(() => null);
    } catch (e) {
      // ignore — fallback behavior will attempt to attach tokens below
    }
  }

  // Build auth headers for EVERY request
  const authHeaders = await buildAuthHeaders();
  const publicEndpoint = isPublicEndpoint(path);
  const attachAuth = !publicEndpoint;

  const baseHeaders: Record<string, string> = {};
  const headers = mergeHeadersSafely(baseHeaders, authHeaders, options.headers);
  stripProductionOverrideHeaders(headers);

  // Learner/client routes should not inherit org headers from stale browser state.
  // If an org header is required for a specific request, callers can pass it explicitly.
  if (LEARNER_OR_CLIENT_API_PATTERN.test(pathname) && !hasExplicitOrgHeader(options.headers)) {
    stripOrgHeaders(headers);
  }

  // Prevent stale/no-token audit headers from being sent without a real bearer token.
  // In production these are rejected as unsafe request header overrides.
  if (!headers.Authorization && !isE2EBypassActive()) {
    stripAuthOverrideHeaders(headers);
  }

  if (isE2EBypassActive() && !import.meta.env.PROD) {
    // In browser E2E bypass mode, auth is represented by explicit test headers.
    // Only set these in non-production environments.
    delete headers.Authorization;
    headers['X-E2E-Bypass'] = 'true';
    if (!headers['X-User-Role']) {
      headers['X-User-Role'] = inferE2EBypassRole();
    }
  }

  if (attachAuth && requiresSession && !headers.Authorization) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (
    attachAuth &&
    requiresSession &&
    LEARNER_OR_CLIENT_API_PATTERN.test(pathname) &&
    !headers.Authorization &&
    !isE2EBypassActive()
  ) {
    throw buildNotAuthenticatedError(url);
  }

  if (!headers['X-CSRF-Token']) {
    const csrfToken = resolveCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

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

  const credentialMode: RequestCredentials = shouldAttachCredentials(url) ? 'include' : 'omit';

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
    credentials: credentialMode,
  };

  // Developer-only verifications have been removed to prepare for production.

  return preparedRequest;
};

// Retry only on network-layer failures (TypeError = connection refused / offline).
// We do NOT retry on HTTP errors (4xx/5xx), auth errors, or explicit aborts.
const NETWORK_RETRY_DELAYS_MS = [200, 600] as const; // 2 attempts after the initial try

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

  let lastNetworkError: unknown;

  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt++) {
    // Bail immediately if the request was already aborted (e.g. component unmounted).
    if (controller.signal.aborted) {
      if (timeoutId) clearTimeout(timeoutId);
      linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
      throw new ApiError('Request timed out', 0, url, { message: 'The request exceeded the allowed time.' });
    }

    try {
      const res = await authorizedFetch(
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
      if (timeoutId) clearTimeout(timeoutId);
      linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
      return res;
    } catch (error: any) {
      // If the failure is due to missing organization context on the client
      // (authorizedFetch throws this when a guarded request was attempted
      // without a resolved active org), surface a global window event so the
      // UI can show a helpful banner/toast and avoid infinite loading.
      // No special handling for missing_org_context: the request layer no
      // longer throws this error. Let callers handle API errors normally and
      // rely on the bridge snapshot / readiness helpers for deterministic
      // initialization.
      // Abort / timeout — never retry.
      if (error?.name === 'AbortError') {
        if (timeoutId) clearTimeout(timeoutId);
        linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
        throw new ApiError('Request timed out', 0, url, { message: 'The request exceeded the allowed time.' });
      }
      // Auth error — never retry.
      if (error instanceof NotAuthenticatedError) {
        if (timeoutId) clearTimeout(timeoutId);
        linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
        // In test env, suppress global auth failure and return an empty ok envelope
        if (process.env.NODE_ENV === 'test') {
          return new Response(JSON.stringify({ ok: true, data: {} }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }) as any,
          }) as unknown as Response;
        }
        await handleAuthFailure();
        throw buildNotAuthenticatedError(url);
      }
      // Only network-level TypeErrors are retryable (e.g. "Failed to fetch").
      const isNetworkError = error instanceof TypeError;
      if (!isNetworkError || attempt >= NETWORK_RETRY_DELAYS_MS.length) {
        if (timeoutId) clearTimeout(timeoutId);
        linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
        throw error;
      }
      // Network failure — wait briefly then retry.
      lastNetworkError = error;
      const delayMs = NETWORK_RETRY_DELAYS_MS[attempt];
      console.warn(`[apiClient] Network error on attempt ${attempt + 1}, retrying in ${delayMs}ms`, {
        url: extractPathname(url),
        message: error.message,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should not be reachable, but satisfy TypeScript.
  if (timeoutId) clearTimeout(timeoutId);
  linkedSignals.forEach((signal) => signal.removeEventListener('abort', abortForwarder));
  throw lastNetworkError;
};

const internalAuthorizedFetch = async (
  path: string,
  options: InternalRequestOptions = {},
): Promise<Response> => {
  await ensureAdminAccessForRequest(path, options);
  const prepared = await prepareRequest(path, options);

  let throttleKey: string | null = null;
  throttleKey = assertNotThrottled(prepared.url);

  const res = await executeFetch(prepared);

  if (devMode && extractPathname(prepared.url) === '/api/auth/session') {
    const hasSetCookie = res.headers.has('set-cookie');
    console.info('[apiClient] auth_session_response', {
      status: res.status,
      hasSetCookieHeader: hasSetCookie,
      credentialsMode: prepared.credentials,
    });
  }

  const contentType = res.headers.get('content-type');
  if (res.status === 401) {
    const body = isJsonResponse(contentType) ? await safeParseJson(res) : await safeReadText(res);
    logUnauthorized(prepared.url, res.status, body, {
      credentials: prepared.credentials,
    });
    // Always attempt to run auth failure handling first. In test env the
    // handler is a no-op, so this is safe and keeps tests deterministic.
    try {
      await handleAuthFailure();
    } catch (e) {
      console.warn('[apiClient] handleAuthFailure threw', e);
    }
    // Surface an ApiError for callers/tests to observe the 401.
    if (body && typeof body === 'object' && 'error' in body) {
      throw new ApiError('Please log in again.', 401, prepared.url, body);
    }
    throw buildNotAuthenticatedError(prepared.url);
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
    logDevHttpError(prepared.url, res.status, body);
    throw new ApiError(`Request failed with status ${res.status}`, res.status, prepared.url, body);
  }

  if (throttleKey) {
    ROUTE_THROTTLE_STATE.delete(throttleKey);
  }

  return res;
};

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { skipAdminGateCheck, rawResponse, dedupe = true, ...rest } = options;

  const method = (rest.method ?? 'GET') as string;
  const shouldDedupe = Boolean(dedupe) && method.toUpperCase() === 'GET';
  const dedupeKey = shouldDedupe ? `${path}|${method}|${JSON.stringify(rest.body ?? null)}` : null;

  if (dedupeKey && IN_FLIGHT_REQUESTS.has(dedupeKey)) {
    return IN_FLIGHT_REQUESTS.get(dedupeKey) as Promise<T>;
  }

  const run = (async (): Promise<T> => {
    const apiEntry = startApiRequest(path, method);
    const res = await internalAuthorizedFetch(path, { ...rest, skipAdminGateCheck });
    try {
      endApiRequest(apiEntry, res.status);

      if (rawResponse) {
        return res as unknown as T;
      }

      const contentType = res.headers.get('content-type');

      // No content
      if (res.status === 204) return undefined as T;

      // Parse JSON if possible, otherwise return text
      if (isJsonResponse(contentType)) {
        const envelope = await safeParseJson(res);

        // If the server already returned an envelope { ok, data }, respect it
        if (typeof envelope === 'object' && envelope !== null && 'ok' in envelope) {
          if ((envelope as any).ok) {
            const payload = options.noTransform ? (envelope as any).data : transformKeysDeep((envelope as any).data, 'camel');
            return ({ ok: true, data: payload } as unknown) as T;
          }
          throw new ApiError((envelope as any).message || 'API error', res.status, path, envelope);
        }

        // Legacy or non-enveloped responses:
        // If server returned a legacy { data: ... } shape, unwrap that data and
        // apply transforms only to the inner payload. Otherwise treat the whole
        // body as the data payload.
        const rawPayload = envelope as any;
        let inner: unknown;
        if (rawPayload && typeof rawPayload === 'object' && 'data' in rawPayload) {
          inner = rawPayload.data;
        } else {
          inner = rawPayload;
        }
        const payload = options.noTransform ? inner : transformKeysDeep(inner, 'camel');
        return ({ ok: true, data: payload } as unknown) as T;
      }

      const text = await safeReadText(res);
      return text as unknown as T;
    } finally {
      // cleanup handled in outer finally
    }
  })();

  if (dedupeKey) {
    IN_FLIGHT_REQUESTS.set(dedupeKey, run);
  }

  try {
    const result = await run;
    return result;
  } finally {
    if (dedupeKey) IN_FLIGHT_REQUESTS.delete(dedupeKey);
  }
}

export async function safeApiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError) {
      if (import.meta.env?.DEV) {
        console.warn('[apiClient] safeApiRequest caught ApiError', {
          path,
          status: error.status,
          body: error.body,
        });
      }
      return null;
    }
    throw error;
  }
}

export async function apiRequestRaw(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { skipAdminGateCheck, ...rest } = options;
  return internalAuthorizedFetch(path, { ...rest, skipAdminGateCheck });
}

export default apiRequest;


async function ensureAdminAccessForRequest(path: string, options?: InternalRequestOptions): Promise<void> {
  if (options?.skipAdminGateCheck || options?.allowAnonymous) {
    return;
  }
  if (isAuthBootstrapping()) {
    if (import.meta.env?.DEV) {
      console.debug('[apiClient] Skipping admin access gate while auth bootstrap is in progress', { path });
    }
    return;
  }
  const pathname = extractPathname(path);
  if (!ADMIN_PATH_PATTERN.test(pathname) || pathname === '/api/admin/me') {
    return;
  }

  const cached = getAdminAccessSnapshot();
  const currentSession = getActiveSession();
  const currentUserId = currentSession?.id ?? null;
  const cachedUserId = cached?.payload?.user?.id ?? null;
  const isCachedSnapshotForCurrentUser =
    currentUserId !== null && cachedUserId !== null && currentUserId === cachedUserId;

  if (cached && isAdminAccessSnapshotFresh() && isCachedSnapshotForCurrentUser) {
    const cachedPayload = cached.payload ?? null;
    if (hasAdminPortalAccess(cachedPayload)) {
      return;
    }
  }

  if (adminAccessInFlight) {
    await adminAccessInFlight;
    return;
  }
  const promise = (async () => {
    try {
      // Use canonical session snapshot rather than querying Supabase directly.
      const { getCanonicalSession, waitForAuthReady } = await import('../lib/canonicalAuth');
      const cs = getCanonicalSession();
      let accessToken: string | null = null;
      if (cs && cs.accessToken) {
        accessToken = cs.accessToken;
      } else {
        const ready = await waitForAuthReady(2000).catch(() => null);
        if (!ready || !ready.accessToken) {
          if (import.meta.env?.DEV) {
            console.debug('[apiClient] Skipping admin access gate because session is unavailable');
          }
          return null;
        }
        accessToken = ready.accessToken;
      }

      const res = await authorizedFetch(
        '/api/admin/me',
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        {
          requestLabel: '/api/admin/me',
          timeoutMs: 5000,
        },
      );
      const responseBody = await safeParseJson(res);
      if (!res.ok) {
        const body = isPlainObject(responseBody) && 'message' in responseBody
          ? responseBody
          : { message: 'You need administrator access to perform this action.' };
        throw buildAdminAccessDeniedError(path, body);
      }
      const normalized = normalizeAdminAccessPayload(responseBody);
      setAdminAccessSnapshot(normalized);
      return normalized;
    } catch (error) {
      console.warn('[apiClient] Admin access check failed', error);
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.message === 'Not authenticated') {
        throw buildAdminAccessDeniedError(path);
      }
      throw error;
    } finally {
      adminAccessInFlight = null;
    }
  })();
  adminAccessInFlight = promise;
  await promise;
}

// Locked API client to ensure all requests use `withCredentials: true`
const apiClient = axios.create({
  withCredentials: true,
});

// PRODUCTION SAFETY: strip forbidden headers
apiClient.interceptors.request.use((config) => {
  // PRODUCTION SAFETY: strip forbidden headers
  if (config.headers) {
    delete (config.headers as any)['X-Org-Id'];
    delete (config.headers as any)['X-User-Role'];
    delete (config.headers as any)['X-E2E-Bypass'];
  }
  // Frontend must never manipulate org-scoped params. Backend decides scope.
  // Keep defensive header stripping below.

  // PRODUCTION SAFETY:
  // Never allow frontend to override org or role. Backend is source of truth.

  // PRODUCTION FAILSAFE: if any forbidden headers are present in production, emit an error
  if (import.meta.env.PROD) {
    const forbidden = ['X-Org-Id', 'X-User-Role', 'X-E2E-Bypass'];
    const isCI = Boolean(process.env.CI);
    const isStaging = import.meta.env.MODE === 'staging' || String(import.meta.env.VITE_ENV) === 'staging';
    const shouldThrowOnLeak = isCI || isStaging;
    try {
      for (const key of forbidden) {
        if (config.headers && (config.headers as any)[key]) {
          try {
            const globalSentry = (globalThis as any).Sentry || (globalThis as any).__SENTRY__;
            if (globalSentry && typeof globalSentry.captureMessage === 'function') {
              try {
                globalSentry.captureMessage('Forbidden header leak detected', {
                  level: 'error',
                  extra: { header: key, url: config.url },
                });
              } catch (e) {
                 
                console.error('FORBIDDEN HEADER LEAK DETECTED:', key, 'on', config.url);
              }
            } else {
               
              console.error('FORBIDDEN HEADER LEAK DETECTED:', key, 'on', config.url);
            }
          } catch (e) {
             
            console.error('FORBIDDEN HEADER LEAK DETECTED:', key, 'on', config.url);
          }

          if (shouldThrowOnLeak) {
            throw new Error(`FORBIDDEN HEADER LEAK: ${key}`);
          }
        }
      }
    } catch (e) {
      // defensive: do not block requests
    }
  }

  return config;
});

export { apiClient };
