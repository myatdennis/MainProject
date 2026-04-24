import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  setSessionMetadata,
  setUserSession,
  clearAuth,
  getActiveOrgPreference,
  setActiveOrgPreference,
  clearActiveOrgPreference,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  type UserSession,
  type UserMembership,
  type SessionMetadata,
} from '../lib/secureStorage';
import { queueRefresh } from '../lib/refreshQueue';
import apiRequest, { ApiError, apiRequestRaw } from '../utils/apiClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';
import { getSupabase } from '../lib/supabaseClient';
import { AuthExpiredError, NotAuthenticatedError } from '../lib/apiClient';
// import { setGlobalActiveOrgIdForApi } from '../lib/orgContext';
import { writeBridgeSnapshot, clearBridgeSnapshot } from '../store/courseStoreOrgBridge';
import { courseStore } from '../store/courseStore';
// admin access snapshot helper intentionally unused in some builds
// import { clearAdminAccessSnapshot } from '../lib/adminAccess';
import { setAuthBootstrapping } from '../lib/authBootstrapState';
import {
  normalizeSessionResponsePayload,
  readSupabaseSessionTokens,
  type SessionResponsePayload,
} from './sessionBootstrap';
import {
  computeAuthState,
  type AuthState,
  type SessionSurface,
  type SurfaceAuthStatus,
} from './surfaceAccess';
import {
  // deriveOrgContextSnapshot,
  normalizeMembershipStatusFlag,
  type ActiveOrgSource,
  type OrgResolutionStatus,
} from './organizationResolution';
import { runRefreshTokenCallback, setRefreshManagerActive } from './tokenRefresh';
import { createAuthActions } from './authActions';
import {
  buildUserSessionFromPayload,
  resolveSessionStatePayload,
} from './sessionState';
import { defaultAuthContext, type AuthContextType } from './authContextContract';
import type { RefreshOptions } from './authTypes';
import { performLogout } from './sessionLifecycle';
import { renderAuthState } from './authRenderState';
import { enqueueAudit, flushAuditQueue } from '../dal/auditLog';
import { logAuthRedirect } from '../utils/logAuthRedirect';
import { setCanonicalSession } from '../lib/canonicalAuth';
import { isAdminSurface, isLoginPath, resolveLoginPath } from '../utils/surface';

const logAuthSessionState = () => {};
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const SESSION_RELOAD_THROTTLE_MS = 45 * 1000;
const MEMBERSHIP_RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000] as const;

const isNavigatorOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
type MembershipFetchMeta = {
  requestId: number;
  startedAt: number | null;
  finishedAt: number | null;
  statusCode: number | null;
  membershipCount: number | null;
  reason?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
let warnedMissingProvider = false;

// ============================================================================
// Provider
// ============================================================================




interface AuthProviderProps {
  children: ReactNode;
}

export function SecureAuthProvider({ children }: AuthProviderProps) {
  // Production no-op debug/diagnostic functions for type compatibility
  const logAuthDebug = () => {};
  // E2E-only lightweight logger — enabled when test harness injects a bypass flag
  const E2E_ENABLED =
    (typeof window !== 'undefined' && (window as any).__E2E_BYPASS) ||
    (typeof process !== 'undefined' && String(process.env.E2E_TEST_MODE) === 'true') ||
    // also enable if an E2E bypass cookie is present in-page
  (typeof document !== 'undefined' && typeof document.cookie === 'string' && document.cookie.includes('x-e2e-bypass')) ||
  // also enable when a debug query param is present on pages where tests opt-in
  (typeof window !== 'undefined' && typeof window.location?.search === 'string' && window.location.search.includes('debugProgress'));
  const e2eLog = (tag: string, payload?: any) => {
    try {
      if (!E2E_ENABLED) return;
      // Use console.log so Playwright captures it under [browser:log]
      // include timestamp and minimal context
      // eslint-disable-next-line no-console
      console.log(`[E2E][AUTH] ${tag}`, payload ?? {});
      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          w.__HUDDLE_E2E_EVENTS = w.__HUDDLE_E2E_EVENTS || [];
          w.__HUDDLE_E2E_EVENTS.push({ tag, payload: payload ?? {}, ts: Date.now() });
        }
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      // swallow
    }
  };
  // Initialize bridge snapshot immediately so stores reading the bridge
  // know that auth/org resolution is still pending. This prevents stores
  // from incorrectly assuming a ready org when the provider is still
  // bootstrapping — making org resolution deterministic.
  try {
    writeBridgeSnapshot({ status: 'idle', membershipStatus: 'idle', activeOrgId: null, orgId: null, role: null, userId: null });
  } catch (e) {
    // ignore in non-browser or test environments
  }
  const logRefreshResult = () => {};
  // Additional refs for state tracking
  const lastAdminAllowedRef = useRef(false);
  const membershipStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>('idle');
  const organizationIdsSnapshotRef = useRef<string[]>([]);
  const membershipsSnapshotRef = useRef<UserMembership[]>([]);
  const setLastMembershipFetchMeta = useState<Partial<MembershipFetchMeta>>({})[1];
  // Core state for session, org, and membership
  const [user, setUser] = useState<UserSession | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>('idle');
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [requestedOrgHint, setRequestedOrgHintState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<AuthState>({
    lms: false,
    admin: false,
    client: false,
  });
  // Ensure admin store initialization waits for final resolved auth/org state
  useEffect(() => {
    // Only initialize admin store if session/org/role is fully resolved and admin is allowed
    const isAdmin =
      (user?.role === 'admin' || user?.role === 'platform_admin') &&
      (authBootstrapState === 'ready' || authBootstrapState === 'degraded');
    if (isAdmin && !lastAdminAllowedRef.current) {
      if (import.meta.env?.DEV) {
        console.debug('[AUTH][ADMIN_GATE] Admin store initializing', {
          userId: user?.id,
          orgId: activeOrgId,
          membershipStatus,
          ts: Date.now(),
        });
      }
      // Trigger admin store (or any downstream) initialization here
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('huddle:admin_ready', { detail: { userId: user?.id, orgId: activeOrgId } }));
      }
      lastAdminAllowedRef.current = true;
    } else if (!isAdmin && lastAdminAllowedRef.current) {
      if (import.meta.env?.DEV) {
        console.debug('[AUTH][ADMIN_GATE] Admin store de-initialized', {
          userId: user?.id,
          orgId: activeOrgId,
          membershipStatus,
          ts: Date.now(),
        });
      }
      lastAdminAllowedRef.current = false;
    }
    // No return value (no cleanup needed)
  }, [user, activeOrgId, membershipStatus]);

  // Hoist authInitializing and setAuthInitializing to top-level scope
  const [authInitializing, setAuthInitializing] = useState(true);
  type AuthBootstrapState =
    | 'not_started'
    | 'loading_local_session'
    | 'validating_session'
    | 'refreshing_session'
    | 'fetching_server_session'
    | 'fetching_memberships'
    | 'resolving_org'
    | 'ready'
    | 'degraded'
    | 'error';
  const [authBootstrapState, setAuthBootstrapState] = useState<AuthBootstrapState>('not_started');
  const authStatusRef = useRef<'booting' | 'authenticated' | 'unauthenticated' | 'error'>('booting');
  const [authStatus, setAuthStatusState] = useState<'booting' | 'authenticated' | 'unauthenticated' | 'error'>('booting');
  const setAuthStatus = useCallback(
    (next: 'booting' | 'authenticated' | 'unauthenticated' | 'error', source?: string) => {
      const prev = authStatusRef.current;
      authStatusRef.current = next;
      setAuthStatusState(next);
      e2eLog('auth_status_change', { prev, next, source });
      if (import.meta.env?.DEV) {
        console.debug('[AUTH_STATE_SET]', {
          source: source ?? 'unknown',
          previousAuthStatus: prev,
          nextAuthStatus: next,
          authInitializing: true, // will be current render value
          userId: null, // populated by caller when available
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
          ts: Date.now(),
        });
      }
    },
    [],
  );
  const sessionStatusRef = useRef<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [sessionStatus, setSessionStatusState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const setSessionStatus = useCallback(
    (next: 'loading' | 'authenticated' | 'unauthenticated', source?: string) => {
      const prev = sessionStatusRef.current;
      sessionStatusRef.current = next;
      setSessionStatusState(next);
      e2eLog('session_status_change', { prev, next, source });
      if (import.meta.env?.DEV) {
        console.debug('[AUTH_STATE_SET]', {
          source: source ?? 'unknown',
          previousSessionStatus: prev,
          nextSessionStatus: next,
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
          ts: Date.now(),
        });
      }
    },
    [],
  );
  const [surfaceAuthStatus, setSurfaceAuthStatus] = useState<Record<SessionSurface, SurfaceAuthStatus>>({
    admin: 'idle',
    lms: 'idle',
    client: 'idle',
  });
  const [orgResolutionStatus, setOrgResolutionStatus] = useState<OrgResolutionStatus>('idle');
  const [_sessionMetaVersion, setSessionMetaVersion] = useState(0);
  const bootstrappedRef = useRef(false);
  const hasAttemptedRefreshRef = useRef(false);
  const refreshAttemptedRef = useRef(false);
  const serverTimeOffsetRef = useRef(0);
  const lastRefreshAttemptRef = useRef(0);
  const lastRefreshSuccessRef = useRef(0);
  const bootstrapControllerRef = useRef<AbortController | null>(null);
  const bootstrapFailOpenTimerRef = useRef<number | null>(null);
  // Monotonically-incrementing run ID: every startBootstrap invocation stamps a
  // new ID.  After every await inside runBootstrap the run validates that its ID
  // is still current; if not it returns early without applying any state.
  const bootstrapRunIdRef = useRef(0);
  // Timestamp of the last retryBootstrap() call. Used to enforce a 2-second
  // minimum interval between retries so rapid-fire external calls (e.g. button
  // spam) cannot hammer the Supabase auth endpoint.
  const lastRetryTimestampRef = useRef(0);
  const lastSessionReloadRef = useRef(0);
  const hasAuthenticatedSessionRef = useRef(false);
  const hadAuthenticatedSessionRef = useRef(false);
  const lastSessionFetchResultRef = useRef<'idle' | 'authenticated' | 'unauthenticated' | 'error'>('idle');
  const refreshRunCountRef = useRef(0);
  const membershipSelfHealTrackerRef = useRef<{ shouldAttempt: (userId?: string | null, orgId?: string | null) => boolean; recordAttempt?: () => void }>(
    { shouldAttempt: () => false },
  );
  const lastActiveOrgSourceRef = useRef<ActiveOrgSource>('none');
  const lastAppliedActiveOrgIdRef = useRef<string | null>(null);
  const membershipFetchRequestIdRef = useRef(0);
  const membershipCacheRef = useRef<UserMembership[]>([]);
  const rawRequestInflightRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const membershipRetryTimerRef = useRef<number | null>(null);
  const membershipRetryAttemptRef = useRef(0);
  type FetchServerSessionFn = (options?: {
    surface?: SessionSurface;
    signal?: AbortSignal;
    silent?: boolean;
    allowRefresh?: boolean;
    skipMembershipSelfHeal?: boolean;
  }) => Promise<boolean>;
  const fetchServerSessionRef = useRef<FetchServerSessionFn | null>(null);
  const ensureLightMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (document?.documentElement?.classList?.contains && document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        // Also remove any inline theme-color meta override if present
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && meta instanceof HTMLMetaElement) {
          meta.setAttribute('content', '#3A7DFF');
        }
      }
    } catch (e) {
      // swallow DOM exceptions in non-browser environments
      if (import.meta.env?.DEV) console.warn('[SecureAuth] ensureLightMode failed', e);
    }
  }, []);
  const clearMembershipRetryBackoff = useCallback(() => {
    if (membershipRetryTimerRef.current) {
      clearTimeout(membershipRetryTimerRef.current);
      membershipRetryTimerRef.current = null;
    }
    membershipRetryAttemptRef.current = 0;
  }, []);
  const scheduleMembershipRetryBackoff = useCallback(function scheduleRetry(_reason: string) {
    if (typeof window === 'undefined') {
      return;
    }

    if (membershipRetryTimerRef.current) {
      return;
    }

    const currentAttempt = membershipRetryAttemptRef.current;
    const delay = MEMBERSHIP_RETRY_DELAYS_MS[Math.min(currentAttempt, MEMBERSHIP_RETRY_DELAYS_MS.length - 1)];
    membershipRetryAttemptRef.current += 1;

    membershipRetryTimerRef.current = window.setTimeout(async () => {
      membershipRetryTimerRef.current = null;

      try {
        const fetchFn = fetchServerSessionRef.current;
        if (!fetchFn) {
          return;
        }

        const retrySurface: SessionSurface =
          typeof window !== 'undefined' && isAdminSurface(window.location?.pathname ?? '')
            ? 'admin'
            : 'lms';

        await fetchFn({ surface: retrySurface, silent: true, allowRefresh: false, skipMembershipSelfHeal: true });
      } catch (retryError) {
        console.warn('[SecureAuth] membership retry backoff failed', retryError);
      } finally {
        if (membershipStatusRef.current !== 'ready') {
          scheduleRetry('retry_followup');
        } else {
          clearMembershipRetryBackoff();
        }
      }
    }, delay);
  }, []);
  useEffect(() => {
    membershipStatusRef.current = membershipStatus;
    if (membershipStatus === 'ready') {
      clearMembershipRetryBackoff();
    }
  }, [membershipStatus, clearMembershipRetryBackoff]);
  useEffect(() => {
    return () => {
      clearMembershipRetryBackoff();
    };
  }, [clearMembershipRetryBackoff]);
  const refreshTokenCallbackRef = useRef<((options?: RefreshOptions) => Promise<boolean>) | null>(null);
  const recordMembershipFetchMeta = useCallback((meta: Partial<MembershipFetchMeta>) => {
    setLastMembershipFetchMeta((prev) => ({
      ...prev,
      ...meta,
    }));
  }, []);
  const updateSurfaceAuthStatus = useCallback((surface: SessionSurface | undefined, status: SurfaceAuthStatus) => {
    if (!surface) {
      return;
    }
    setSurfaceAuthStatus((prev) => {
      if (prev[surface] === status) {
        return prev;
      }
      return {
        ...prev,
        [surface]: status,
      };
    });
  }, []);

  const syncServerClock = useCallback((serverDateHeader?: string | null) => {
    if (!serverDateHeader) {
      return;
    }
    const parsed = Date.parse(serverDateHeader);
    if (!Number.isFinite(parsed)) {
      return;
    }
    serverTimeOffsetRef.current = parsed - Date.now();
  }, []);

  const captureServerClock = useCallback(
    (headers?: Record<string, any>) => {
      if (!headers) return;
      const serverDate = headers.date || headers.Date;
      if (typeof serverDate === 'string') {
        syncServerClock(serverDate);
      }
    },
    [syncServerClock],
  );

  const getSkewedNow = useCallback(() => Date.now() + serverTimeOffsetRef.current, []);

  const applySessionPayload = useCallback(
    (
      payload: SessionResponsePayload | null,
      {
        surface,
        persistTokens = true,
        reason,
      }: { surface?: SessionSurface; persistTokens?: boolean; reason?: string } = {},
    ) => {
      const tokenReason = reason ?? (payload?.user ? `${surface ?? 'session'}_update` : 'session_clear');
      if (!payload?.user) {
        hasAuthenticatedSessionRef.current = false;
        lastSessionFetchResultRef.current = 'unauthenticated';
        setUser(null);
        setMemberships([]);
        setMembershipStatus('idle');
        setOrganizationIds([]);
        setActiveOrgIdState(null);
        clearActiveOrgPreference();
        membershipCacheRef.current = [];
        organizationIdsSnapshotRef.current = [];
        clearMembershipRetryBackoff();
        setIsAuthenticated({ lms: false, admin: false, client: false });
        setSurfaceAuthStatus({ admin: 'idle', lms: 'idle', client: 'idle' });
        if (persistTokens) {
          clearAuth(tokenReason);
          setSessionMetaVersion((value) => value + 1);
        }
        clearBridgeSnapshot();
        return;
      }

      hasAuthenticatedSessionRef.current = true;
      hadAuthenticatedSessionRef.current = true;
      lastSessionFetchResultRef.current = 'authenticated';
      const resolvedState = resolveSessionStatePayload({
        payload,
        requestedOrgId: requestedOrgHint,
  // activeOrgId, // removed, not a valid property of SessionStateResolutionInput
        activeOrgPreference: getActiveOrgPreference(),
        membershipCache: membershipCacheRef.current,
        membershipsSnapshot: membershipsSnapshotRef.current,
        organizationIdsSnapshot: organizationIdsSnapshotRef.current,
      });
      const membershipStateFromPayload = resolvedState.membershipState;
      const resolvedMemberships = resolvedState.resolvedMemberships;
      e2eLog('apply_session_resolved_state', {
        membershipStateFromPayload,
        resolvedMembershipsLength: resolvedMemberships?.length ?? 0,
        resolvedMembershipIds: Array.isArray(resolvedMemberships) ? resolvedMemberships.map((m: any) => m.orgId || m.organizationId || m.organization_id) : null,
        resolvedActiveOrg: resolvedState.activeOrgId,
      });
  // Update the ref synchronously so bootstrapping logic reading the ref
  // can see the latest membership status without waiting for React state.
  membershipStatusRef.current = membershipStateFromPayload;
  setMembershipStatus(membershipStateFromPayload);
      if (resolvedMemberships.length > 0) {
        membershipCacheRef.current = resolvedMemberships;
      }
      // Keep a synchronous snapshot for bootstrapping logic to read without
      // awaiting React state updates. This prevents a race where runBootstrap
      // reads memberships before the state setter has taken effect.
      membershipsSnapshotRef.current = resolvedMemberships;
      const orgIds = resolvedState.organizationIds;
      organizationIdsSnapshotRef.current = orgIds;
  setActiveOrgIdState(resolvedState.activeOrgId);
      setActiveOrgPreference(resolvedState.activeOrgId);
      const session: UserSession = buildUserSessionFromPayload({
        payload,
        organizationIds: orgIds,
        memberships: resolvedMemberships,
        activeOrgId: resolvedState.activeOrgId,
        activeOrgSource: resolvedState.activeOrgSource,
      });

      setUser(session);
      setMemberships(resolvedMemberships);
      setOrganizationIds(orgIds);
      setActiveOrgIdState(session.activeOrgId ?? null);
      const authState = computeAuthState(session, surface);
      setIsAuthenticated(authState);
      setSurfaceAuthStatus({
        admin: authState.admin ? 'ready' : 'idle',
        lms: authState.lms ? 'ready' : 'idle',
        client: authState.client ? 'ready' : 'idle',
      });
      setUserSession(session);
      lastAppliedActiveOrgIdRef.current = session.activeOrgId ?? null;
      lastActiveOrgSourceRef.current = resolvedState.activeOrgSource;
      clearMembershipRetryBackoff();
      writeBridgeSnapshot({
        status:
          resolvedState.membershipState === 'ready' || resolvedState.membershipState === 'degraded'
            ? 'ready'
            : resolvedState.membershipState === 'error'
            ? 'error'
            : 'loading',
        membershipStatus: resolvedState.membershipState,
        activeOrgId: resolvedState.activeOrgId,
        orgId: resolvedState.activeOrgId,
        role: session.role ?? null,
        userId: session.id ?? null,
      });
      if (import.meta.env?.DEV) {
        console.debug('[AUTH SESSION RESTORED]', {
          userId: session.id,
          role: session.role,
          activeOrgId: session.activeOrgId,
          reason,
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
          ts: Date.now(),
        });
      }

      if (persistTokens) {
        if (payload.accessToken !== undefined) {
          setAccessToken(payload.accessToken, tokenReason);
        }
        if (payload.refreshToken !== undefined) {
          setRefreshToken(payload.refreshToken, tokenReason);
        }
        if (payload.expiresAt || payload.refreshExpiresAt) {
          const issuedAt = getSkewedNow();
          const metadata: SessionMetadata = {
            accessExpiresAt: payload.expiresAt ?? undefined,
            refreshExpiresAt: payload.refreshExpiresAt ?? undefined,
            accessIssuedAt: payload.expiresAt ? issuedAt : undefined,
            refreshIssuedAt: payload.refreshExpiresAt ? issuedAt : undefined,
          };
          setSessionMetadata(metadata);
          setSessionMetaVersion((value) => value + 1);
        }
        // Update canonical (in-memory) session snapshot so all modules can
        // synchronously read the live access token / session state without
        // querying Supabase directly.
        try {
          setCanonicalSession({
            accessToken: payload.accessToken ?? getAccessToken() ?? null,
            refreshToken: payload.refreshToken ?? null,
            userId: session.id ?? null,
            userEmail: session.email ?? null,
            activeOrgId: resolvedState.activeOrgId ?? null,
            authenticated: true,
          });
          if (import.meta.env?.DEV) {
            // Helpful debug trace when running locally so developers can see
            // that the in-memory canonical session snapshot was populated.
            // This log is intentionally verbose and only enabled in dev.
            // eslint-disable-next-line no-console
            console.debug('[AUTH DEBUG] canonical session set', {
              userId: session.id ?? null,
              accessTokenPresent: Boolean(payload.accessToken ?? getAccessToken()),
              activeOrgId: resolvedState.activeOrgId ?? null,
            });
          }
        } catch (e) {
          console.warn('[SecureAuth] setCanonicalSession failed', e);
        }
      }
    },
  [clearMembershipRetryBackoff, getSkewedNow, requestedOrgHint, setUser, setMemberships, setMembershipStatus, setOrganizationIds, setActiveOrgIdState, setIsAuthenticated],
  );

  const handleSessionUnauthorized = useCallback(
    ({
      silent = false,
      reason = 'session_unauthenticated',
      message,
      shouldRedirect = true,
    }: { silent?: boolean; reason?: string; message?: string; shouldRedirect?: boolean } = {}) => {
      const hadSession = hasAuthenticatedSessionRef.current;

      // CRITICAL GUARD: a silent/background session check (e.g. membership retry)
      // must NEVER overwrite a confirmed authenticated session.  Only allow the
      // 401 handler to destroy auth state when the call was not silent OR when no
      // authenticated session has ever been established.
      if (silent && hadSession) {
        if (import.meta.env?.DEV) {
          console.warn('[AUTH_RESET] handleSessionUnauthorized SUPPRESSED (silent + hadSession)', {
            reason,
            pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
            hadUser: hadSession,
            hadToken: Boolean(getAccessToken()),
          });
        }
        return;
      }

      if (import.meta.env?.DEV) {
        console.warn('[AUTH_RESET]', {
          source: 'handleSessionUnauthorized',
          reason,
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
          hadUser: hadSession,
          hadToken: Boolean(getAccessToken()),
        });
      }

      setShouldRedirectToLogin(shouldRedirect);
      applySessionPayload(null, { persistTokens: true, reason });
      setAuthStatus('unauthenticated', `handleSessionUnauthorized:${reason}`);
      lastSessionFetchResultRef.current = 'unauthenticated';
      if (!silent) {
        setBootstrapError(null);
      }
      if (hadSession && !silent) {
        toast.error(message ?? 'Your session expired. Please sign in again.', { id: 'session-expired' });
      }
    },
    [applySessionPayload, setAuthStatus],
  );

  const headersToRecord = (headers?: Headers): Record<string, string> | undefined => {
    if (!headers) return undefined;
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  };

  const extractMessage = (payload: unknown): string | undefined => {
    if (!payload) return undefined;
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object') {
      const data = payload as Record<string, unknown>;
      for (const key of ['message', 'error', 'detail', 'code']) {
        const value = data[key];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
    }
    return undefined;
  };

  const isNoTokenUnauthorized = (status: number, payload: unknown) => {
    if (status !== 401) return false;
    const normalizedPayload = normalizeSessionResponsePayload(payload);
    if (normalizedPayload === null) {
      const message = extractMessage(payload)?.toLowerCase() ?? '';
      return message.includes('no token provided');
    }
    return false;
  };
  const isServerOrNetworkErrorStatus = (status?: number | null) => {
    if (status === 0) return true;
    if (typeof status !== 'number') return false;
    return status >= 500;
  };

  const requestJsonWithClock = useCallback(
    async <T,>(path: string, options: Parameters<typeof apiRequestRaw>[1] = {}): Promise<T> => {
      const method = String(options?.method ?? 'GET').toUpperCase();
      const shouldDedupe =
        method === 'GET' &&
        (path === '/auth/session' || path === '/api/auth/session' || path === '/api/admin/me');

      const execute = async (): Promise<T> => {
      let response: Response;
      try {
        response = await apiRequestRaw(path, options);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        const isAbort =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError');
        if (isAbort || error instanceof TypeError) {
          throw new ApiError('network_error', 0, typeof path === 'string' ? path : 'unknown', {
            message: 'Network error—please try again.',
          });
        }
        throw error;
      }

      captureServerClock(headersToRecord(response.headers));
      const contentTypeHeader = response.headers.get('content-type');
      const normalizedType = contentTypeHeader?.toLowerCase().trim() ?? '';
      const rawBody = await response.clone().text().catch(() => '');
      let payload: unknown = null;

      if (!normalizedType || rawBody === '') {
        payload = rawBody === '' ? null : rawBody;
      } else if (normalizedType.includes('application/json')) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          throw new ApiError('invalid_json', response.status, response.url, rawBody || null);
        }
      } else {
        payload = rawBody;
      }

      return payload as T;
      };

      if (!shouldDedupe) {
        return execute();
      }

      const inflightKey = `${method}:${path}`;
      const existing = rawRequestInflightRef.current.get(inflightKey);
      if (existing) {
        return existing as Promise<T>;
      }

      const requestPromise = execute().finally(() => {
        rawRequestInflightRef.current.delete(inflightKey);
      });
      rawRequestInflightRef.current.set(inflightKey, requestPromise as Promise<unknown>);
      return requestPromise;
    },
    [captureServerClock],
  );

  const triggerMembershipSelfHeal = useCallback(
    async ({
      userId: providedUserId,
      orgId: providedOrgId,
      reason,
    }: { userId?: string | null; orgId?: string | null; reason?: string } = {}): Promise<boolean> => {
      const tracker = membershipSelfHealTrackerRef.current;
      const userId = providedUserId ?? user?.id ?? null;
      const orgId =
        providedOrgId ??
        requestedOrgHint ??
  activeOrgId ??
        user?.activeOrgId ??
        user?.organizationId ??
        null;
      if (!userId || !orgId) {
        return false;
      }
      if (!tracker.shouldAttempt(userId, orgId)) {
        return false;
      }
      try {
        const payload = await requestJsonWithClock<{ ensured?: boolean }>('/api/auth/self-heal-membership', {
          method: 'POST',
          requireAuth: true,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: reason ?? 'auto',
          }),
        });
        const ensured = Boolean((payload as { ensured?: boolean } | null | undefined)?.ensured);
        if (!ensured && import.meta.env?.DEV) {
          console.info('[SecureAuth] membership_self_heal_noop', { userId, orgId, reason: reason ?? 'auto' });
        }
        return ensured;
      } catch (error) {
        console.warn('[SecureAuth] membership_self_heal_request_failed', {
          userId,
          orgId,
          reason,
          error: error instanceof Error ? error.message : error,
        });
        return false;
      }
    },
  [requestJsonWithClock, requestedOrgHint, user],
  );

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(true);
  const clearBootstrapFailOpenTimer = useCallback(() => {
    if (bootstrapFailOpenTimerRef.current) {
      clearTimeout(bootstrapFailOpenTimerRef.current);
      bootstrapFailOpenTimerRef.current = null;
    }
  }, []);
  const continueAsGuest = useCallback(
    (reason: string, options?: { redirect?: boolean }) => {
      const redirect = options?.redirect ?? true;

      // CRITICAL GUARD: never wipe an already-confirmed authenticated session from
      // a background/silent path (e.g. a membership retry that gets a transient 401).
      // Only allow continueAsGuest to destroy auth state if:
      //   1. We have never successfully authenticated (cold boot failures), OR
      //   2. The caller explicitly acknowledges it is doing a real logout.
      // "bootstrap_" prefixes are always allowed (they run before any auth is set).
      // Everything else is allowed only if no authenticated session exists yet.
      const isBootstrapReason = reason.startsWith('bootstrap_');
      const isLogoutReason = reason === 'manual_logout' || reason === 'refresh_rejected';
      if (!isBootstrapReason && !isLogoutReason && hasAuthenticatedSessionRef.current) {
        if (import.meta.env?.DEV) {
          console.warn('[AUTH_RESET] continueAsGuest SUPPRESSED — live authenticated session preserved', {
            reason,
            pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
            hadUser: true,
            hadToken: Boolean(getAccessToken()),
          });
        }
        return;
      }

      if (import.meta.env?.DEV) {
        console.warn('[AUTH_RESET]', {
          source: 'continueAsGuest',
          reason,
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
          hadUser: hasAuthenticatedSessionRef.current,
          hadToken: Boolean(getAccessToken()),
        });
      }

  setShouldRedirectToLogin(redirect);
  clearBootstrapFailOpenTimer();
  applySessionPayload(null, { persistTokens: true, reason });
  setAuthStatus('unauthenticated', `continueAsGuest:${reason}`);
  setSessionStatus('unauthenticated', `continueAsGuest:${reason}`);
  setAuthInitializing(false);
  setBootstrapError(reason.startsWith('bootstrap_') ? 'Session bootstrap failed. Please log in.' : null);
  lastSessionFetchResultRef.current = 'unauthenticated';
    },
    [applySessionPayload, clearBootstrapFailOpenTimer, setAuthInitializing, setAuthStatus, setBootstrapError, setSessionStatus],
  );
  const forceLogout = useCallback(
    async (reason: string) => {
      try {
        const supabaseClient = getSupabase();
        await supabaseClient?.auth.signOut();
      } catch (signOutError) {
        console.warn('[SecureAuth] forceLogout signOut failed', signOutError);
      }
      // forceLogout must always proceed regardless of current auth state.
      // We temporarily clear hasAuthenticatedSessionRef so continueAsGuest's
      // guard does not suppress the state reset.
      hasAuthenticatedSessionRef.current = false;
      continueAsGuest(reason);
    },
    [continueAsGuest],
  );
  useEffect(
    () => () => {
      clearBootstrapFailOpenTimer();
    },
    [clearBootstrapFailOpenTimer],
  );

  const fetchServerSession = useCallback(
    async ({
      surface,
      signal,
      silent,
      allowRefresh = true,
      skipMembershipSelfHeal = false,
    }: {
      surface?: SessionSurface;
      signal?: AbortSignal;
      silent?: boolean;
      allowRefresh?: boolean;
      skipMembershipSelfHeal?: boolean;
    } = {}): Promise<boolean> => {
      let storedAccessToken: string | null = null;
      let storedRefreshToken: string | null = null;
      try {
        const { accessToken, refreshToken } = await readSupabaseSessionTokens({ refreshIfMissing: true });
        storedAccessToken = accessToken;
        storedRefreshToken = refreshToken;
      } catch (tokenError) {
        console.warn('[SecureAuth] Failed to inspect Supabase session for fetch', tokenError);
      }
      const hasStoredToken = Boolean(storedAccessToken || storedRefreshToken);
      const requestId = ++membershipFetchRequestIdRef.current;
      const startedAt = Date.now();
      const finalizeMeta = (meta: Partial<MembershipFetchMeta>) => {
        recordMembershipFetchMeta({
          requestId,
          startedAt,
          finishedAt: Date.now(),
          statusCode: meta.statusCode ?? null,
          membershipCount: meta.membershipCount ?? null,
          reason: meta.reason ?? null,
        });
      };
      try {
        setMembershipStatus('loading');
        const fetchPayload = async () => {
          const payloadRaw = await requestJsonWithClock<unknown>('/auth/session', {
            method: 'GET',
            signal,
            requireAuth: true,
          });
          return normalizeSessionResponsePayload(payloadRaw);
        };
  let payload = await fetchPayload();
  e2eLog('fetch_server_session_payload', { membershipCount: Array.isArray(payload?.memberships) ? payload?.memberships.length : null, activeOrgId: payload?.activeOrgId ?? null, payloadKeys: payload ? Object.keys(payload) : null });
        let membershipStateFromPayload = normalizeMembershipStatusFlag(
          payload?.membershipStatus,
          payload?.membershipDegraded
        );
        const membershipTrusted = membershipStateFromPayload === 'ready';
        let membershipCount =
          membershipTrusted && Array.isArray(payload?.memberships) ? payload?.memberships?.length ?? 0 : 0;
        if (payload?.user && membershipTrusted && membershipCount === 0 && !skipMembershipSelfHeal) {
          const healed = await triggerMembershipSelfHeal({
            userId: payload.user.id,
            orgId:
              payload.activeOrgId ||
              payload.user?.activeOrgId ||
              payload.user?.organizationId ||
              null,
            reason: 'session_fetch_empty',
          });
          if (healed) {
            if (signal?.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }
            payload = await fetchPayload();
            membershipStateFromPayload = normalizeMembershipStatusFlag(
              payload?.membershipStatus,
              payload?.membershipDegraded
            );
            membershipCount =
              membershipStateFromPayload === 'ready' && Array.isArray(payload?.memberships)
                ? payload?.memberships?.length ?? 0
                : 0;
          }
        }
        if (payload?.user) {
          const normalizedPayload: SessionResponsePayload = {
            ...payload,
            memberships: membershipTrusted ? payload.memberships ?? [] : [],
            membershipStatus: membershipStateFromPayload,
            membershipDegraded: membershipStateFromPayload !== 'ready',
            membershipCount: membershipTrusted ? membershipCount : null,
          };
          applySessionPayload(normalizedPayload, {
            surface,
            persistTokens: false,
            reason: surface ? `${surface}_session_bootstrap` : 'session_bootstrap',
          });
          setAuthStatus('authenticated', `fetchServerSession:${surface ?? 'unknown'}`);
          setSessionStatus('authenticated', `fetchServerSession:${surface ?? 'unknown'}`);
          try { ensureLightMode(); } catch (_) { /* noop */ }
          if (!silent) {
            setBootstrapError(null);
          }
          const rawMemberships =
            membershipTrusted && Array.isArray(payload.memberships) ? payload.memberships : [];
          console.info('[SESSION BOOTSTRAPPED]', {
            surface: surface ?? 'unknown',
            userId: payload.user.id ?? null,
            membershipCount: rawMemberships.length,
            membershipStatus: membershipStateFromPayload,
          });
          const firstMembershipOrgId =
            rawMemberships.find((row) => row?.orgId || row?.organizationId || row?.organization_id)?.orgId ??
            rawMemberships.find((row) => row?.organizationId || row?.organization_id)?.organizationId ??
            rawMemberships.find((row) => row?.organization_id)?.organization_id ??
            null;
          const diagMembershipStatus: 'idle' | 'loading' | 'ready' | 'error' =
            membershipStateFromPayload === 'ready' ? 'ready' : 'error';
          const diagLine = [
            `userId=${payload.user.id ?? 'unknown'}`,
            `membershipStatus=${diagMembershipStatus}`,
            `membershipCount=${rawMemberships.length}`,
            `activeOrgId=${lastAppliedActiveOrgIdRef.current ?? 'none'}`,
            `activeOrgSource=${lastActiveOrgSourceRef.current}`,
            `firstMembershipOrg=${firstMembershipOrgId ?? 'none'}`,
          ].join(' ');
          if (import.meta.env?.DEV) {
            console.info('[SecureAuth] membership_applied', diagLine);
          }
          void courseStore
            .init({ reason: 'auth_membership_applied', surface: surface ?? (typeof window !== 'undefined' && isAdminSurface(window.location?.pathname ?? '') ? 'admin' : 'lms') })
            .catch((error: unknown) => console.warn('[SecureAuth] courseStore.init retry failed', error));
          finalizeMeta({
            statusCode: 200,
            membershipCount: membershipTrusted ? membershipCount : null,
            reason:
              membershipTrusted && membershipCount === 0 ? 'empty_memberships' : membershipStateFromPayload === 'ready'
              ? null
              : membershipStateFromPayload,
          });
          return true;
        }
        handleSessionUnauthorized({
          silent,
          reason: 'session_bootstrap_empty',
          shouldRedirect: false,
        });
        finalizeMeta({ statusCode: 200, membershipCount: 0, reason: 'session_bootstrap_empty' });
        continueAsGuest('session_bootstrap_empty', { redirect: false });
        return false;
      } catch (error) {
        if (error instanceof NotAuthenticatedError) {
          finalizeMeta({ statusCode: 401, reason: 'not_authenticated' });
          handleSessionUnauthorized({
            silent: true,
            reason: surface ? `${surface}_session_no_backend_token` : 'session_no_backend_token',
            shouldRedirect: true,
          });
          continueAsGuest(surface ? `${surface}_session_no_backend_token` : 'session_no_backend_token');
          return false;
        }
        if (error instanceof AuthExpiredError) {
          finalizeMeta({ statusCode: 401, reason: 'session_expired' });
          handleSessionUnauthorized({
            silent: true,
            reason: surface ? `${surface}_session_expired` : 'session_expired',
            shouldRedirect: true,
          });
          continueAsGuest(surface ? `${surface}_session_expired` : 'session_expired');
          return false;
        }
        if (error instanceof ApiError) {
          const noTokenUnauth =
            error.status === 401 && !hasStoredToken && isNoTokenUnauthorized(error.status, error.body);
          if (noTokenUnauth) {
            finalizeMeta({ statusCode: error.status, reason: 'no_token' });
            handleSessionUnauthorized({
              silent: true,
              reason: surface ? `${surface}_session_no_token` : 'session_no_token',
              shouldRedirect: true,
            });
            continueAsGuest(surface ? `${surface}_session_no_token` : 'session_no_token');
            return false;
          }
          if (error.status === 401 || error.status === 403) {
            finalizeMeta({ statusCode: error.status, reason: 'unauthorized' });
            if (allowRefresh && hasStoredToken) {
              const refreshFn = refreshTokenCallbackRef.current;
              if (refreshFn) {
                const recovered = await refreshFn({ reason: 'protected_401' });
                if (recovered) {
                  return fetchServerSession({ surface, signal, silent, allowRefresh: false, skipMembershipSelfHeal });
                }
              }
            }
            if (import.meta.env.DEV) {
              console.debug('[SecureAuth][dev] ApiError session status', { status: error.status, surface });
            }
            handleSessionUnauthorized({
              silent,
              reason: surface ? `${surface}_session_unauthenticated` : 'session_unauthenticated',
              shouldRedirect: true,
            });
            continueAsGuest(surface ? `${surface}_session_unauthenticated` : 'session_unauthenticated_api_error');
            return false;
          }
          if ((error.body as any)?.code === 'timeout' || isServerOrNetworkErrorStatus(error.status)) {
            lastSessionFetchResultRef.current = 'error';
            setMembershipStatus('degraded');
            scheduleMembershipRetryBackoff('network_error');
            if (!silent) {
              setBootstrapError('Network issue while restoring your session. We will keep retrying in the background.');
            }
            if (import.meta.env.DEV) {
              console.warn('[Auth] auth_restore: error (timeout/network)', { surface, status: error.status });
            }
            finalizeMeta({ statusCode: error.status ?? 0, reason: 'network_error' });
            return false;
          }
          setMembershipStatus('error');
          handleSessionUnauthorized({
            silent,
            reason: surface ? `${surface}_session_http_${error.status ?? 'unknown'}` : 'session_http_api_error',
            message: (error.body as { message?: string } | undefined)?.message,
            shouldRedirect: false,
          });
          finalizeMeta({ statusCode: error.status ?? 0, reason: 'session_http_error' });
          continueAsGuest(surface ? `${surface}_session_http_${error.status ?? 'unknown'}` : 'session_http_api_error', {
            redirect: false,
          });
          return false;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          lastSessionFetchResultRef.current = 'error';
          setMembershipStatus('error');
          if (!silent) {
            setBootstrapError('Session check canceled. Please retry.');
          }
          if (import.meta.env.DEV) {
            console.warn('[Auth] auth_restore: error (abort)', { surface });
          }
          finalizeMeta({ statusCode: 0, reason: 'abort' });
          return false;
        }
        if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
          lastSessionFetchResultRef.current = 'error';
          setMembershipStatus('error');
          if (!silent) {
            setBootstrapError('Session check canceled. Please retry.');
          }
          if (import.meta.env.DEV) {
            console.warn('[Auth] auth_restore: error (axios cancel)', { surface });
          }
          finalizeMeta({ statusCode: 0, reason: 'axios_cancel' });
          return false;
        }
        if (!silent) {
          setBootstrapError('Network issue while restoring your session. Please check your connection and retry.');
        }
        setMembershipStatus('degraded');
        scheduleMembershipRetryBackoff('unknown_error');
        lastSessionFetchResultRef.current = 'error';
        console.warn('[SecureAuth] Failed to reload session', error);
        if (import.meta.env.DEV) {
          console.warn('[Auth] auth_restore: error (network)', { surface });
        }
        finalizeMeta({ statusCode: 0, reason: 'unknown_error' });
        return false;
      }
    },
    [
      applySessionPayload,
      continueAsGuest,
      forceLogout,
      handleSessionUnauthorized,
      recordMembershipFetchMeta,
      requestJsonWithClock,
      scheduleMembershipRetryBackoff,
      triggerMembershipSelfHeal,
    ],
  );
  // ============================================================================
  // Token Refresh
  // ============================================================================
  const refreshTokenCallback = useCallback(
    async (options: RefreshOptions = {}): Promise<boolean> => {
      return runRefreshTokenCallback(options, {
        hasAuthenticatedSessionRef,
        hasAttemptedRefreshRef,
        refreshAttemptedRef,
        refreshRunCountRef,
        lastRefreshAttemptRef,
        lastRefreshSuccessRef,
        queueRefresh,
        getSkewedNow,
        buildSessionAuditHeaders,
        applySessionPayload,
        setAuthStatus,
        setSessionStatus,
        fetchServerSession,
        logAuthDebug,
        logRefreshResult,
        MIN_REFRESH_INTERVAL_MS,
        isNavigatorOffline,
      });
    },
    [applySessionPayload, fetchServerSession, getSkewedNow],
  );

  useEffect(() => {
    fetchServerSessionRef.current = fetchServerSession;
  }, [fetchServerSession]);

  useEffect(() => {
    refreshTokenCallbackRef.current = refreshTokenCallback;
    // Mark this context as the central refresh manager so lower-level
    // HTTP helpers defer refresh attempts to us and avoid duplicate
    // concurrent /api/auth/refresh requests.
    try {
      setRefreshManagerActive(true);
    } catch (e) {
      // ignore in test environments where module mocks may differ
    }
    return () => {
      try {
        setRefreshManagerActive(false);
      } catch (e) {
        // ignore
      }
    };
  }, [refreshTokenCallback]);

  const runBootstrap = useCallback(
    async (signal?: AbortSignal, runId?: number) => {
      const isStale = () => typeof runId === 'number' && bootstrapRunIdRef.current !== runId;

      // Short-circuit: if login path we treat as unauthenticated but do not
      // proceed with normal bootstrap orchestration.
      if (isLoginPath()) {
        continueAsGuest('bootstrap_login_route');
        return;
      }

      // Start deterministic bootstrap
      setAuthBootstrapping(true);
      setAuthInitializing(true);
      setBootstrapError(null);
      setAuthBootstrapState('loading_local_session');
      // best-effort telemetry (cast to any to avoid strict AuditEvent typing here)
      try {
        (enqueueAudit as any)?.({ event: 'bootstrap_start', ts: Date.now() });
      } catch (_) {
        /* ignore telemetry errors */
      }
      console.info('[AUTH BOOTSTRAP] start', { ts: Date.now() });
  e2eLog('bootstrap_start', { ts: Date.now(), pathname: typeof window !== 'undefined' ? window.location?.pathname : '' });

      try {
        // STEP 1: Load local session tokens (supabase/canonical)
              try {
                // Read any locally persisted Supabase/canonical tokens.
                const { accessToken: _localAccess, refreshToken: _localRefresh } = await readSupabaseSessionTokens({ refreshIfMissing: true });
                // If no local session is present and we're running in DEV (not E2E),
                // attempt a non-interactive debug login to auto-bootstrap a session.
                // This calls the server's dev-only /api/auth/_debug/demo-login endpoint
                // which is enabled when ALLOW_DEBUG_LOGIN=true on the backend.
                const hasLocalToken = Boolean(_localAccess || _localRefresh);
                const debugAutoLoginEnabled = String((import.meta as any)?.env?.VITE_ENABLE_DEBUG_LOGIN ?? '').toLowerCase() === 'true';
                if (debugAutoLoginEnabled && !hasLocalToken && import.meta.env?.DEV && !(typeof window !== 'undefined' && (window as any).__E2E_BYPASS)) {
                  try {
                    if (import.meta.env?.DEV) console.info('[AUTH DEBUG] attempting auto demo-login');
                    const demoEmail = (import.meta as any)?.env?.VITE_DEMO_SMOKE_EMAIL ?? 'mya@the-huddle.co';
                    const demoPassword = (import.meta as any)?.env?.VITE_DEMO_SMOKE_PASSWORD ?? 'admin123';
                    const res = await apiRequestRaw('/api/auth/_debug/demo-login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: { email: demoEmail, password: demoPassword },
                      allowAnonymous: true,
                      skipAdminGateCheck: true,
                    });
                    if (res && res.ok) {
                      const body = await res.json().catch(() => null);
                      const normalized = normalizeSessionResponsePayload(body ?? null);
                      if (normalized) {
                        if (import.meta.env?.DEV) console.info('[AUTH DEBUG] demo-login returned session payload — applying');
                        applySessionPayload(normalized, { persistTokens: true, reason: 'debug_auto_login' });
                      }
                    } else {
                      if (import.meta.env?.DEV) console.warn('[AUTH DEBUG] demo-login request did not succeed', res && typeof res.status === 'number' ? res.status : res);
                    }
                  } catch (dbgErr) {
                    console.warn('[AUTH DEBUG] demo-login failed', dbgErr);
                  }
                }
              } catch (e) {
                console.warn('[SecureAuth] failed to read local session tokens', e);
              }
              // Install a fail-fast timer so the UI won't remain stuck on the
              // initializing spinner indefinitely while developers iterate.
              try {
                clearBootstrapFailOpenTimer();
                if (typeof window !== 'undefined') {
                  bootstrapFailOpenTimerRef.current = window.setTimeout(() => {
                    if (authInitializing) {
                      console.error('AUTH BOOTSTRAP FAILED: no session');
                      setAuthInitializing(false);
                      setAuthStatus('unauthenticated', 'bootstrap:timeout');
                      setSessionStatus('unauthenticated', 'bootstrap:timeout');
                      setBootstrapError('AUTH BOOTSTRAP FAILED: no session');
                    }
                  }, 8000);
                }
              } catch (timerErr) {
                // ignore timer setup failures in non-browser environments
              }
        if (isStale()) return;

        setAuthBootstrapState('validating_session');

        // STEP 2 & 3: Validate / refresh token if needed and fetch server session
        setAuthBootstrapState('fetching_server_session');
        const fetchFn = fetchServerSessionRef.current ?? fetchServerSession;
        let sessionRestored = false;
        try {
          sessionRestored = await fetchFn({ signal, silent: false, allowRefresh: true });
        } catch (error) {
          // Preserve original bootstrap error handling semantics so tests and
          // callers relying on specific messages behave as before.
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          if (isStale()) return;
          if (error instanceof NotAuthenticatedError) {
            continueAsGuest('bootstrap_no_backend_token');
            return;
          }
          if (error instanceof AuthExpiredError) {
            continueAsGuest('bootstrap_unauthenticated');
            return;
          }
          if (error instanceof ApiError) {
            if (error.status === 401 || error.status === 403) {
              console.debug('[SecureAuth] runBootstrap detected 401/403, attempting refresh', {
                status: error.status,
                reason: 'bootstrap_401',
              });
              const refreshFn = refreshTokenCallbackRef.current;
              if (refreshFn) {
                try {
                  const recovered = await refreshFn({ reason: 'user_retry' });
                  console.debug('[SecureAuth] refreshTokenCallback result', { recovered });
                  if (isStale()) return;
                  if (recovered) {
                    setAuthStatus('authenticated', 'runBootstrap:refresh_recovery');
                    setBootstrapError(null);
                    return;
                  }
                } catch (refreshErr) {
                  console.warn('[SecureAuth] refresh attempt failed', refreshErr);
                }
              }
              continueAsGuest('bootstrap_unauthenticated');
              return;
            }

            const severeServerError = isServerOrNetworkErrorStatus(error.status);
            console.warn('[SecureAuth] runBootstrap caught ApiError', {
              status: error.status,
              severeServerError,
              authStatus: authStatus,
              bootstrapError: bootstrapError,
            });
            if (severeServerError) {
              lastSessionFetchResultRef.current = 'error';
              setBootstrapError('Network issue while restoring your session. Please retry.');
              setAuthStatus('error');
              setShouldRedirectToLogin(false);
            } else {
              continueAsGuest('bootstrap_http_error', { redirect: false });
            }
            return;
          }

          lastSessionFetchResultRef.current = 'error';
          setBootstrapError('Network issue while restoring your session. Please retry.');
          setAuthStatus('error');
          return;
        }
  // record result for E2E diagnostics
  e2eLog('fetch_server_session_result', { sessionRestored });
        if (isStale()) return;

        if (!sessionRestored && !hasAuthenticatedSessionRef.current) {
          // No valid session available — mark unauthenticated and stop.
          setAuthStatus('unauthenticated', 'bootstrap:no_session');
          setSessionStatus('unauthenticated', 'bootstrap:no_session');
          setAuthBootstrapState('error');
          // Do not set a blocking bootstrap error on cold-boot without a
          // session. Tests and callers expect the app to remain usable and
          // allow explicit login flows to surface without showing a modal
          // overlay. Network/degraded errors will have already set
          // bootstrapError in fetchServerSession and should be preserved.
          try {
            (enqueueAudit as any)?.({ event: 'bootstrap_failure', reason: 'no_session', ts: Date.now() });
          } catch (_) {
            /* ignore */
          }
          console.info('[AUTH BOOTSTRAP] no session, aborting');
          return;
        }

        // STEP 4: memberships should have been set by fetchServerSession; ensure
        // we operate on the latest snapshot.
        setAuthBootstrapState('fetching_memberships');
        if (isStale()) return;

        // STEP 5: Resolve activeOrgId deterministically from memberships and
        // requested hint only.
        setAuthBootstrapState('resolving_org');

        const currentMemberships = membershipsSnapshotRef.current.length ? membershipsSnapshotRef.current : memberships;
        const requestedHint = requestedOrgHint;
        let resolvedOrg: string | null = null;
        if (requestedHint && currentMemberships.some((m) => m.orgId === requestedHint)) {
          resolvedOrg = requestedHint;
          lastActiveOrgSourceRef.current = 'requested_hint';
        } else if (currentMemberships.length > 0) {
          // deterministic choice: pick the first membership (server orders may be deterministic)
          resolvedOrg = currentMemberships[0].orgId ?? null;
          lastActiveOrgSourceRef.current = 'membership_default';
        } else {
          resolvedOrg = null;
          lastActiveOrgSourceRef.current = 'none';
        }
        lastAppliedActiveOrgIdRef.current = resolvedOrg;
  setActiveOrgIdState(resolvedOrg);
  e2eLog('resolved_org', { resolvedOrg, lastActiveOrgSource: lastActiveOrgSourceRef.current });

        // STEP 6: Write a single bridge snapshot reflecting final membership/org
        // resolution. This guarantees stores can rely on a single well-formed
        // snapshot after bootstrap completes.
        const finalMembershipStatus = membershipStatusRef.current ?? membershipStatus;
        const finalStatus = finalMembershipStatus === 'ready' ? 'ready' : 'degraded';
        try {
          // writeBridgeSnapshot expects a `status` field; choose 'ready' when
          // memberships are ready/degraded so stores can proceed to read the
          // org snapshot synchronously. membershipStatus preserves degraded.
          const normalizedStatus: 'idle' | 'loading' | 'ready' | 'error' =
            finalMembershipStatus === 'ready' || finalMembershipStatus === 'degraded' ? 'ready' : 'loading';
          writeBridgeSnapshot({
            status: normalizedStatus,
            membershipStatus: finalMembershipStatus as any,
            activeOrgId: resolvedOrg,
            orgId: resolvedOrg,
            role: user?.role ?? null,
            userId: user?.id ?? null,
          });
        } catch (e) {
          console.warn('[SecureAuth] writeBridgeSnapshot failed', e);
        }

        // STEP 7: Finalize bootstrap outcome
        if (finalStatus === 'ready') {
          setAuthBootstrapState('ready');
          setAuthStatus('authenticated', 'bootstrap:ready');
          setSessionStatus('authenticated', 'bootstrap:ready');
          try {
            (enqueueAudit as any)?.({ event: 'bootstrap_success', ts: Date.now() });
          } catch (_) { void 0; }
          console.info('[AUTH BOOTSTRAP] ready', { userId: user?.id ?? null, orgId: resolvedOrg });
          e2eLog('bootstrap_ready', { userId: user?.id ?? null, orgId: resolvedOrg, membershipStatus: finalMembershipStatus });
        } else {
          setAuthBootstrapState('degraded');
          setAuthStatus('authenticated', 'bootstrap:degraded');
          setSessionStatus('authenticated', 'bootstrap:degraded');
          // Preserve degraded state for stores but do not render a blocking
          // bootstrap error overlay — allow the app to continue while
          // indicating degraded membership resolution.
          try {
            (enqueueAudit as any)?.({ event: 'bootstrap_degraded', ts: Date.now() });
          } catch (_) { void 0; }
          console.warn('[AUTH BOOTSTRAP] degraded', { userId: user?.id ?? null, orgId: resolvedOrg });
          e2eLog('bootstrap_degraded', { userId: user?.id ?? null, orgId: resolvedOrg, membershipStatus: finalMembershipStatus });
        }
      } catch (err) {
        console.error('[AUTH BOOTSTRAP] unexpected error', err);
        setAuthBootstrapState('error');
        setAuthStatus('error', 'bootstrap:unexpected');
        setSessionStatus('unauthenticated', 'bootstrap:unexpected');
        setBootstrapError('Unexpected error during bootstrap.');
        try {
          (enqueueAudit as any)?.({ event: 'bootstrap_error', error: String(err), ts: Date.now() });
        } catch (_) { void 0; }
      } finally {
        if (!isStale()) {
          // Clear the fail-open timer (if installed) so we don't fire a timeout
          // after the bootstrap run already completed.
          try {
            clearBootstrapFailOpenTimer();
          } catch (e) {
            /* ignore */
          }
          setAuthInitializing(false);
          setAuthBootstrapping(false);
          console.debug('[AUTH BOOTSTRAP] complete', { ts: Date.now() });
          e2eLog('bootstrap_complete', { ts: Date.now(), authStatus: authStatusRef.current, sessionStatus: sessionStatusRef.current, authBootstrapState });
        }
      }
    },
    [applySessionPayload, continueAsGuest, fetchServerSession, memberships, requestedOrgHint, user, membershipStatus],
  );

  const runBootstrapRef = useRef(runBootstrap);
  useEffect(() => {
    runBootstrapRef.current = runBootstrap;
  }, [runBootstrap]);

  const startBootstrap = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      if (!force && bootstrappedRef.current) {
        return;
      }
      // E2E/dev bypass logic fully removed for launch readiness.
      if (isLoginPath()) {
        bootstrappedRef.current = true;
        // Fail-safe: ensure UI never deadlocks
        // no timers used in deterministic bootstrap
        continueAsGuest('bootstrap_login_route');
        setAuthInitializing(false);
        setAuthStatus('unauthenticated', 'bootstrap_login_route_failopen');
        setSessionStatus('unauthenticated', 'bootstrap_login_route_failopen');
        setBootstrapError('Login route: fail-open fallback.');
        console.warn('[SecureAuth] fail-open: login route, forced unauthenticated');
        return;
      }
      bootstrappedRef.current = true;
      // Abort any previous bootstrap run and start a fresh deterministic run
      bootstrapControllerRef.current?.abort();
      const controller = new AbortController();
      bootstrapControllerRef.current = controller;
      // Stamp a new run ID so in-flight older runs can detect they are stale.
      const runId = ++bootstrapRunIdRef.current;
      const runner = runBootstrapRef.current;
      if (runner) {
  runner(controller.signal, runId).catch((error: unknown) => {
          // Fail-safe: ensure UI never deadlocks
          setAuthInitializing(false);
          setAuthStatus('error', 'bootstrap_run_error');
          setSessionStatus('unauthenticated', 'bootstrap_run_error');
          setBootstrapError('Bootstrap run failed.');
          console.warn('[SecureAuth] Bootstrap run failed, forced fail-open', error);
        });
      } else {
        // Fail-safe: runner missing
        setAuthInitializing(false);
        setAuthStatus('error', 'bootstrap_runner_missing');
        setSessionStatus('unauthenticated', 'bootstrap_runner_missing');
        setBootstrapError('Bootstrap runner missing.');
        console.warn('[SecureAuth] Bootstrap runner missing, forced fail-open');
      }
    },
    [continueAsGuest, setAuthInitializing, setAuthStatus, setSessionStatus, setBootstrapError],
  );

  const retryBootstrap = useCallback(() => {
    // Enforce a 2-second minimum cooldown between retries to prevent rapid-fire
    // external calls (e.g. button spam) from hammering the Supabase auth endpoint.
    const now = Date.now();
    if (now - lastRetryTimestampRef.current < 2_000) {
      return;
    }
    lastRetryTimestampRef.current = now;
    bootstrappedRef.current = false;
  setAuthBootstrapState('not_started');
    // Reset the single-use refresh lock so a fresh bootstrap attempt can
    // trigger token refresh again if needed (e.g., user clicks "Retry" after
    // a 401 on a long-lived session).
    hasAttemptedRefreshRef.current = false;
    refreshAttemptedRef.current = false;
    setBootstrapError(null);
    startBootstrap({ force: true });
  }, [startBootstrap]);

  const onGoToLogin = useCallback(() => {
    applySessionPayload(null, { persistTokens: true, reason: 'bootstrap_error_redirect' });
    setBootstrapError(null);
    const fallbackPath = resolveLoginPath();
    if (typeof window !== 'undefined') {
      logAuthRedirect('SecureAuthContext.onGoToLogin', { target: fallbackPath });
      window.location.assign(fallbackPath);
    }
  }, [applySessionPayload]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return () => {
        bootstrapControllerRef.current?.abort();
        clearBootstrapFailOpenTimer();
      };
    }
    startBootstrap();
    return () => {
      bootstrapControllerRef.current?.abort();
      clearBootstrapFailOpenTimer();
    };
  }, [clearBootstrapFailOpenTimer, startBootstrap]);

  const reloadSession = useCallback(
    (options?: { surface?: SessionSurface; force?: boolean }): Promise<boolean> => {
      const now = Date.now();
      if (!options?.force && lastSessionReloadRef.current && now - lastSessionReloadRef.current < SESSION_RELOAD_THROTTLE_MS) {
        return Promise.resolve(false);
      }
      lastSessionReloadRef.current = now;
      const surface = options?.surface;
      if (surface) {
        updateSurfaceAuthStatus(surface, 'checking');
      }
      return fetchServerSession({ surface })
        .finally(() => {
          if (surface) {
            updateSurfaceAuthStatus(surface, 'ready');
          }
        });
    },
    [fetchServerSession, updateSurfaceAuthStatus],
  );

  const setActiveOrganization = useCallback(
    async (orgId: string | null) => {
      const hasMembership = Boolean(orgId && memberships.some((membership) => membership.orgId === orgId));
      const hasOrgAccess = Boolean(orgId && organizationIds.includes(orgId));
      const normalized = orgId && (hasMembership || hasOrgAccess) ? orgId : null;
      setActiveOrgPreference(normalized);
      setActiveOrgIdState(normalized);
      setUser((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          activeOrgId: normalized,
          organizationId: normalized ?? prev.organizationId ?? null,
        };
        setUserSession(next);
        return next;
      });
      try {
        await apiRequest('/api/auth/active-org', {
          method: 'PATCH',
          body: { orgId: normalized },
        });
      } catch (error) {
        console.warn('[SecureAuth] Failed to persist active org on server', error);
      }
    },
    [memberships, organizationIds],
  );

  const resolveSession = useCallback(
    async ({ surface, signal }: { surface?: SessionSurface; signal?: AbortSignal } = {}) => {
      const hadLiveSession = hasAuthenticatedSessionRef.current || Boolean(user);
      try {
        const hasUser = await fetchServerSession({ surface, signal });
        if (hasUser) {
          return true;
        }

        if (hadLiveSession) {
          if (import.meta.env?.DEV) {
            console.warn('[SecureAuth] resolveSession preserved existing session after empty result', {
              surface,
              pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
            });
          }
          return true;
        }

        applySessionPayload(null, { persistTokens: true, reason: 'resolve_session_empty' });
        return false;
      } catch (error) {
        if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
          return false;
        }
        if (hadLiveSession) {
          console.warn('[SecureAuth] resolveSession preserved existing session after error', {
            surface,
            error,
          });
          return true;
        }
        console.error('[SecureAuth] resolveSession failed', error);
        applySessionPayload(null, { persistTokens: true, reason: 'resolve_session_error' });
        return false;
      }
    },
    [applySessionPayload, fetchServerSession, user],
  );

  const loadSession = useCallback(
    async (options?: { surface?: SessionSurface }): Promise<boolean> => {
      if (sessionStatus === 'loading') {
        return false;
      }
      if (options?.surface) {
        updateSurfaceAuthStatus(options.surface, 'checking');
      }
      setSessionStatus('loading');
      try {
        const result = await resolveSession({ surface: options?.surface });
        setAuthInitializing(false);
        setSessionStatus(result ? 'authenticated' : 'unauthenticated');
        return result;
      } finally {
        if (options?.surface) {
          updateSurfaceAuthStatus(options.surface, 'ready');
        }
      }
    },
    [resolveSession, sessionStatus, updateSurfaceAuthStatus],
  );

  // ============================================================================
  // Logout
  // ============================================================================

  const logout = useCallback(
    async (type?: 'lms' | 'admin'): Promise<void> =>
      performLogout(type, {
        buildSessionAuditHeaders,
        enqueueAudit,
        setUser,
        setMemberships,
        setOrganizationIds,
        setActiveOrgIdState,
        setSessionMetaVersion,
        setAuthStatus,
        setSessionStatus,
        setIsAuthenticated,
        hasAuthenticatedSessionRef,
        user,
      }),
    [buildSessionAuditHeaders, user],
  );

  useEffect(() => {
    // Fast paths — immediately resolve to 'ready' or 'resolving'.
    if (authInitializing) {
      setOrgResolutionStatus('resolving');
      return;
    }
    if (!user) {
      setOrgResolutionStatus('ready');
      return;
    }
    if (memberships.length === 0) {
      setOrgResolutionStatus('ready');
      return;
    }
    if (activeOrgId) {
      setOrgResolutionStatus('ready');
      return;
    }

    // Edge case: user has memberships but activeOrgId hasn't resolved yet
    // (e.g., no stored preference, multi-org ambiguity, slow network).
    // Rather than staying 'resolving' forever and blocking courseStore init,
    // we install a 10-second fail-open timer.  If activeOrgId hasn't been set
    // by then we force 'ready' so the rest of the app can proceed.
    setOrgResolutionStatus('resolving');
    const failOpenTimer = window.setTimeout(() => {
      setOrgResolutionStatus((current) => {
        if (current === 'resolving') {
          if (import.meta.env.DEV) {
            console.warn('[SecureAuth] orgResolutionStatus fail-open: timed out waiting for activeOrgId; marking degraded and emitting snapshot');
          }
          try {
            writeBridgeSnapshot({
              status: 'ready',
              membershipStatus: 'degraded',
              activeOrgId: null,
              orgId: null,
              role: null,
              userId: user?.id ?? null,
            });
          } catch (e) {
            // ignore
          }
          return 'degraded';
        }
        return current;
      });
    }, 10_000);

    return () => {
      window.clearTimeout(failOpenTimer);
    };
  }, [authInitializing, user, memberships, activeOrgId]);

  // Diagnostics removed for production: useAuthDiagnostics and related debug state.

  const authActions = createAuthActions({
    buildSessionAuditHeaders,
    requestJsonWithClock,
    applySessionPayload,
    setAuthStatus,
    setSessionStatus,
    logAuthSessionState,
    enqueueAudit,
    flushAuditQueue,
  });
  // refreshTokenCallback already declared above; removed duplicate.

  const login = useCallback(authActions.login, [authActions]);
  const register = useCallback(authActions.register, [authActions]);
  const sendMfaChallenge = useCallback(authActions.sendMfaChallenge, [authActions]);
  const verifyMfa = useCallback(authActions.verifyMfa, [authActions]);
  const forgotPassword = useCallback(authActions.forgotPassword, [authActions]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = {
    isAuthenticated,
    authInitializing,
    authStatus,
    sessionStatus,
    membershipStatus,
    hasActiveMembership: Boolean(activeOrgId && memberships.some(m => m.orgId === activeOrgId)),
    surfaceAuthStatus,
    orgResolutionStatus,
    user,
    memberships,
    organizationIds,
  activeOrgId,
  lastActiveOrgId: activeOrgId, // for type compatibility, always mirrors activeOrgId
  requestedOrgId: requestedOrgHint,
    login,
    register,
    logout,
    refreshToken: refreshTokenCallback,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
    setActiveOrganization,
  setRequestedOrgHint: (orgId: string | null) => setRequestedOrgHintState(orgId?.trim() || null),
    reloadSession,
    loadSession,
    retryBootstrap
  };

  return (
    <AuthContext.Provider value={value}>
      {renderAuthState({
        authStatus,
        authInitializing,
        bootstrapError,
        onRetry: retryBootstrap,
        onGoToLogin,
        children,
        shouldRedirectToLogin,
      })}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSecureAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (!warnedMissingProvider) {
      warnedMissingProvider = true;
      console.error('[SecureAuth] Provider not found in React tree. Falling back to guest session.');
      if (import.meta.env.DEV) {
        console.info(
          '💡 Restart the dev server (npm run dev:full) to clear duplicate React bundles causing this context drift.',
          new Error().stack,
        );
      }
    }
    return defaultAuthContext;
  }
  return context;
}
