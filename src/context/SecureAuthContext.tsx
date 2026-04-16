import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
import { setGlobalActiveOrgIdForApi } from '../lib/orgContext';
import { writeBridgeSnapshot, clearBridgeSnapshot } from '../store/courseStoreOrgBridge';
// admin access snapshot helper intentionally unused in some builds
// import { clearAdminAccessSnapshot } from '../lib/adminAccess';
import { setAuthBootstrapping } from '../lib/authBootstrapState';
import {
  buildE2EBootstrapPayload,
  isE2EBootstrapBypassEnabled,
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
  deriveOrgContextSnapshot,
  normalizeMembershipStatusFlag,
  type ActiveOrgSource,
  type OrgResolutionStatus,
} from './organizationResolution';
import { runRefreshTokenCallback } from './tokenRefresh';
import { createAuthActions } from './authActions';
import {
  buildUserSessionFromPayload,
  resolveSessionStatePayload,
} from './sessionState';
import { defaultAuthContext, type AuthContextType } from './authContextContract';
import type { RefreshOptions } from './authTypes';
import { performLogout } from './sessionLifecycle';
import { renderAuthState } from './authRenderState';
import {
  logAuthDebug,
  logAuthSessionState,
  logRefreshResult,
  logSessionResult,
  useAuthDiagnostics,
} from './authDiagnostics';

// MFA helpers

import { enqueueAudit, flushAuditQueue } from '../dal/auditLog';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { resolveLoginPath, isLoginPath, isAdminSurface } from '../utils/surface';
import { createMembershipSelfHealTracker } from '../lib/membershipSelfHeal';
import { courseStore } from '../store/courseStore';
// registerCourseStoreOrgResolver and writeBridgeSnapshot are used by other modules
// and intentionally not referenced here in all builds
import type { OrgContextSnapshot } from '../store/courseStoreOrgBridge';
import { logAuthRedirect } from '../utils/logAuthRedirect';

if (axios?.defaults) {
  axios.defaults.withCredentials = true;
}

