import { emailSchema, loginSchema, registerSchema } from '../utils/validators';
import apiRequest from '../utils/apiClient';
import { ApiError } from '../utils/apiClient';
import { getSupabase } from '../lib/supabaseClient';
import type { SessionResponsePayload } from './sessionBootstrap';
import { normalizeSessionResponsePayload } from './sessionBootstrap';
import type { LoginResult, RegisterField, RegisterInput, RegisterResult } from './authTypes';

type BuildAuditHeaders = () => Record<string, string>;

const isApiErrorLike = (error: unknown): error is { status: number; body?: unknown } =>
  Boolean(error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number');

// resolveBrowserFetchUrl removed — tests use requestJsonWithClock (mockable) instead of raw fetch

type AuthActionsDependencies = {
  buildSessionAuditHeaders: BuildAuditHeaders;
  requestJsonWithClock: <T>(path: string, options?: Record<string, unknown>) => Promise<T>;
  applySessionPayload: (
    payload: SessionResponsePayload | null,
    options?: { surface?: 'lms' | 'admin' | 'client'; persistTokens?: boolean; reason?: string },
  ) => void;
  setAuthStatus: (status: 'booting' | 'authenticated' | 'unauthenticated' | 'error', reason?: string) => void;
  setSessionStatus: (status: 'loading' | 'authenticated' | 'unauthenticated', reason?: string) => void;
  logAuthSessionState?: (contextLabel: string, session: any) => void;
  enqueueAudit?: (entry: { action: string; details?: Record<string, unknown> }) => void;
  flushAuditQueue?: () => Promise<unknown>;
};

export const createAuthActions = ({
  buildSessionAuditHeaders,
  requestJsonWithClock,
  applySessionPayload,
  setAuthStatus,
  setSessionStatus,
}: AuthActionsDependencies) => ({
  async login(email: string, password: string, _type: 'lms' | 'admin', _mfaCode?: string): Promise<LoginResult> {
    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0].message,
          errorType: 'validation_error',
        };
      }

      const normalizedEmail = email.toLowerCase().trim();
      console.log('[LOGIN REQUEST]', { email, via: 'supabase' });

      const supabase = getSupabase();
      if (!supabase?.auth?.signInWithPassword) {
        // If Supabase client isn't available, do not attempt legacy API login.
        return {
          success: false,
          error: 'Authentication service is not configured. Please try again later.',
          errorType: 'network_error',
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      } as any);

      if (error) {
        throw error;
      }

      // Do NOT manually set tokens or mutate session state here. The Supabase
      // client will persist the session and fire onAuthStateChange; the
      // provider will pick it up and apply server-side enrichment.
      const user = data?.user ?? null;
      return { success: true, user } as any;
    } catch (error: any) {
      if (isApiErrorLike(error)) {
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

      // Map known message strings to errorType when possible
      const apiBodyMsg = isApiErrorLike(error) && (error.body as { message?: string } | undefined)?.message;
      const errMsg = (apiBodyMsg as string) || String(error?.message ?? error);
      if (typeof errMsg === 'string' && /invalid login/i.test(errMsg)) {
        return { success: false, error: errMsg, errorType: 'invalid_credentials' };
      }
      if (typeof errMsg === 'string' && /invalid.*credentials|invalid.*password|invalid.*email/i.test(errMsg)) {
        return { success: false, error: 'Invalid email or password', errorType: 'invalid_credentials' };
      }

      // Additional check: sometimes supabase or other clients return 'Invalid login' inside nested objects
      if (isApiErrorLike(error) && apiBodyMsg && typeof apiBodyMsg === 'string' && /invalid/i.test(apiBodyMsg) && /login|credentials|password|email/i.test(apiBodyMsg)) {
        return { success: false, error: apiBodyMsg, errorType: 'invalid_credentials' };
      }

      return {
        success: false,
        error: errMsg || 'Login failed. Please try again.',
        errorType: 'unknown_error',
      };
    }
  },

  async register(input: RegisterInput): Promise<RegisterResult> {
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
      setSessionStatus('authenticated', 'register:success');

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
  },

  async sendMfaChallenge(email: string): Promise<boolean> {
    try {
      await apiRequest('/api/mfa/challenge', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: { email },
      });
      return true;
    } catch {
      return false;
    }
  },

  async verifyMfa(email: string, code: string): Promise<boolean> {
    try {
      const res = await requestJsonWithClock<{ success?: boolean }>('/api/mfa/verify', {
        method: 'POST',
        allowAnonymous: true,
        headers: buildSessionAuditHeaders(),
        body: { email, code },
      });
      return !!res?.success;
    } catch {
      return false;
    }
  },

  async forgotPassword(email: string): Promise<boolean> {
    try {
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
  },
});
