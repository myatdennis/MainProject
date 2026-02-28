import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  setSessionMetadata,
  setUserSession,
  getUserSession,
  clearAuth,
  migrateFromLocalStorage,
  getActiveOrgPreference,
  setActiveOrgPreference,
  clearActiveOrgPreference,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  type UserSession,
  type UserMembership,
  type SessionMetadata,
} from '../lib/secureStorage';
import { loginSchema, emailSchema, registerSchema } from '../utils/validators';
import { queueRefresh } from '../lib/refreshQueue';
import apiRequest, { ApiError, apiRequestRaw } from '../utils/apiClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import { AuthExpiredError, NotAuthenticatedError } from '../lib/apiClient';

// MFA helpers

import { logAuditBestEffort } from '../dal/auditLog';
import axios from 'axios';
import { toast } from 'react-hot-toast';

if (axios?.defaults) {
  axios.defaults.withCredentials = true;
}

const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const SESSION_RELOAD_THROTTLE_MS = 45 * 1000;
const BOOTSTRAP_FAIL_OPEN_MS = 2500;

const isNavigatorOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const resolveLoginPath = () => {
  if (typeof window === 'undefined' || !window.location) {
    return '/lms/login';
  }
  const pathname = window.location.pathname || '';
  return pathname.startsWith('/admin') ? '/admin/login' : '/lms/login';
};
const isLoginRoute = () => {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const pathname = window.location.pathname || '';
  return pathname.startsWith('/admin/login');
};
const isDevEnvironment = Boolean(import.meta.env?.DEV);
const logAuthDebug = (label: string, payload: Record<string, unknown>) => {
  if (!isDevEnvironment) return;
  try {
    console.debug(label, payload);
  } catch {
    // ignore
  }
};
const logSessionResult = (status: string) => logAuthDebug('[auth] session result', { status });
const logRefreshResult = (status: string) => logAuthDebug('[auth] refresh result', { status });

const readSupabaseSessionTokens = async (
  options: { refreshIfMissing?: boolean } = {},
): Promise<{ accessToken: string | null; refreshToken: string | null }> => {
  // First try secureStorage to avoid unnecessary network calls
  const fallbackAccess = getAccessToken();
  const fallbackRefresh = getRefreshToken();

  const supabaseClient = getSupabase();
  if (!supabaseClient) {
    return { accessToken: fallbackAccess, refreshToken: fallbackRefresh };
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.warn('[SecureAuth] Supabase getSession failed', error);
      return { accessToken: fallbackAccess, refreshToken: fallbackRefresh };
    }
    let session = data?.session ?? null;

    const shouldAttemptRefresh =
      options.refreshIfMissing !== false &&
      session !== null &&
      !session.access_token &&
      Boolean(session.refresh_token);

    if (shouldAttemptRefresh) {
      try {
        const { data: refreshed, error: refreshError } = await supabaseClient.auth.refreshSession();
        if (refreshError) {
          if (refreshError.name !== 'AuthSessionMissingError') {
            console.warn('[SecureAuth] Supabase refreshSession failed while ensuring session tokens', refreshError);
          }
        } else {
          session = refreshed?.session ?? session;
        }
      } catch (refreshException) {
        const message = refreshException instanceof Error ? refreshException.name : '';
        if (message !== 'AuthSessionMissingError') {
          console.warn('[SecureAuth] Supabase refreshSession threw while ensuring session tokens', refreshException);
        }
      }
    }

    const accessToken = session?.access_token ?? fallbackAccess ?? null;
    const refreshToken = session?.refresh_token ?? fallbackRefresh ?? null;
    return { accessToken, refreshToken };
  } catch (sessionError) {
    console.warn('[SecureAuth] Supabase session lookup failed', sessionError);
    return { accessToken: fallbackAccess, refreshToken: fallbackRefresh };
  }
};


type SessionSurface = 'admin' | 'lms';
type RefreshReason = 'protected_401' | 'user_retry';
type SurfaceAuthStatus = 'idle' | 'checking' | 'ready' | 'error';
type OrgResolutionStatus = 'idle' | 'resolving' | 'ready' | 'error';

interface RefreshOptions {
  reason?: RefreshReason;
}

interface SessionResponsePayload {
  user?: Record<string, any> | null;
  memberships?: Array<Record<string, any>>;
  organizationIds?: string[];
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  refreshExpiresAt?: number | null;
  activeOrgId?: string | null;
  role?: string | null;
  platformRole?: string | null;
  isPlatformAdmin?: boolean;
  mfaRequired?: boolean;
  authenticatedOnly?: boolean;
}

type SupabaseSessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | null;
  refresh_expires_at?: number | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | null;
  refreshExpiresAt?: number | null;
  user?: Record<string, any> | null;
  role?: string | null;
  platform_role?: string | null;
  platformRole?: string | null;
  isPlatformAdmin?: boolean;
};

const coerceString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isSupabaseSessionLike = (value: unknown): value is SupabaseSessionLike => {
  if (!value || typeof value !== 'object') return false;
  return 'access_token' in value || 'accessToken' in value || 'refresh_token' in value || 'refreshToken' in value;
};