const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const SESSION_RELOAD_THROTTLE_MS = 45 * 1000;
// 8 s gives sufficient headroom for the full auth pipeline on Railway cold starts and
// slow networks (Supabase session + server session + membership + org resolution).
// 2500 ms was too aggressive and caused silent force-logouts on first load.
const BOOTSTRAP_FAIL_OPEN_MS = 8000;
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
  const [isAuthenticated, setIsAuthenticated] = useState<AuthState>({
    lms: false,
    admin: false,
    client: false,
  });
  const [user, setUser] = useState<UserSession | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>('idle');
  const lastMembershipStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>(membershipStatus);
  const membershipStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>(membershipStatus);
  const membershipsSnapshotRef = useRef<UserMembership[]>([]);
  const [lastMembershipFetchMeta, setLastMembershipFetchMeta] = useState<MembershipFetchMeta>({
    requestId: 0,
    startedAt: null,
    finishedAt: null,
    statusCode: null,
    membershipCount: null,
    reason: null,
  });
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const organizationIdsSnapshotRef = useRef<string[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [requestedOrgHint, setRequestedOrgHintState] = useState<string | null>(null);
  const [lastActiveOrgId, setLastActiveOrgIdState] = useState<string | null>(() => getActiveOrgPreference());
  useEffect(() => {
    const active = memberships.some(
      (membership) => (membership.status ?? 'active').toLowerCase() === 'active' && Boolean(membership.orgId),
    );
    setHasActiveMembership(active);
  }, [memberships]);
  useEffect(() => {
    membershipsSnapshotRef.current = memberships;
  }, [memberships]);
  useEffect(() => {
    organizationIdsSnapshotRef.current = organizationIds;
  }, [organizationIds]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('huddle:active_org_update', {
        detail: { activeOrgId },
      }),
    );
  }, [activeOrgId]);
  useEffect(() => {
    setGlobalActiveOrgIdForApi(activeOrgId ?? null);
  }, [activeOrgId]);

  // Track last known admin/role/org state for assertions
  const lastRoleRef = useRef<string | null>(null);
  const lastAdminAllowedRef = useRef<boolean>(false);

  // Assert and log role transitions
  useEffect(() => {
    const currentRole = user?.role ?? null;
    if (lastRoleRef.current !== currentRole) {
      if (import.meta.env?.DEV) {
        console.debug('[AUTH][ROLE_TRANSITION]', {
          from: lastRoleRef.current,
          to: currentRole,
          userId: user?.id,
          orgId: activeOrgId,
          ts: Date.now(),
        });
      }
      lastRoleRef.current = currentRole;
    }
  }, [user, activeOrgId]);

  // Ensure admin store initialization waits for final resolved auth/org state
  useEffect(() => {
    // Only initialize admin store if session/org/role is fully resolved and admin is allowed
    const isAdmin = (user?.role === 'admin' || user?.role === 'platform_admin') && membershipStatus === 'ready';
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
  }, [user, activeOrgId, membershipStatus]);

  const setRequestedOrgHint = useCallback((orgId: string | null) => {
    if (!orgId) {
      setRequestedOrgHintState(null);
      return;
    }
    setRequestedOrgHintState(orgId.trim() || null);
  }, []);

  const [authInitializing, setAuthInitializing] = useState(true);
  const authStatusRef = useRef<'booting' | 'authenticated' | 'unauthenticated' | 'error'>('booting');
  const [authStatus, setAuthStatusState] = useState<'booting' | 'authenticated' | 'unauthenticated' | 'error'>('booting');
  const setAuthStatus = useCallback(
    (next: 'booting' | 'authenticated' | 'unauthenticated' | 'error', source?: string) => {
      const prev = authStatusRef.current;
      authStatusRef.current = next;
      setAuthStatusState(next);
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
  const hasLoggedAppLoadRef = useRef(false);
  const hasAuthenticatedSessionRef = useRef(false);
  const hadAuthenticatedSessionRef = useRef(false);
  const orgContextLoggedRef = useRef<string | null>(null);
  const lastSessionFetchResultRef = useRef<'idle' | 'authenticated' | 'unauthenticated' | 'error'>('idle');
  const bootstrapRunCountRef = useRef(0);
  const refreshRunCountRef = useRef(0);
  const membershipSelfHealTrackerRef = useRef(createMembershipSelfHealTracker());
  const lastActiveOrgSourceRef = useRef<ActiveOrgSource>('none');
  const lastAppliedActiveOrgIdRef = useRef<string | null>(null);
  const membershipFetchRequestIdRef = useRef(0);
  const membershipCacheRef = useRef<UserMembership[]>([]);
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
  const authDebugSignatureRef = useRef<string | null>(null);
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
        setLastActiveOrgIdState(null);
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
        lastActiveOrgId,
        activeOrgPreference: getActiveOrgPreference(),
        membershipCache: membershipCacheRef.current,
        membershipsSnapshot: membershipsSnapshotRef.current,
        organizationIdsSnapshot: organizationIdsSnapshotRef.current,
      });
      const membershipStateFromPayload = resolvedState.membershipState;
      const resolvedMemberships = resolvedState.resolvedMemberships;
      setMembershipStatus(membershipStateFromPayload);
      if (resolvedMemberships.length > 0) {
        membershipCacheRef.current = resolvedMemberships;
      }
      const orgIds = resolvedState.organizationIds;
      organizationIdsSnapshotRef.current = orgIds;
      setLastActiveOrgIdState(resolvedState.activeOrgId);
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
      }
    },
    [clearMembershipRetryBackoff, getSkewedNow, lastActiveOrgId, requestedOrgHint, setUser, setMemberships, setMembershipStatus, setOrganizationIds, setActiveOrgIdState, setIsAuthenticated],
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
        lastActiveOrgId ??
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
    [lastActiveOrgId, requestJsonWithClock, requestedOrgHint, user],
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
      setBootstrapError(null);
      lastSessionFetchResultRef.current = 'unauthenticated';
      logSessionResult('unauthenticated');
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
  const scheduleBootstrapFailOpen = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    clearBootstrapFailOpenTimer();
    bootstrapFailOpenTimerRef.current = window.setTimeout(() => {
      console.warn('[SecureAuth] bootstrap timeout fail-open');
      void forceLogout('bootstrap_timeout_fail_open');
    }, BOOTSTRAP_FAIL_OPEN_MS);
  }, [clearBootstrapFailOpenTimer, forceLogout]);
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
      if (!hasStoredToken && import.meta.env.DEV) {
        logAuthDebug('[auth] session_fetch_without_cached_tokens', { surface });
      }
      if (import.meta.env.DEV) {
        logAuthDebug('[auth] session_fetch_request', {
          surface,
          hasStoredToken,
          hasAccessToken: Boolean(storedAccessToken),
          hasRefreshToken: Boolean(storedRefreshToken),
        });
      }
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
            .catch((error) => console.warn('[SecureAuth] courseStore.init retry failed', error));
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
          if (import.meta.env.DEV) {
            logAuthDebug('[auth] session_fetch_unauthorized_error', {
              surface,
              status: error.status,
              hasStoredToken,
            });
          }
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
    async (options: RefreshOptions = {}): Promise<boolean> =>
      runRefreshTokenCallback(options, {
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
      }),
    [applySessionPayload, fetchServerSession, getSkewedNow],
  );

  useEffect(() => {
    fetchServerSessionRef.current = fetchServerSession;
  }, [fetchServerSession]);

  useEffect(() => {
    refreshTokenCallbackRef.current = refreshTokenCallback;
  }, [refreshTokenCallback]);

  const runBootstrap = useCallback(
    async (signal?: AbortSignal, runId?: number) => {
      // the outcome of the newer run.
      const isStale = () =>
        typeof runId === 'number' && bootstrapRunIdRef.current !== runId;
      // Test/dev bypass: when running E2E or with an explicit in-browser
      // override (window.__E2E_SUPABASE_CLIENT) we short-circuit the full
      // SecureAuth bootstrap and inject a safe mock session so tests can
      // exercise the real UI without depending on external auth flows.
      //
      // SECURITY: The localStorage-based bypass key (`huddle_lms_auth`) is
      // intentionally restricted to non-production builds.  In production a
      // stale key from a previous dev/test session would otherwise grant any
      // browser full admin access without a real credential exchange.
      try {
        if (isE2EBootstrapBypassEnabled()) {
          const { payload: mockPayload, authState } = buildE2EBootstrapPayload();
          // Persist tokens during E2E so client-side authorizedFetch and
          // other synchronous token readers see the tokens immediately.
          // This is safe because it's gated behind E2E_TEST_MODE/DEV_FALLBACK
          // and will not run in production.
          applySessionPayload(mockPayload, { persistTokens: true, reason: 'e2e_bypass' });
          // computeAuthState returns { admin: true, lms: false, client: false } for platform admins
          // when no surface is provided, which breaks the LMS/client portal check in
          // RequireAuth. Override explicitly so E2E works across all portals.
          setIsAuthenticated(authState);
          setAuthStatus('authenticated');
          setSessionStatus('authenticated');
          setAuthInitializing(false);
          try { ensureLightMode(); } catch (_) { /* noop */ }
          return;
        }
      } catch (e) {
        // if anything goes wrong in the bypass, try a minimal fallback before
        // falling back to normal bootstrap — this handles the case where
        // applySessionPayload throws (e.g., Supabase placeholder errors)
        const _bypassRetry = isE2EBootstrapBypassEnabled();
        if (_bypassRetry) {
          console.warn('[SecureAuth] E2E bypass threw, retrying with minimal mock', e);
          try {
            setIsAuthenticated({ admin: true, lms: true, client: true });
            setAuthStatus('authenticated');
            setSessionStatus('authenticated');
            setAuthInitializing(false);
            return;
          } catch (e2) {
            console.warn('[SecureAuth] E2E minimal bypass also failed', e2);
          }
        } else {
          console.warn('[SecureAuth] E2E bypass failed, falling back to normal bootstrap', e);
        }
      }

      // Detect E2E bypass outside the try block too, so a throw can't override it
      // Restrict the localStorage key to non-production environments.
      const _e2eFallbackBypass = isE2EBootstrapBypassEnabled();

      if (!_e2eFallbackBypass && isLoginPath()) {
        continueAsGuest('bootstrap_login_route');
        return;
      }
      scheduleBootstrapFailOpen();
      const bootstrapRunCount = ++bootstrapRunCountRef.current;
      logAuthDebug('[auth] bootstrap start', { count: bootstrapRunCount });
      setAuthStatus('booting');
      setSessionStatus('loading');
      setBootstrapError(null);
      setAuthInitializing(true);
      setAuthBootstrapping(true);
      console.debug('[AUTH BOOTSTRAP START]', {
        pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
        ts: Date.now(),
      });

      let storedAccessToken: string | null = null;
      try {
        const { accessToken } = await readSupabaseSessionTokens({ refreshIfMissing: true });
        storedAccessToken = accessToken;
      } catch (sessionError) {
        console.warn('[SecureAuth] Failed to inspect backend session during bootstrap', sessionError);
      }
      // Stale-run guard: if a newer bootstrap run has been started since this
      // one awaited readSupabaseSessionTokens, discard all remaining state updates.
      if (isStale()) {
        return;
      }
      const hasStoredToken = Boolean(storedAccessToken);
      if (!hasStoredToken && import.meta.env.DEV) {
        logAuthDebug('[auth] bootstrap_without_cached_tokens', {
          pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
        });
      }
      try {
        const payloadRaw = await requestJsonWithClock<unknown>('/auth/session', {
          method: 'GET',
          signal,
          requireAuth: true,
        });
        // Stale-run guard: check again after the heavyweight session fetch.
        if (isStale()) {
          return;
        }
        const payload = normalizeSessionResponsePayload(payloadRaw);

        if (payload?.user) {
          applySessionPayload(payload, { persistTokens: false, reason: 'bootstrap_success' });
          setAuthStatus('authenticated', 'runBootstrap:success');
          setBootstrapError(null);
          try { ensureLightMode(); } catch (_) { /* noop */ }
          console.info('[SESSION BOOTSTRAPPED]', {
            surface: 'bootstrap',
            userId: payload.user.id ?? null,
            membershipCount: payload.memberships?.length ?? 0,
            membershipStatus: payload.membershipStatus ?? null,
          });
          logSessionResult('authenticated');
        } else {
          continueAsGuest('bootstrap_empty');
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          logSessionResult('aborted');
          return;
        }
        if (isStale()) {

          return;
        }
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
              const recovered = await refreshFn({ reason: 'user_retry' });
              console.debug('[SecureAuth] refreshTokenCallback result', { recovered });
              if (isStale()) {
                return;
              }
              if (recovered) {
                setAuthStatus('authenticated', 'runBootstrap:refresh_recovery');
                setBootstrapError(null);
                logSessionResult('authenticated');
                return;
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
            // ensure we do not clear this error by forcing unauthenticated flow
            setShouldRedirectToLogin(false);
            logSessionResult('error');
          } else {
            continueAsGuest('bootstrap_http_error', { redirect: false });
          }
        } else {
          lastSessionFetchResultRef.current = 'error';
          setBootstrapError('Network issue while restoring your session. Please retry.');
          setAuthStatus('error');
          logSessionResult('error');
        }
      } finally {
        if (!isStale()) {
          clearBootstrapFailOpenTimer();
          setSessionStatus(
            hasAuthenticatedSessionRef.current ? 'authenticated' : 'unauthenticated',
            'runBootstrap:finally',
          );
          setAuthInitializing(false);
          setAuthBootstrapping(false);
          console.debug('[AUTH BOOTSTRAP COMPLETE]', {
            authenticated: hasAuthenticatedSessionRef.current,
            pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
            ts: Date.now(),
          });
        }
      }
    },
    [applySessionPayload, captureServerClock, clearBootstrapFailOpenTimer, continueAsGuest, forceLogout, scheduleBootstrapFailOpen],
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
      // Skip the login-path short-circuit when running in E2E / dev-bypass mode
      // so runBootstrap can inject the mock session even when the URL is /login.
      // Restrict the localStorage key to non-production environments.
      const _isE2EBypass = isE2EBootstrapBypassEnabled();
      if (!_isE2EBypass && isLoginPath()) {
        bootstrappedRef.current = true;
        clearBootstrapFailOpenTimer();
        continueAsGuest('bootstrap_login_route');
        return;
      }
      bootstrappedRef.current = true;
      bootstrapControllerRef.current?.abort();
      clearBootstrapFailOpenTimer();
      const controller = new AbortController();
      bootstrapControllerRef.current = controller;
      // Stamp a new run ID so in-flight older runs can detect they are stale.
      const runId = ++bootstrapRunIdRef.current;
      const runner = runBootstrapRef.current;
      if (runner) {
        runner(controller.signal, runId).catch((error) => {
          console.warn('[SecureAuth] Bootstrap run failed', error);
        });
      }
    },
    [clearBootstrapFailOpenTimer, continueAsGuest],
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
      setLastActiveOrgIdState(normalized);
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
            console.warn('[SecureAuth] orgResolutionStatus fail-open: timed out waiting for activeOrgId; forcing ready');
          }
          return 'ready';
        }
        return current;
      });
    }, 10_000);

    return () => {
      window.clearTimeout(failOpenTimer);
    };
  }, [authInitializing, user, memberships, activeOrgId]);

  const deriveOrgContextSnapshotCallback = useCallback((): OrgContextSnapshot => {
    return deriveOrgContextSnapshot({
      membershipStatus,
      sessionStatus,
      activeOrgId,
      lastActiveOrgId,
      user,
    });
  }, [activeOrgId, lastActiveOrgId, membershipStatus, sessionStatus, user]);

  useAuthDiagnostics({
    authInitializing,
    authStatus,
    sessionStatus,
    membershipStatus,
    orgResolutionStatus,
    surfaceAuthStatus,
    user,
    memberships,
    activeOrgId,
    hasActiveMembership,
    requestedOrgHint,
    lastActiveOrgId,
    lastMembershipFetchMeta,
    authDebugSignatureRef,
    hasLoggedAppLoadRef,
    lastMembershipStatusRef,
    orgContextLoggedRef,
    deriveOrgContextSnapshotCallback,
  });

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
    hasActiveMembership,
    surfaceAuthStatus,
    orgResolutionStatus,
    user,
    memberships,
    organizationIds,
    activeOrgId,
    lastActiveOrgId,
    requestedOrgId: requestedOrgHint,
    login,
    register,
    logout,
    refreshToken: refreshTokenCallback,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
    setActiveOrganization,
    setRequestedOrgHint,
    reloadSession,
    loadSession,
    retryBootstrap,
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
