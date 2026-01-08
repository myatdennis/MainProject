import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  setSessionMetadata,
  setUserSession,
  getUserSession,
  getSessionMetadata,
  clearAuth,
  migrateFromLocalStorage,
  type UserSession,
  type UserMembership,
  type SessionMetadata,
} from '../lib/secureStorage';
import { loginSchema, emailSchema, registerSchema } from '../utils/validators';
import { queueRefresh } from '../lib/refreshQueue';
import api from '../lib/httpClient';

// MFA helpers

import { logAuditAction } from '../dal/auditLog';
import axios from 'axios';

const REFRESH_INTERVAL_MS = 30 * 1000;
const MIN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const REFRESH_RATIO = 0.15;
const SAFETY_REFRESH_FLOOR_MS = 45 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const FOCUS_REFRESH_THRESHOLD_MS = 3 * 60 * 1000;

const isNavigatorOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const ACTIVE_ORG_STORAGE_KEY = 'huddle_active_org';

type SessionSurface = 'admin' | 'lms';
type RefreshReason = 'auto' | 'focus' | 'online' | 'manual' | 'bootstrap';

interface RefreshOptions {
  reason?: RefreshReason;
  force?: boolean;
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
  mfaRequired?: boolean;
}

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
      status: row.status ?? null,
      organizationName: row.organizationName ?? row.organization_name ?? null,
      organizationStatus: row.organizationStatus ?? row.organization_status ?? null,
      subscription: row.subscription ?? null,
      features: row.features ?? null,
      acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
      lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
    });
    return acc;
  }, []);
};

const loadActiveOrgPreference = (): string | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  } catch (error) {
    console.warn('[SecureAuth] Failed to read active org preference', error);
    return null;
  }
};

const persistActiveOrgPreference = (orgId: string | null) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    if (orgId) {
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
    } else {
      window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[SecureAuth] Failed to persist active org preference', error);
  }
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

const shouldRefreshToken = (
  metadata: SessionMetadata | null,
  { now = Date.now(), onFocus = false }: { now?: number; onFocus?: boolean } = {},
): boolean => {
  const expiresAt = metadata?.accessExpiresAt;
  if (!expiresAt) return false;

  const issuedAt = metadata.accessIssuedAt ?? expiresAt - REFRESH_INTERVAL_MS;
  const ttl = Math.max(expiresAt - issuedAt, 0);
  const remaining = expiresAt - now;
  const bufferWindow = Math.max(MIN_REFRESH_BUFFER_MS, ttl * REFRESH_RATIO);

  if (remaining <= SAFETY_REFRESH_FLOOR_MS) {
    return true;
  }

  if (onFocus) {
    return remaining <= Math.max(bufferWindow, FOCUS_REFRESH_THRESHOLD_MS);
  }

  return remaining <= bufferWindow;
};