const normalizeSessionResponsePayload = (payload: unknown): SessionResponsePayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const source = payload as Record<string, any>;
  const sessionContainer = source.session && typeof source.session === 'object' ? source.session : null;
  const supabaseSession: SupabaseSessionLike | null = isSupabaseSessionLike(sessionContainer)
    ? (sessionContainer as SupabaseSessionLike)
    : isSupabaseSessionLike(source.session?.session)
    ? (source.session.session as SupabaseSessionLike)
    : isSupabaseSessionLike(source)
    ? (source as SupabaseSessionLike)
    : null;

  const rawUser = (sessionContainer && sessionContainer.user) || source.user || supabaseSession?.user || null;
  if (!rawUser) {
    return null;
  }

  const derivedRole =
    source.role ?? sessionContainer?.role ?? rawUser.role ?? rawUser.platformRole ?? rawUser.platform_role ?? null;
  const derivedPlatformRole =
    source.platformRole ??
    sessionContainer?.platformRole ??
    sessionContainer?.platform_role ??
    rawUser.platformRole ??
    rawUser.platform_role ??
    null;

  const normalizedUser = { ...rawUser };
  if (derivedRole && !normalizedUser.role) {
    normalizedUser.role = derivedRole;
  }
  if (derivedPlatformRole && !normalizedUser.platformRole) {
    normalizedUser.platformRole = derivedPlatformRole;
  }

  const accessToken =
    source.accessToken ??
    sessionContainer?.accessToken ??
    sessionContainer?.access_token ??
    supabaseSession?.access_token ??
    supabaseSession?.accessToken ??
    null;
  const refreshToken =
    source.refreshToken ??
    sessionContainer?.refreshToken ??
    sessionContainer?.refresh_token ??
    supabaseSession?.refresh_token ??
    supabaseSession?.refreshToken ??
    null;

  const expiresAt =
    source.expiresAt ??
    sessionContainer?.expiresAt ??
    sessionContainer?.expires_at ??
    coerceNumber(supabaseSession?.expires_at ?? supabaseSession?.expiresAt);
  const refreshExpiresAt =
    source.refreshExpiresAt ??
    sessionContainer?.refreshExpiresAt ??
    sessionContainer?.refresh_expires_at ??
    coerceNumber(supabaseSession?.refresh_expires_at ?? supabaseSession?.refreshExpiresAt);

  const derivedIsPlatformAdminSource =
    source.isPlatformAdmin ?? sessionContainer?.isPlatformAdmin ?? supabaseSession?.isPlatformAdmin ?? normalizedUser.isPlatformAdmin;
  const derivedIsPlatformAdmin =
    typeof derivedIsPlatformAdminSource === 'boolean'
      ? derivedIsPlatformAdminSource
      : Boolean(
          (coerceString(derivedRole)?.toLowerCase() === 'admin') ||
            coerceString(derivedPlatformRole) === 'platform_admin',
        );

  if (derivedIsPlatformAdmin) {
    normalizedUser.isPlatformAdmin = true;
  }

  const normalized: SessionResponsePayload = {
    user: normalizedUser,
    memberships: source.memberships ?? sessionContainer?.memberships ?? undefined,
    organizationIds: source.organizationIds ?? sessionContainer?.organizationIds ?? undefined,
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    expiresAt: expiresAt ?? null,
    refreshExpiresAt: refreshExpiresAt ?? null,
    activeOrgId: source.activeOrgId ?? sessionContainer?.activeOrgId ?? normalizedUser.organizationId ?? null,
    role: derivedRole ?? normalizedUser.role ?? null,
    platformRole: derivedPlatformRole ?? normalizedUser.platformRole ?? null,
    isPlatformAdmin: derivedIsPlatformAdmin,
    mfaRequired: source.mfaRequired ?? sessionContainer?.mfaRequired ?? false,
  };

  return normalized;
};

const dedupeStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (!value) return;
    const trimmed = String(value).trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
};

const normalizeMemberships = (rows: Array<Record<string, any>> | undefined): UserMembership[] => {
  if (!Array.isArray(rows)) return [];
  return rows.reduce<UserMembership[]>((acc, row) => {
    const orgId = row?.orgId || row?.organizationId || row?.organization_id || row?.org_id;
    if (!orgId) {
      return acc;
    }
    acc.push({
      orgId,
      organizationId: orgId,
      role: row.role ?? row.organization_role ?? null,
      status: row.status ?? 'active',
      organizationName: row.organizationName ?? row.organization_name ?? row.org_name ?? null,
      organizationSlug: row.organizationSlug ?? row.organization_slug ?? row.org_slug ?? null,
      organizationStatus: row.organizationStatus ?? row.organization_status ?? null,
      subscription: row.subscription ?? null,
      features: row.features ?? null,
      acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
      lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
    });
    return acc;
  }, []);
};


const pickValidOrgId = (candidate: string | null | undefined, memberships: UserMembership[], fallback?: string | null): string | null => {
  const isValid = (orgId: string | null | undefined) =>
    Boolean(orgId) && memberships.some((membership) => membership.orgId === orgId && membership.status !== 'revoked');

  if (isValid(candidate)) {
    return candidate as string;
  }
  if (isValid(fallback)) {
    return fallback as string;
  }
  const activeMembership = memberships.find((membership) => membership.status === 'active');
  if (activeMembership) {
    return activeMembership.orgId;
  }
  return memberships[0]?.orgId ?? null;
};

const computeAuthState = (user: UserSession | null, surface?: SessionSurface): AuthState => {
  if (!user) {
    return { lms: false, admin: false };
  }

  const role = String(user.role || '').toLowerCase();
  const isRoleAdmin = role === 'admin' || Boolean(user.isPlatformAdmin);

  if (surface === 'admin') {
    return { admin: isRoleAdmin, lms: false };
  }
  if (surface === 'lms') {
    return { admin: false, lms: true };
  }
  return { admin: isRoleAdmin, lms: !isRoleAdmin };
};

const logAuthSessionState = (contextLabel: string, session: UserSession | null) => {
  if (!(import.meta.env && import.meta.env.DEV)) {
    return;
  }

  const summary = {
    event: contextLabel,
    timestamp: new Date().toISOString(),
    sessionExists: Boolean(session),
    accessTokenPresent: Boolean(getAccessToken()),
    refreshTokenPresent: Boolean(getRefreshToken()),
    userId: session?.id ?? null,
    role: session?.role ?? null,
    isPlatformAdmin: Boolean(session?.isPlatformAdmin || session?.role === 'admin'),
    organizationId: session?.organizationId ?? null,
    activeOrgId: session?.activeOrgId ?? null,
  };

  console.info('[SecureAuth][DEV:auth-session]', summary);
};

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  lms: boolean;
  admin: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorType?: 'invalid_credentials' | 'network_error' | 'validation_error' | 'unknown_error' | 'supabase_auth_error';
  mfaRequired?: boolean;
  mfaEmail?: string;
}

