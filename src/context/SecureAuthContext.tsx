/**
 * Enhanced Authentication Context
 * Uses secure storage and server-side verification
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  setSessionMetadata,
  setUserSession,
  getUserSession,
  getSessionMetadata,
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearAuth,
  migrateFromLocalStorage,
  type UserSession,
} from '../lib/secureStorage';
import { loginSchema, emailSchema, registerSchema } from '../utils/validators';

// MFA helpers

import { logAuditAction } from '../dal/auditLog';
import axios from 'axios';
import { resolveApiUrl } from '../config/apiBase';

// Configure axios base URL using unified API resolver so production calls
// use https://the-huddle.co while local dev remains on the Vite proxy.
const API_URL = resolveApiUrl('/api');

if (
  import.meta.env.DEV &&
  /^https?:\/\//i.test(API_URL) &&
  !/^https?:\/\/(localhost|127(?:\.[0-9]+){0,2}\.[0-9]+|\[::1\])(:|$)/i.test(API_URL)
) {
  console.warn('[SecureAuth] API base points to a non-local host in development:', API_URL);
}
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Allow cookies/CSRF if backend uses them
  withCredentials: true,
  timeout: 30000,
});

// Automatically attach secure storage tokens + user metadata to auth requests
api.interceptors.request.use(config => {
  try {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers = config.headers ?? {};
      if (!config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    const session = getUserSession();
    if (session) {
      config.headers = config.headers ?? {};
      if (session.id && !config.headers['X-User-Id']) {
        config.headers['X-User-Id'] = session.id;
      }
      if (session.role && !config.headers['X-User-Role']) {
        config.headers['X-User-Role'] = session.role;
      }
      if (session.organizationId && !config.headers['X-Org-Id']) {
        config.headers['X-Org-Id'] = session.organizationId;
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
  login: (email: string, password: string, type: 'lms' | 'admin', mfaCode?: string) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  sendMfaChallenge: (email: string) => Promise<boolean>;
  verifyMfa: (email: string, code: string) => Promise<boolean>;
  logout: (type?: 'lms' | 'admin') => Promise<void>;
  refreshToken: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const defaultAuthContext: AuthContextType = {
  isAuthenticated: { lms: false, admin: false },
  authInitializing: true,
  user: null,
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
  const [authInitializing, setAuthInitializing] = useState(true);

  // ============================================================================
  // Token Refresh
  // ============================================================================

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const storedRefreshToken = getRefreshToken();
      if (!storedRefreshToken) {
        console.warn('Refresh requested but no refresh token stored. Aborting.');
        return false;
      }

      const response = await api.post('/auth/refresh', {
        refreshToken: storedRefreshToken,
      });

      if (response.data?.accessToken) {
        setAccessToken(response.data.accessToken);
      }

      if (response.data?.refreshToken) {
        setRefreshToken(response.data.refreshToken);
      }
      if (response.data?.expiresAt || response.data?.refreshExpiresAt) {
        setSessionMetadata({
          accessExpiresAt: response.data.expiresAt,
          refreshExpiresAt: response.data.refreshExpiresAt,
        });
      }
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, []);

  // ============================================================================
  // Logout
  // ============================================================================

  const logout = useCallback(async (type?: 'lms' | 'admin'): Promise<void> => {
    try {
      const refreshTokenPayload = getRefreshToken();
      await api.post('/auth/logout', refreshTokenPayload ? { refreshToken: refreshTokenPayload } : {}).catch(() => {
        // Ignore errors, clear local state anyway
      });
    } finally {
      // Audit log for admin logout
      if (user?.role === 'admin') {
        logAuditAction('admin_logout', { email: user.email, id: user.id });
      }

      // Clear local state
      clearAuth();
      setUser(null);

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
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Migrate from old localStorage if needed
        migrateFromLocalStorage();

        // Get stored session
        const storedUser = getUserSession();
        if (!storedUser) {
          if (isMounted) {
            setAuthInitializing(false);
          }
          return;
        }

        const metadata = getSessionMetadata();
        if (metadata?.accessExpiresAt && metadata.accessExpiresAt <= Date.now()) {
          console.log('Session metadata expired, attempting refresh...');
          const refreshed = await refreshToken();

          if (!refreshed) {
            console.log('Token refresh failed, clearing auth');
            clearAuth();
            if (isMounted) {
              setAuthInitializing(false);
            }
            return;
          }
        }

        // Verify token with server (cookies carry the credentials)
        try {
          const response = await api.get('/auth/verify');

          if (response.data.valid) {
            setUser(storedUser);
            setIsAuthenticated({
              lms: storedUser.role !== 'admin',
              admin: storedUser.role === 'admin',
            });
          } else {
            clearAuth();
          }
        } catch (error) {
          console.warn('Token verification failed:', error);
          clearAuth();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (isMounted) {
          setAuthInitializing(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  // =========================================================================
  // Auto Token Refresh
  // =========================================================================

  useEffect(() => {
    if (!user) return;

    // Check token expiration every minute
    const interval = setInterval(async () => {
      const metadata = getSessionMetadata();
      if (!metadata?.accessExpiresAt) {
        return;
      }

      // Refresh 2 minutes before expiration
      if (metadata.accessExpiresAt - Date.now() < 2 * 60 * 1000) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          console.warn('Auto-refresh failed, logging out');
          await logout();
        }
      }
    }, 60 * 1000); // Every minute

    return () => clearInterval(interval);
  }, [user, refreshToken, logout]);

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
      const response = await api.post('/auth/login', {
        email: email.toLowerCase().trim(),
        password,
        mfaCode,
      });

      // If MFA required, backend should respond with mfaRequired
      if (response.data.mfaRequired) {
        return {
          success: false,
          mfaRequired: true,
          mfaEmail: email,
          error: 'Multi-factor authentication required',
        };
      }

      const { user: userData, accessToken, refreshToken: newRefreshToken, expiresAt, refreshExpiresAt } = response.data;

      setSessionMetadata({
        accessExpiresAt: expiresAt,
        refreshExpiresAt,
      });

      const userSession: UserSession = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        organizationId: userData.organizationId,
      };

      setUserSession(userSession);
      setUser(userSession);

      setIsAuthenticated({
        lms: type === 'lms',
        admin: type === 'admin',
      });

      if (type === 'admin') {
        logAuditAction('admin_login', { email: userData.email, id: userData.id });
      }

      setAccessToken(accessToken ?? null);
      setRefreshToken(newRefreshToken ?? null);

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
  }, []);

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

      const response = await api.post('/auth/register', payload);
      const { user: userData, accessToken, refreshToken: newRefreshToken, expiresAt, refreshExpiresAt } = response.data;

      setSessionMetadata({
        accessExpiresAt: expiresAt,
        refreshExpiresAt,
      });

      const userSession: UserSession = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        organizationId: userData.organizationId,
      };

      setUserSession(userSession);
      setUser(userSession);
      setAccessToken(accessToken ?? null);
      setRefreshToken(newRefreshToken ?? null);
      setIsAuthenticated({ lms: true, admin: userData.role === 'admin' });

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
  }, []);

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
    login,
    register,
    logout,
    refreshToken,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
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