// Automatically attach user metadata to auth requests for auditing/multi-tenant routing
api.interceptors.request.use((config) => {
  try {
    const session = getUserSession();
    if (session) {
      config.headers = config.headers ?? {};
      if (session.id && !config.headers['X-User-Id']) {
        config.headers['X-User-Id'] = session.id;
      }
      if (session.role && !config.headers['X-User-Role']) {
        config.headers['X-User-Role'] = session.role;
      }
      const preferredOrgId = session.activeOrgId || session.organizationId;
      if (preferredOrgId && !config.headers['X-Org-Id']) {
        config.headers['X-Org-Id'] = preferredOrgId;
      }
    }
  } catch (error) {
    console.warn('[SecureAuth] Failed to attach auth headers:', error);
  }

  return config;
});

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
  errorType?: 'invalid_credentials' | 'network_error' | 'validation_error' | 'unknown_error';
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
  reloadSession: (options?: { surface?: SessionSurface }) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const defaultAuthContext: AuthContextType = {
  isAuthenticated: { lms: false, admin: false },
  authInitializing: true,
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
  const serverTimeOffsetRef = useRef(0);
  const lastRefreshAttemptRef = useRef(0);
  const lastRefreshSuccessRef = useRef(0);

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
      { surface, persistTokens = true }: { surface?: SessionSurface; persistTokens?: boolean } = {},
    ) => {
      if (!payload?.user) {
        setUser(null);
        setMemberships([]);
        setOrganizationIds([]);
        setActiveOrgIdState(null);
        setIsAuthenticated({ lms: false, admin: false });
        if (persistTokens) {
          clearAuth();
        }
        return;
      }

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

      const preferredOrg = pickValidOrgId(session.activeOrgId, normalizedMemberships, loadActiveOrgPreference());
      persistActiveOrgPreference(preferredOrg);
      session.activeOrgId = preferredOrg;

      setUser(session);
      setMemberships(normalizedMemberships);
      setOrganizationIds(orgIds);
      setActiveOrgIdState(preferredOrg);
      setIsAuthenticated(computeAuthState(session, surface));

      if (persistTokens) {
        setUserSession(session);
        if (payload.expiresAt || payload.refreshExpiresAt) {
          const issuedAt = getSkewedNow();
          setSessionMetadata({
            accessExpiresAt: payload.expiresAt ?? undefined,
            refreshExpiresAt: payload.refreshExpiresAt ?? undefined,
            accessIssuedAt: payload.expiresAt ? issuedAt : undefined,
            refreshIssuedAt: payload.refreshExpiresAt ? issuedAt : undefined,
          });
        }
      }
    },
    [getSkewedNow, setUser, setMemberships, setOrganizationIds, setActiveOrgIdState, setIsAuthenticated],
  );

  const fetchServerSession = useCallback(
    async ({ surface, signal }: { surface?: SessionSurface; signal?: AbortSignal } = {}): Promise<boolean> => {
      try {
        const response = await api.get<SessionResponsePayload>('/auth/session', {
          withCredentials: true,
          signal,
        });
        captureServerClock(response.headers as Record<string, any> | undefined);
        if (response.data?.user) {
          applySessionPayload(response.data, { surface, persistTokens: false });
          return true;
        }
        return false;
      } catch (error) {
        if ((typeof axios.isCancel === 'function' && axios.isCancel(error)) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')) {
          return false;
        }
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return false;
        }
        console.warn('[SecureAuth] Failed to reload session', error);
        return false;
      }
    },
    [applySessionPayload, captureServerClock],
  );

  const reloadSession = useCallback(
    (options?: { surface?: SessionSurface }): Promise<boolean> => fetchServerSession(options ?? {}),
    [fetchServerSession],
  );

  const setActiveOrganization = useCallback(
    async (orgId: string | null) => {
      const normalized = orgId && memberships.some((membership) => membership.orgId === orgId) ? orgId : null;
      persistActiveOrgPreference(normalized);
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
    },
    [memberships],
  );

  // ============================================================================
  // Token Refresh
  // ============================================================================

  const refreshToken = useCallback(
    async (options: RefreshOptions = {}): Promise<boolean> => {
      return queueRefresh(async () => {
        const now = getSkewedNow();
        if (!options.force && lastRefreshAttemptRef.current && now - lastRefreshAttemptRef.current < MIN_REFRESH_INTERVAL_MS) {
          return false;
        }

        if (isNavigatorOffline()) {
          console.info('[SecureAuth] Skipping refresh while offline');
          return false;
        }

        lastRefreshAttemptRef.current = now;

        try {
          const response = await api.post<SessionResponsePayload>(
            '/auth/refresh',
            {},
            {
              withCredentials: true,
            },
          );

          captureServerClock(response.headers as Record<string, any> | undefined);

          if (response.data?.user) {
            applySessionPayload(response.data, { persistTokens: true });
          } else {
            await fetchServerSession();
          }

          lastRefreshSuccessRef.current = getSkewedNow();
          return true;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 401) {
              console.warn('[SecureAuth] Refresh token rejected, clearing session');
              applySessionPayload(null, { persistTokens: true });
              return false;
            }

            if (!error.response || error.code === 'ERR_NETWORK') {
              console.warn('[SecureAuth] Refresh deferred due to network issue');
              return false;
            }
          }

          console.error('Token refresh failed:', error);
          return false;
        }
      });
    },
    [applySessionPayload, captureServerClock, fetchServerSession, getSkewedNow],
  );

  // ============================================================================
  // Logout
  // ============================================================================

  const logout = useCallback(async (type?: 'lms' | 'admin'): Promise<void> => {
    try {
      await api.post(
        '/auth/logout',
        {},
        { withCredentials: true },
      );
    } catch (error) {
      console.warn('[SecureAuth] Logout request failed (continuing with local cleanup)', error);
    } finally {
      if (user?.role === 'admin') {
        logAuditAction('admin_logout', { email: user.email, id: user.id });
      }

      clearAuth();
      setUser(null);
      setMemberships([]);
      setOrganizationIds([]);
      setActiveOrgIdState(null);
      persistActiveOrgPreference(null);

      if (type) {
        setIsAuthenticated(prev => ({
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
  }, [user]);

  // ============================================================================
  // Initialize Auth
  // ============================================================================

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const initializeAuth = async () => {
      try {
        migrateFromLocalStorage();

        const hasActiveSession = await fetchServerSession({ signal: abortController.signal });
        if (hasActiveSession) {
          return;
        }

        const refreshed = await refreshToken({ reason: 'bootstrap', force: true });
        if (refreshed) {
          await fetchServerSession({ signal: abortController.signal });
          return;
        }

        applySessionPayload(null, { persistTokens: true });
      } catch (error) {
        if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
          return;
        }
        console.error('Auth initialization error:', error);
        applySessionPayload(null, { persistTokens: true });
      } finally {
        if (active) {
          setAuthInitializing(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [fetchServerSession, refreshToken, applySessionPayload]);
  // =========================================================================
  // Auto Token Refresh
  // =========================================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const triggerRefresh = async (reason: RefreshReason) => {
      if (cancelled || isNavigatorOffline()) {
        return;
      }

      const metadata = getSessionMetadata();
      const now = getSkewedNow();
      const sinceLastSuccess = lastRefreshSuccessRef.current ? now - lastRefreshSuccessRef.current : Number.POSITIVE_INFINITY;

      if (reason === 'auto') {
        if (!shouldRefreshToken(metadata, { now })) {
          return;
        }
      } else if (reason === 'focus') {
        if (sinceLastSuccess < FOCUS_REFRESH_THRESHOLD_MS) {
          return;
        }
        if (!shouldRefreshToken(metadata, { now, onFocus: true })) {
          return;
        }
      }

      await refreshToken({ reason });
    };

    const interval = window.setInterval(() => {
      void triggerRefresh('auto');
    }, REFRESH_INTERVAL_MS);

    const handleOnline = () => {
      void triggerRefresh('online');
    };

    const handleFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void triggerRefresh('focus');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleFocus);
    }

    void triggerRefresh('auto');

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleFocus);
      }
    };
  }, [user, refreshToken, getSkewedNow]);

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

      // Call login API (use relative path; axios instance already points to '/api')
      const response = await api.post<SessionResponsePayload>('/auth/login', {
        email: email.toLowerCase().trim(),
        password,
        mfaCode,
      });
      captureServerClock(response.headers as Record<string, any> | undefined);

      // If MFA required, backend should respond with mfaRequired
      if (response.data.mfaRequired) {
        return {
          success: false,
          mfaRequired: true,
          mfaEmail: email,
          error: 'Multi-factor authentication required',
        };
      }

      applySessionPayload(response.data ?? null, { surface: type, persistTokens: true });

      if (type === 'admin' && response.data?.user) {
        logAuditAction('admin_login', { email: response.data.user.email, id: response.data.user.id });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.data?.mfaRequired) {
          return {
            success: false,
            mfaRequired: true,
            mfaEmail: email,
            error: 'Multi-factor authentication required',
          };
        }
        if (error.response?.status === 503) {
          return {
            success: false,
            error: 'Authentication service is not configured. Please try again later.',
            errorType: 'network_error',
          };
        }
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Invalid email or password',
            errorType: 'invalid_credentials',
          };
        }
        if (error.response?.status === 429) {
          return {
            success: false,
            error: 'Too many login attempts. Please try again later.',
            errorType: 'network_error',
          };
        }
        if (!error.response) {
          return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'network_error',
          };
        }
      }
      return {
        success: false,
        error: (error as any).response?.data?.message || 'Login failed. Please try again.',
        errorType: 'unknown_error',
      };
    }
  }, [applySessionPayload]);

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

  const response = await api.post<SessionResponsePayload>('/auth/register', payload);
  captureServerClock(response.headers as Record<string, any> | undefined);
      applySessionPayload(response.data ?? null, { surface: 'lms', persistTokens: true });

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 409) {
          return {
            success: false,
            error: 'An account with this email already exists.',
            errorType: 'invalid_credentials',
          };
        }
        if (status === 503) {
          return {
            success: false,
            error: 'Registration is unavailable in demo mode.',
            errorType: 'network_error',
          };
        }
        if (status === 400) {
          const details = (error.response?.data as { details?: Record<string, string> } | undefined)?.details;
          return {
            success: false,
            error: 'Please review your information.',
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
  }, [applySessionPayload]);

  // Send MFA challenge (email code)
  const sendMfaChallenge = useCallback(async (email: string): Promise<boolean> => {
    try {
      await api.post('/mfa/challenge', { email });
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  // Verify MFA code
  const verifyMfa = useCallback(async (email: string, code: string): Promise<boolean> => {
    try {
      const res = await api.post('/mfa/verify', { email, code });
      return !!res.data.success;
    } catch (e) {
      return false;
    }
  }, []);

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

      await api.post('/auth/forgot-password', {
        email: email.toLowerCase().trim(),
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
    user,
    memberships,
    organizationIds,
    activeOrgId,
    login,
    register,
    logout,
    refreshToken,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
    setActiveOrganization,
    reloadSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
        console.info('💡 Restart the dev server (npm run dev:full) to clear duplicate React bundles causing this context drift.', new Error().stack);
      }
    }
    return defaultAuthContext;
  }
  return context;
}

// Export for compatibility
export { AuthContext };