type RegisterField = 'email' | 'password' | 'confirmPassword' | 'firstName' | 'lastName' | 'organizationId';

interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

interface RegisterResult extends LoginResult {
  fieldErrors?: Partial<Record<RegisterField, string>>;
}

interface AuthContextType {
  isAuthenticated: AuthState;
  authInitializing: boolean;
  authStatus: 'booting' | 'authenticated' | 'unauthenticated' | 'error';
  sessionStatus: 'idle' | 'loading' | 'ready';
  surfaceAuthStatus: Record<SessionSurface, SurfaceAuthStatus>;
  orgResolutionStatus: OrgResolutionStatus;
  user: UserSession | null;
  memberships: UserMembership[];
  organizationIds: string[];
  activeOrgId: string | null;
  login: (email: string, password: string, type: 'lms' | 'admin', mfaCode?: string) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  sendMfaChallenge: (email: string) => Promise<boolean>;
  verifyMfa: (email: string, code: string) => Promise<boolean>;
  logout: (type?: 'lms' | 'admin') => Promise<void>;
  refreshToken: (options?: RefreshOptions) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  setActiveOrganization: (orgId: string | null) => Promise<void>;
  reloadSession: (options?: { surface?: SessionSurface; force?: boolean }) => Promise<boolean>;
  loadSession: (options?: { surface?: SessionSurface }) => Promise<boolean>;
  retryBootstrap: () => void;
}

// ============================================================================
// Context
// ============================================================================

