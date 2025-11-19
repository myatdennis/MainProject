/**
 * Enhanced Authentication Context
 * Uses secure storage and server-side verification
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  setAuthTokens,
  setUserSession,
  getUserSession,
  getAuthTokens,
  clearAuth,
  isTokenExpired,
  migrateFromLocalStorage,
  type UserSession,
} from '../lib/secureStorage';
import { loginSchema, emailSchema } from '../utils/validators';

// MFA helpers

import { logAuditAction } from '../services/auditLogService';
import axios from 'axios';

// Configure axios base URL
// Backwards compatibility: support legacy VITE_API_URL, prefer VITE_API_BASE_URL
// If a full base URL is provided (e.g. https://railway-app.up.railway.app), append /api
// Otherwise fall back to Vite dev proxy path '/api'.
const rawApiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
// Prefer the dev proxy path during development unless the API is explicitly
// configured to a local host. This prevents accidental calls to production APIs
// when running the frontend locally.
let API_URL = rawApiBase ? `${rawApiBase}/api` : '/api';
if (import.meta.env.DEV && rawApiBase && !/^https?:\/\/(localhost|127(?:\.[0-9]+){0,2}\.[0-9]+|\[::1\])(:|$)/i.test(rawApiBase)) {
  API_URL = '/api';
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

interface AuthContextType {
  isAuthenticated: AuthState;
  authInitializing: boolean;
  user: UserSession | null;
  login: (email: string, password: string, type: 'lms' | 'admin', mfaCode?: string) => Promise<LoginResult>;
  sendMfaChallenge: (email: string) => Promise<boolean>;
  verifyMfa: (email: string, code: string) => Promise<boolean>;
  logout: (type?: 'lms' | 'admin') => Promise<void>;
  refreshToken: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export const SecureAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
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
      const tokens = getAuthTokens();
      if (!tokens?.refreshToken) {
        return false;
      }

      const response = await api.post('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });

      if (response.data.accessToken) {
        setAuthTokens({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken || tokens.refreshToken,
          expiresAt: response.data.expiresAt,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, []);

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
        const tokens = getAuthTokens();

        if (!storedUser || !tokens) {
          if (isMounted) {
            setAuthInitializing(false);
          }
          return;
        }

        // Check if token is expired
        if (isTokenExpired()) {
          console.log('Token expired, attempting refresh...');
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

        // Verify token with server
        try {
          const response = await api.get('/auth/verify', {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          });

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

  // ============================================================================
  // Auto Token Refresh
  // ============================================================================

  useEffect(() => {
    if (!user) return;

    // Check token expiration every minute
    const interval = setInterval(async () => {
      const tokens = getAuthTokens();
      if (!tokens) {
        await logout();
        return;
      }

      // Refresh 2 minutes before expiration
      if (tokens.expiresAt - Date.now() < 2 * 60 * 1000) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          console.warn('Auto-refresh failed, logging out');
          await logout();
        }
      }
    }, 60 * 1000); // Every minute

    return () => clearInterval(interval);
  }, [user, refreshToken]);

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

      const { user: userData, accessToken, refreshToken: refreshTok, expiresAt } = response.data;

      setAuthTokens({
        accessToken,
        refreshToken: refreshTok,
        expiresAt,
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
  // Logout
  // ============================================================================

  const logout = useCallback(async (type?: 'lms' | 'admin'): Promise<void> => {
    try {
      const tokens = getAuthTokens();

      // Call logout API
      if (tokens?.accessToken) {
        await api.post(
          '/auth/logout',
          {},
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        ).catch(() => {
          // Ignore errors, clear local state anyway
        });
      }
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
    logout,
    refreshToken,
    forgotPassword,
    sendMfaChallenge,
    verifyMfa,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// Hook
// ============================================================================

export function useSecureAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSecureAuth must be used within SecureAuthProvider');
  }
  return context;
}

// Export for compatibility
export { AuthContext };