const defaultAuthContext: AuthContextType = {
  isAuthenticated: { lms: false, admin: false },
  authInitializing: true,
  authStatus: 'booting',
  sessionStatus: 'idle',
  surfaceAuthStatus: { admin: 'idle', lms: 'idle' },
  orgResolutionStatus: 'idle',
  user: null,
  memberships: [],
  organizationIds: [],
  activeOrgId: null,
  async login() {
    return {
      success: false,
      error: 'Authentication provider not initialized. Please refresh the page.',
      errorType: 'unknown_error',
    };
  },
  async sendMfaChallenge() {
    return false;
  },
  async register() {
    return {
      success: false,
      error: 'Registration is unavailable. Please refresh and try again.',
      errorType: 'unknown_error',
    };
  },
  async verifyMfa() {
    return false;
  },
  async logout() {
    console.warn('[SecureAuth] logout called before provider mounted.');
  },
  async refreshToken() {
    return false;
  },
  async forgotPassword() {
    return false;
  },
  async setActiveOrganization() {
    return;
  },
  async reloadSession() {
    return false;
  },
  async loadSession() {
    return false;
  },
  retryBootstrap() {},
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
  });
  const [user, setUser] = useState<UserSession | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authStatus, setAuthStatus] = useState<'booting' | 'authenticated' | 'unauthenticated' | 'error'>('booting');
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [surfaceAuthStatus, setSurfaceAuthStatus] = useState<Record<SessionSurface, SurfaceAuthStatus>>({
    admin: 'idle',
    lms: 'idle',
  });
  const [orgResolutionStatus, setOrgResolutionStatus] = useState<OrgResolutionStatus>('idle');
  const [sessionMetaVersion, setSessionMetaVersion] = useState(0);
  const bootstrappedRef = useRef(false);
  const hasAttemptedRefreshRef = useRef(false);
  const refreshAttemptedRef = useRef(false);
  const serverTimeOffsetRef = useRef(0);
  const lastRefreshAttemptRef = useRef(0);
  const lastRefreshSuccessRef = useRef(0);
  const bootstrapControllerRef = useRef<AbortController | null>(null);
  const bootstrapFailOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSessionReloadRef = useRef(0);
  const hasLoggedAppLoadRef = useRef(false);
  const hasAuthenticatedSessionRef = useRef(false);
  const hadAuthenticatedSessionRef = useRef(false);
  const lastSessionFetchResultRef = useRef<'idle' | 'authenticated' | 'unauthenticated' | 'error'>('idle');
  const bootstrapRunCountRef = useRef(0);
  const refreshRunCountRef = useRef(0);
  type FetchServerSessionFn = (options?: {
    surface?: SessionSurface;
    signal?: AbortSignal;
    silent?: boolean;
    allowRefresh?: boolean;
  }) => Promise<boolean>;
  const fetchServerSessionRef = useRef<FetchServerSessionFn | null>(null);
  const refreshTokenCallbackRef = useRef<((options?: RefreshOptions) => Promise<boolean>) | null>(null);

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
        setOrganizationIds([]);
        setActiveOrgIdState(null);
        setIsAuthenticated({ lms: false, admin: false });
        if (persistTokens) {
          clearAuth(tokenReason);
          setSessionMetaVersion((value) => value + 1);
        }
        return;
      }

      hasAuthenticatedSessionRef.current = true;
      hadAuthenticatedSessionRef.current = true;
      lastSessionFetchResultRef.current = 'authenticated';
      const normalizedMemberships = normalizeMemberships(payload.memberships);
      const orgIds =
        payload.organizationIds && payload.organizationIds.length > 0
          ? dedupeStrings(payload.organizationIds)
          : dedupeStrings(normalizedMemberships.map((membership) => membership.orgId));

      const session: UserSession = {
        id: payload.user.id,
        email: payload.user.email ?? payload.user.user_email ?? '',
        role:
          payload.user.role ||
          payload.user.platformRole ||
          payload.user.platform_role ||
          payload.user.userRole ||
          'learner',
        firstName: payload.user.firstName ?? payload.user.first_name ?? payload.user.user_metadata?.first_name,
        lastName: payload.user.lastName ?? payload.user.last_name ?? payload.user.user_metadata?.last_name,
        organizationId: payload.user.organizationId ?? payload.user.organization_id ?? orgIds[0] ?? null,
        organizationIds: orgIds,
        memberships: normalizedMemberships,
        activeOrgId: payload.activeOrgId ?? payload.user.activeOrgId ?? payload.user.organizationId ?? null,
        platformRole: payload.user.platformRole ?? payload.user.platform_role ?? null,
        isPlatformAdmin: Boolean(payload.user.isPlatformAdmin ?? payload.user.platformRole === 'platform_admin'),
        appMetadata: payload.user.appMetadata ?? payload.user.app_metadata ?? null,
        userMetadata: payload.user.userMetadata ?? payload.user.user_metadata ?? null,
      };

  const storedPreference = getActiveOrgPreference();
  const preferredOrg = pickValidOrgId(session.activeOrgId, normalizedMemberships, storedPreference);
  setActiveOrgPreference(preferredOrg);
      session.activeOrgId = preferredOrg;

      setUser(session);
      setMemberships(normalizedMemberships);
      setOrganizationIds(orgIds);
      setActiveOrgIdState(preferredOrg);
      setIsAuthenticated(computeAuthState(session, surface));
      setUserSession(session);

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
    [
      getSkewedNow,
      setUser,
      setMemberships,
      setOrganizationIds,
      setActiveOrgIdState,
      setIsAuthenticated,
    ],
  );

  const handleSessionUnauthorized = useCallback(
    ({
      silent = false,
      reason = 'session_unauthenticated',
      message,
    }: { silent?: boolean; reason?: string; message?: string } = {}) => {
      const hadSession = hasAuthenticatedSessionRef.current;
      applySessionPayload(null, { persistTokens: true, reason });
      setAuthStatus('unauthenticated');
      lastSessionFetchResultRef.current = 'unauthenticated';
      if (!silent) {
        setBootstrapError(null);
      }
      if (hadSession && !silent) {
        toast.error(message ?? 'Your session expired. Please sign in again.', { id: 'session-expired' });
      }
    },
    [applySessionPayload],
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

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const clearBootstrapFailOpenTimer = useCallback(() => {
    if (bootstrapFailOpenTimerRef.current) {
      clearTimeout(bootstrapFailOpenTimerRef.current);
      bootstrapFailOpenTimerRef.current = null;
    }
  }, []);
  const continueAsGuest = useCallback(
    (reason: string) => {
      if (import.meta.env.DEV) {
        console.info('[Auth] auth_restore: logged_out, continuing as guest.', { reason });
      }
      clearBootstrapFailOpenTimer();
      applySessionPayload(null, { persistTokens: true, reason });
      setAuthStatus('unauthenticated');
      setSessionStatus('ready');
      setAuthInitializing(false);
      setBootstrapError(null);
      lastSessionFetchResultRef.current = 'unauthenticated';
      logSessionResult('unauthenticated');
    },
    [applySessionPayload, clearBootstrapFailOpenTimer, setAuthInitializing, setAuthStatus, setBootstrapError],
  );
  const forceLogout = useCallback(
    async (reason: string) => {
      try {
        const supabaseClient = getSupabase();
        await supabaseClient?.auth.signOut();
      } catch (signOutError) {
        console.warn('[SecureAuth] forceLogout signOut failed', signOutError);
      }
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
    }: {
      surface?: SessionSurface;
      signal?: AbortSignal;
      silent?: boolean;
      allowRefresh?: boolean;
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
      if (!hasStoredToken) {
        logAuthDebug('[auth] session_fetch_skipped_no_supabase_token', { surface });
        await forceLogout(surface ? `${surface}_session_no_supabase_token` : 'session_no_supabase_token');
        return false;
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
        const payloadRaw = await requestJsonWithClock<unknown>('/api/auth/session', {
          method: 'GET',
          signal,
          requireAuth: true,
        });
        const payload = normalizeSessionResponsePayload(payloadRaw);
        if (payload?.user) {
          applySessionPayload(payload, {
            surface,
            persistTokens: false,
            reason: surface ? `${surface}_session_bootstrap` : 'session_bootstrap',
          });
          setAuthStatus('authenticated');
          if (!silent) {
            setBootstrapError(null);
          }
          return true;
        }

        handleSessionUnauthorized({
          silent,
          reason: 'session_bootstrap_empty',
        });
        continueAsGuest('session_bootstrap_empty');
        return false;
      } catch (error) {
        if (error instanceof NotAuthenticatedError) {
          continueAsGuest(surface ? `${surface}_session_no_supabase_token` : 'session_no_supabase_token');
          return false;
        }
        if (error instanceof AuthExpiredError) {
          handleSessionUnauthorized({
            silent: true,
            reason: surface ? `${surface}_session_expired` : 'session_expired',
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
            handleSessionUnauthorized({
              silent: true,
              reason: surface ? `${surface}_session_no_token` : 'session_no_token',
            });
            continueAsGuest(surface ? `${surface}_session_no_token` : 'session_no_token');
            return false;
          }
          if (error.status === 401 || error.status === 403) {
            if (allowRefresh && hasStoredToken) {
              const refreshFn = refreshTokenCallbackRef.current;
              if (refreshFn) {
                const recovered = await refreshFn({ reason: 'protected_401' });
                if (recovered) {
                  return fetchServerSession({ surface, signal, silent, allowRefresh: false });
                }
              }
            }
            if (import.meta.env.DEV) {
              console.debug('[SecureAuth][dev] ApiError session status', { status: error.status, surface });
            }
            handleSessionUnauthorized({
              silent,
              reason: surface ? `${surface}_session_unauthenticated` : 'session_unauthenticated',
            });
            continueAsGuest(surface ? `${surface}_session_unauthenticated` : 'session_unauthenticated_api_error');
            return false;
          }

          if (error.code === 'timeout' || isServerOrNetworkErrorStatus(error.status)) {
            lastSessionFetchResultRef.current = 'error';
            if (!silent) {
              setBootstrapError('Network issue while restoring your session. Please retry.');
            }
            if (import.meta.env.DEV) {
              console.warn('[Auth] auth_restore: error (timeout/network)', { surface, status: error.status });
            }
            return false;
          }

          handleSessionUnauthorized({
            silent,
            reason: surface ? `${surface}_session_http_${error.status ?? 'unknown'}` : 'session_http_api_error',
            message: (error.body as { message?: string } | undefined)?.message,
          });
          continueAsGuest(surface ? `${surface}_session_http_${error.status ?? 'unknown'}` : 'session_http_api_error');
          return false;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          lastSessionFetchResultRef.current = 'error';
          if (!silent) {
            setBootstrapError('Session check canceled. Please retry.');
          }
          if (import.meta.env.DEV) {
            console.warn('[Auth] auth_restore: error (abort)', { surface });
          }
          return false;
        }
        if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
          lastSessionFetchResultRef.current = 'error';
          if (!silent) {
            setBootstrapError('Session check canceled. Please retry.');
          }
          if (import.meta.env.DEV) {
            console.warn('[Auth] auth_restore: error (axios cancel)', { surface });
          }
          return false;
        }
        if (!silent) {
          setBootstrapError('Network issue while restoring your session. Please check your connection and retry.');
        }
        lastSessionFetchResultRef.current = 'error';
        console.warn('[SecureAuth] Failed to reload session', error);
        if (import.meta.env.DEV) {
          console.warn('[Auth] auth_restore: error (network)', { surface });
        }
        return false;
      }
    },
    [applySessionPayload, captureServerClock, continueAsGuest, forceLogout, handleSessionUnauthorized],
  );

  // ============================================================================
  // Token Refresh
  // ============================================================================

  const refreshTokenCallback = useCallback(
    async (options: RefreshOptions = {}): Promise<boolean> => {
      const reason: RefreshReason = options.reason ?? 'protected_401';

      const allowedByReason =
        reason === 'user_retry' ||
        (reason === 'protected_401' && hasAuthenticatedSessionRef.current) ||
        (reason === 'user_retry' && hadAuthenticatedSessionRef.current);
      if (!allowedByReason) {
        return false;
      }

      if (hasAttemptedRefreshRef.current || refreshAttemptedRef.current) {
        return false;
      }

      return queueRefresh(async () => {
        hasAttemptedRefreshRef.current = true;
        refreshAttemptedRef.current = true;
        const refreshRunCount = ++refreshRunCountRef.current;
        logAuthDebug('[auth] refresh start', { count: refreshRunCount, reason });
        let refreshStatus: 'success' | 'unauthenticated' | 'network_issue' | 'error' | 'skipped' = 'skipped';
        const now = getSkewedNow();
        if (lastRefreshAttemptRef.current && now - lastRefreshAttemptRef.current < MIN_REFRESH_INTERVAL_MS) {
          refreshStatus = 'skipped';
          logRefreshResult(refreshStatus);
          return false;
        }

        if (isNavigatorOffline()) {
          console.info('[SecureAuth] Skipping refresh while offline');
          refreshStatus = 'network_issue';
          logRefreshResult(refreshStatus);
          return false;
        }

        lastRefreshAttemptRef.current = now;

        try {
          let sessionSnapshot: UserSession | null = null;
          try {
            sessionSnapshot = getUserSession();
          } catch (sessionError) {
            console.warn('[SecureAuth] Failed to read cached user session for refresh payload', sessionError);
          }

          let refreshToken: string | null =
            (sessionSnapshot as any)?.session?.refresh_token ??
            (sessionSnapshot as any)?.session?.refreshToken ??
            (sessionSnapshot as any)?.refresh_token ??
            (sessionSnapshot as any)?.refreshToken ??
            null;

          if (!refreshToken) {
            try {
              refreshToken = getRefreshToken();
            } catch (storageError) {
              console.warn('[SecureAuth] Failed to read stored refresh token', storageError);
            }
          }

          if (!refreshToken) {
            try {
              const supabaseClient = getSupabase();
              if (supabaseClient) {
                const { data } = await supabaseClient.auth.getSession();
                refreshToken = data?.session?.refresh_token ?? refreshToken;
              }
            } catch (supabaseError) {
              console.warn('[SecureAuth] Unable to read Supabase session for refresh token', supabaseError);
            }
          }

          if (!refreshToken) {
            console.warn('[SecureAuth] No refresh token available for /api/auth/refresh request');
            refreshStatus = 'unauthenticated';
            return false;
          }

          const refreshHeaders = {
            ...buildSessionAuditHeaders(),
            'Content-Type': 'application/json',
          };
          const refreshBody = JSON.stringify({ refreshToken });

          const payload = await apiRequest<SessionResponsePayload | null>('/api/auth/refresh', {
            method: 'POST',
            allowAnonymous: true,
            headers: refreshHeaders,
            body: refreshBody,
          });

          if (payload?.user) {
            applySessionPayload(payload, { persistTokens: true, reason: 'refresh_success' });
            setAuthStatus('authenticated');
            refreshStatus = 'success';
          } else {
            await fetchServerSession({ silent: true });
            refreshStatus = 'success';
          }

          lastRefreshSuccessRef.current = getSkewedNow();
          return true;
        } catch (error) {
          if (error instanceof ApiError) {
            if (error.status === 401 || error.status === 403) {
              console.warn('[SecureAuth] Refresh token rejected, clearing session');
              applySessionPayload(null, { persistTokens: true, reason: 'refresh_rejected' });
              setAuthStatus('unauthenticated');
              if (typeof window !== 'undefined') {
                toast.error('Your session expired. Please sign in again.', { id: 'session-expired' });
                const loginPath = resolveLoginPath();
                window.location.assign(loginPath);
              }
              refreshStatus = 'unauthenticated';
              return false;
            }

            if (error.code === 'timeout' || error.status === 0) {
              console.warn('[SecureAuth] Refresh deferred due to network issue');
              refreshStatus = 'network_issue';
              return false;
            }
          }

          console.error('Token refresh failed:', error);
          refreshStatus = 'error';
          return false;
        } finally {
          logRefreshResult(refreshStatus);
        }
      });
    },
    [applySessionPayload, fetchServerSession, getSkewedNow],
  );

  useEffect(() => {
    fetchServerSessionRef.current = fetchServerSession;
  }, [fetchServerSession]);

  useEffect(() => {
    refreshTokenCallbackRef.current = refreshTokenCallback;
  }, [refreshTokenCallback]);

  const runBootstrap = useCallback(
    async (signal?: AbortSignal) => {
      if (isLoginRoute()) {
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

      let storedAccessToken: string | null = null;
      try {
        const { accessToken } = await readSupabaseSessionTokens({ refreshIfMissing: true });
        storedAccessToken = accessToken;
      } catch (sessionError) {
        console.warn('[SecureAuth] Failed to inspect Supabase session during bootstrap', sessionError);
      }
      const hasStoredToken = Boolean(storedAccessToken);
      if (!hasStoredToken) {
        await forceLogout('bootstrap_no_supabase_token');
        return;
      }
      try {
        const payloadRaw = await requestJsonWithClock<unknown>('/api/auth/session', {
          method: 'GET',
          signal,
          requireAuth: true,
        });
        const payload = normalizeSessionResponsePayload(payloadRaw);

        if (payload?.user) {
          applySessionPayload(payload, { persistTokens: false, reason: 'bootstrap_success' });
          setAuthStatus('authenticated');
          setBootstrapError(null);
          logSessionResult('authenticated');
        } else {
          continueAsGuest('bootstrap_empty');
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          logSessionResult('aborted');
          return;
        }
        if (error instanceof NotAuthenticatedError) {
          continueAsGuest('bootstrap_no_supabase_token');
          return;
        }
        if (error instanceof AuthExpiredError) {
          continueAsGuest('bootstrap_unauthenticated');
          return;
        }
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) {
            const refreshFn = refreshTokenCallbackRef.current;
            if (refreshFn) {
              const recovered = await refreshFn({ reason: 'user_retry' });
              if (recovered) {
                setAuthStatus('authenticated');
                setBootstrapError(null);
                logSessionResult('authenticated');
                return;
              }
            }

            continueAsGuest('bootstrap_unauthenticated');
            return;
          }

          const severeServerError = isServerOrNetworkErrorStatus(error.status);
          if (severeServerError) {
            lastSessionFetchResultRef.current = 'error';
            setBootstrapError('Network issue while restoring your session. Please retry.');
            setAuthStatus('error');
            logSessionResult('error');
          } else {
            continueAsGuest('bootstrap_http_error');
          }
        } else {
          lastSessionFetchResultRef.current = 'error';
          setBootstrapError('Network issue while restoring your session. Please retry.');
          setAuthStatus('error');
          logSessionResult('error');
        }
      } finally {
        clearBootstrapFailOpenTimer();
        setSessionStatus('ready');
        setAuthInitializing(false);
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
      if (isLoginRoute()) {
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
      const runner = runBootstrapRef.current;
      if (runner) {
        runner(controller.signal).catch((error) => {
          console.warn('[SecureAuth] Bootstrap run failed', error);
        });
      }
    },
    [clearBootstrapFailOpenTimer, continueAsGuest],
  );

  const retryBootstrap = useCallback(() => {
    bootstrappedRef.current = false;
    setBootstrapError(null);
    startBootstrap({ force: true });
  }, [startBootstrap]);

  const onGoToLogin = useCallback(() => {
    applySessionPayload(null, { persistTokens: true, reason: 'bootstrap_error_redirect' });
    setBootstrapError(null);
    const fallbackPath = resolveLoginPath();
    if (typeof window !== 'undefined') {
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
      const normalized = orgId && memberships.some((membership) => membership.orgId === orgId) ? orgId : null;
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
    [memberships],
  );

  const resolveSession = useCallback(
    async ({ surface, signal }: { surface?: SessionSurface; signal?: AbortSignal } = {}) => {
      try {
        const hasUser = await fetchServerSession({ surface, signal });
        if (hasUser) {
          return true;
        }

        applySessionPayload(null, { persistTokens: true, reason: 'resolve_session_empty' });
        return false;
      } catch (error) {
        if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
          return false;
        }
        console.error('[SecureAuth] resolveSession failed', error);
        applySessionPayload(null, { persistTokens: true, reason: 'resolve_session_error' });
        return false;
      }
    },
    [applySessionPayload, fetchServerSession],
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
        return result;
      } finally {
        setSessionStatus('ready');
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

  const logout = useCallback(async (type?: 'lms' | 'admin'): Promise<void> => {
    try {
      const refreshToken = getRefreshToken();
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        body: refreshToken ? { refreshToken } : {},
        headers: buildSessionAuditHeaders(),
      });
    } catch (error) {
      console.warn('[SecureAuth] Logout request failed (continuing with local cleanup)', error);
    } finally {
      if (user?.role === 'admin') {
        logAuditBestEffort('admin_logout', { email: user.email, id: user.id });
      }

      clearAuth('manual_logout');
      setUser(null);
      setMemberships([]);
      setOrganizationIds([]);
      setActiveOrgIdState(null);
      setSessionMetaVersion((value) => value + 1);
      clearActiveOrgPreference();
      setAuthStatus('unauthenticated');

      if (type) {
        setIsAuthenticated((prev) => ({
          ...prev,
          [type]: false,
        }));
      } else {
        setIsAuthenticated({
          lms: false,
          admin: false,
        });
      }
    }
  }, [buildSessionAuditHeaders, logAuditBestEffort, user]);

  useEffect(() => {
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
    setOrgResolutionStatus('resolving');
  }, [authInitializing, user, memberships, activeOrgId]);

  useEffect(() => {
    if (sessionStatus !== 'ready') {
      return;
    }
    if (hasLoggedAppLoadRef.current) {
      return;
    }
    logAuthSessionState('app_load', user);
    hasLoggedAppLoadRef.current = true;
  }, [sessionStatus, user]);

// ============================================================================
// Login
// ============================================================================

  const login = useCallback(async (
    email: string,
    password: string,
    type: 'lms' | 'admin',
    mfaCode?: string
  ): Promise<LoginResult> => {
    try {
      // Validate input
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0].message,
          errorType: 'validation_error',
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      if (type === 'admin') {
        const supabaseClient = getSupabase();
        if (!supabaseClient) {
          return {
            success: false,
            error: 'Supabase authentication is unavailable. Please try again.',
            errorType: 'network_error',
          };
        }
        try {
          const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (signInError) {
            const errorMessage = signInError.message || 'Invalid email or password. Please try again.';
            const statusCode = (signInError as { status?: number }).status ?? 0;
            return {
              success: false,
              error: errorMessage,
              errorType: statusCode === 400 ? 'invalid_credentials' : 'supabase_auth_error',
            };
          }
        } catch (supabaseError) {
          const message =
            supabaseError instanceof Error ? supabaseError.message : 'Unable to sign in with Supabase right now.';
          return {
            success: false,
            error: message,
            errorType: 'network_error',
          };
        }

        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        console.info('[AdminLogin] supabase_session', {
          sessionHasAccessToken: Boolean(sessionData?.session?.access_token),
          sessionError: sessionError?.message ?? null,
        });
        if (sessionError || !sessionData?.session?.access_token) {
          return {
            success: false,
            error: 'Unable to establish Supabase session. Please try again.',
            errorType: 'supabase_auth_error',
          };
        }

        const bootstrapSuccess = await fetchServerSession({ surface: 'admin' });
        if (!bootstrapSuccess) {
          return {
            success: false,
            error: 'Unable to load your admin session. Please try again.',
            errorType: 'network_error',
          };
        }

        logAuditBestEffort('admin_login', {
          email: sessionData.session?.user?.email ?? normalizedEmail,
          id: sessionData.session?.user?.id ?? null,
        });

        logAuthSessionState('admin-login_success', getUserSession());
        setAuthStatus('authenticated');
        return { success: true };
      }

      const rawPayload = await requestJsonWithClock<unknown>('/api/auth/login', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: {
          email: normalizedEmail,
          password,
          mfaCode,
        },
      });

      // If MFA required, backend should respond with mfaRequired
      if ((rawPayload as { mfaRequired?: boolean } | null)?.mfaRequired) {
        return {
          success: false,
          mfaRequired: true,
          mfaEmail: email,
          error: 'Multi-factor authentication required',
        };
      }

      const normalizedPayload = normalizeSessionResponsePayload(rawPayload);
      if (!normalizedPayload) {
        return {
          success: false,
          error: 'Authentication failed. Please try again.',
          errorType: 'unknown_error',
        };
      }

      applySessionPayload(normalizedPayload, {
        surface: type,
        persistTokens: true,
        reason: `${type}_login_success`,
      });
      setAuthStatus('authenticated');

      if (type === 'admin' && normalizedPayload.user) {
        logAuditBestEffort('admin_login', { email: normalizedPayload.user.email, id: normalizedPayload.user.id });
      }

      logAuthSessionState(`${type}-login_success`, getUserSession());

      return { success: true };
    } catch (error: any) {
      if (error instanceof ApiError) {
        const body = (error.body as { message?: string; mfaRequired?: boolean } | undefined) ?? {};
        if (body.mfaRequired) {
          return {
            success: false,
            mfaRequired: true,
            mfaEmail: email,
            error: 'Multi-factor authentication required',
          };
        }
        if (error.status === 503) {
          return {
            success: false,
            error: 'Authentication service is not configured. Please try again later.',
            errorType: 'network_error',
          };
        }
        if (error.status === 401) {
          return {
            success: false,
            error: 'Invalid email or password',
            errorType: 'invalid_credentials',
          };
        }
        if (error.status === 429) {
          return {
            success: false,
            error: 'Too many login attempts. Please try again later.',
            errorType: 'network_error',
          };
        }
        if (error.status === 0) {
          return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'network_error',
          };
        }
      } else {
        console.error('Login error (non-ApiError):', error);
      }
      return {
        success: false,
        error:
          (error instanceof ApiError && (error.body as { message?: string } | undefined)?.message) ||
          'Login failed. Please try again.',
        errorType: 'unknown_error',
      };
    }
  }, [applySessionPayload, fetchServerSession, requestJsonWithClock]);

  const register = useCallback(async (input: RegisterInput): Promise<RegisterResult> => {
    try {
      const validation = registerSchema.safeParse(input);
      if (!validation.success) {
        const fieldErrors: RegisterResult['fieldErrors'] = {};
        validation.error.errors.forEach((err) => {
          const field = err.path[0] as RegisterField | undefined;
          if (field) {
            fieldErrors[field] = err.message;
          }
        });
        return {
          success: false,
          error: 'Please fix the highlighted fields',
          errorType: 'validation_error',
          fieldErrors,
        };
      }

      const payload = {
        ...validation.data,
        organizationId: validation.data.organizationId ?? undefined,
      };

      // DEV log registration payload (mask password)
      if (import.meta.env && import.meta.env.DEV) {
        console.log('REGISTER payload', { ...payload, password: payload?.password ? '***' : payload?.password });
      }

      const rawResponsePayload = await requestJsonWithClock<unknown>('/api/auth/register', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: payload,
      });
      const normalizedResponse = normalizeSessionResponsePayload(rawResponsePayload);
      applySessionPayload(normalizedResponse ?? null, {
        surface: 'lms',
        persistTokens: true,
        reason: 'register_success',
      });
      setAuthStatus('authenticated');

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof ApiError) {
        const backendMsg = (error.body as { message?: string } | undefined)?.message;
        if (error.status === 409) {
          return {
            success: false,
            error: backendMsg || 'An account with this email already exists.',
            errorType: 'invalid_credentials',
          };
        }
        if (error.status === 503) {
          return {
            success: false,
            error: backendMsg || 'Registration is unavailable in demo mode.',
            errorType: 'network_error',
          };
        }
        if (error.status === 400) {
          const details = (error.body as { details?: Record<string, string> } | undefined)?.details;
          return {
            success: false,
            error: backendMsg || 'Please review your information.',
            errorType: 'validation_error',
            fieldErrors: details ?? undefined,
          };
        }
      }

      return {
        success: false,
        error: 'Registration failed. Please try again later.',
        errorType: 'unknown_error',
      };
    }
  }, [applySessionPayload, requestJsonWithClock]);

  // Send MFA challenge (email code)
  const sendMfaChallenge = useCallback(async (email: string): Promise<boolean> => {
    try {
      await apiRequest('/api/mfa/challenge', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: { email },
      });
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  // Verify MFA code
  const verifyMfa = useCallback(async (email: string, code: string): Promise<boolean> => {
    try {
      const res = await requestJsonWithClock<{ success?: boolean }>('/api/mfa/verify', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: { email, code },
      });
      return !!res?.success;
    } catch (e) {
      return false;
    }
  }, [requestJsonWithClock]);

  // ============================================================================
  // Forgot Password
  // ============================================================================

  const forgotPassword = useCallback(async (email: string): Promise<boolean> => {
    try {
      // Validate email
      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        return false;
      }

      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: {
          email: email.toLowerCase().trim(),
        },
      });

      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      return false;
    }
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = {
    isAuthenticated,
    authInitializing,
    authStatus,
    sessionStatus,
    surfaceAuthStatus,
    orgResolutionStatus,
    user,
    memberships,
    organizationIds,
    activeOrgId,
    login,
    register,
    logout,
    refreshToken: refreshTokenCallback,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
    setActiveOrganization,
    reloadSession,
    loadSession,
    retryBootstrap,
  };

  return (
    <AuthContext.Provider value={value}>
      {renderAuthState({
        authStatus,
        bootstrapError,
        onRetry: retryBootstrap,
        onGoToLogin,
        children,
      })}
    </AuthContext.Provider>
  );
}

const renderAuthState = ({
  authStatus,
  bootstrapError,
  onRetry,
  onGoToLogin,
  children,
}: {
  authStatus: 'booting' | 'authenticated' | 'unauthenticated' | 'error';
  bootstrapError: string | null;
  onRetry: () => void;
  onGoToLogin: () => void;
  children: ReactNode;
}) => {
  const pathname =
    typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
  const isAuthenticatedUser = authStatus === 'authenticated';
  const isPublicAuthPath =
    pathname === '/login' ||
    pathname.startsWith('/lms/login') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/invite/');
  const isMarketingLanding = pathname === '/';

  if (authStatus === 'booting') {
    return <BootstrapLoading />;
  }

  const shouldBypassErrorOverlay = authStatus === 'error' && isPublicAuthPath;

  if (authStatus === 'error' && !shouldBypassErrorOverlay) {
    return (
      <BootstrapErrorOverlay
        message={bootstrapError || 'We could not restore your session. Please try again.'}
        onRetry={onRetry}
        onGoToLogin={onGoToLogin}
      />
    );
  }

  if (authStatus === 'error' && shouldBypassErrorOverlay) {
    return <>{children}</>;
  }

  if (authStatus === 'unauthenticated') {
    if (!isAuthenticatedUser && (isPublicAuthPath || isMarketingLanding)) {
      return <>{children}</>;
    }
    if (!isLoginRoute()) {
      if (typeof window !== 'undefined') {
        const target = resolveLoginPath();
        window.location.assign(target);
      }
      return <BootstrapRedirecting message="Redirecting to login…" />;
    }
    return <BootstrapUnauthenticated onGoToLogin={onGoToLogin} />;
  }

  return children;
};

const BootstrapErrorOverlay = ({
  message,
  onRetry,
  onGoToLogin,
}: {
  message: string;
  onRetry: () => void;
  onGoToLogin: () => void;
}) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-6 shadow-lg">
      <div className="flex items-center gap-2 text-red-600">
        <span className="text-base font-semibold uppercase tracking-wide">Session Error</span>
      </div>
      <p className="mt-4 text-sm text-gray-700" role="alert">
        {message}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          onClick={onRetry}
        >
          Retry
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          onClick={onGoToLogin}
        >
          Go to login
        </button>
      </div>
    </div>
  </div>
);

const BootstrapLoading = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-mist bg-white px-10 py-8 shadow-lg">
      <span className="text-sm font-semibold uppercase tracking-wide text-slate">Initializing session</span>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cloud border-t-sunrise" aria-label="Loading" />
      <p className="text-center text-sm text-slate/70">Please hold while we verify your access…</p>
    </div>
  </div>
);

const BootstrapRedirecting = ({ message }: { message: string }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-mist bg-white px-10 py-8 shadow-lg">
      <span className="text-sm font-semibold uppercase tracking-wide text-slate">Redirecting</span>
      <p className="text-center text-sm text-slate/70">{message}</p>
    </div>
  </div>
);

const BootstrapUnauthenticated = ({ onGoToLogin }: { onGoToLogin: () => void }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="w-full max-w-lg rounded-2xl border border-mist bg-white p-6 shadow-lg text-center">
      <p className="text-base font-semibold text-charcoal">Please log in</p>
      <p className="mt-2 text-sm text-slate/70">To continue, sign in again.</p>
      <button
        type="button"
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-charcoal/90"
        onClick={onGoToLogin}
      >
        Go to login
      </button>
    </div>
  </div>
);

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
        console.info('💡 Restart the dev server (npm run dev:full) to clear duplicate React bundles causing this context drift.', new Error().stack);
      }
    }
    return defaultAuthContext;
  }
  return context;
}
