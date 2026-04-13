import { emailSchema, loginSchema, registerSchema } from '../utils/validators';
import apiRequest, { ApiError } from '../utils/apiClient';
import { getSupabase } from '../lib/supabaseClient';
import { getUserSession } from '../lib/secureStorage';
import type { SessionResponsePayload } from './sessionBootstrap';
import { normalizeSessionResponsePayload } from './sessionBootstrap';
import type { LoginResult, RegisterField, RegisterInput, RegisterResult } from './authTypes';

type BuildAuditHeaders = () => Record<string, string>;

type AuthActionsDependencies = {
  buildSessionAuditHeaders: BuildAuditHeaders;
  requestJsonWithClock: <T>(path: string, options?: Record<string, unknown>) => Promise<T>;
  applySessionPayload: (
    payload: SessionResponsePayload | null,
    options?: { surface?: 'lms' | 'admin' | 'client'; persistTokens?: boolean; reason?: string },
  ) => void;
  setAuthStatus: (status: 'booting' | 'authenticated' | 'unauthenticated' | 'error', reason?: string) => void;
  setSessionStatus: (status: 'loading' | 'authenticated' | 'unauthenticated', reason?: string) => void;
  logAuthSessionState: (contextLabel: string, session: any) => void;
  enqueueAudit: (entry: { action: string; details?: Record<string, unknown> }) => void;
  flushAuditQueue: () => Promise<unknown>;
};

export const createAuthActions = ({
  buildSessionAuditHeaders,
  requestJsonWithClock,
  applySessionPayload,
  setAuthStatus,
  setSessionStatus,
  logAuthSessionState,
  enqueueAudit,
  flushAuditQueue,
}: AuthActionsDependencies) => ({
  async login(email: string, password: string, type: 'lms' | 'admin', mfaCode?: string): Promise<LoginResult> {
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

      if ((rawPayload as { mfaRequired?: boolean } | null)?.mfaRequired) {
        return {
          success: false,
          mfaRequired: true,
          mfaEmail: email,
          error: 'Multi-factor authentication required',
        };
      }

      const normalizedPayload = normalizeSessionResponsePayload(rawPayload);
      let payloadFromFallback: SessionResponsePayload | null = normalizedPayload;

      if (!payloadFromFallback) {
        const supabase = getSupabase();
        if (supabase?.auth?.signInWithPassword) {
          const signInResult = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          } as any);

          if (signInResult.error) {
            if (signInResult.error.status === 400) {
              return {
                success: false,
                error: 'Invalid email or password',
                errorType: 'invalid_credentials',
              };
            }
            return {
              success: false,
              error: signInResult.error.message || 'Login failed. Please try again.',
              errorType: 'unknown_error',
            };
          }

          try {
            const sessionPayloadRaw = await requestJsonWithClock<unknown>('/auth/session', {
              method: 'GET',
              requireAuth: true,
            });
            payloadFromFallback = normalizeSessionResponsePayload(sessionPayloadRaw);
          } catch (sessionError) {
            console.warn('[SecureAuth] login fallback /auth/session failed', sessionError);
            payloadFromFallback = null;
          }
        } else {
          try {
            const sessionPayloadRaw = await requestJsonWithClock<unknown>('/auth/session', {
              method: 'GET',
              requireAuth: true,
            });
            payloadFromFallback = normalizeSessionResponsePayload(sessionPayloadRaw);
          } catch {
            payloadFromFallback = null;
          }
        }
      }

      if (!payloadFromFallback) {
        console.debug('[SecureAuth] login fallback failed', {
          hasNormalizedPayload: Boolean(normalizedPayload),
          supabaseSignInAvailable: Boolean(getSupabase()?.auth?.signInWithPassword),
        });
        return {
          success: false,
          error: 'Authentication failed. Please try again.',
          errorType: 'unknown_error',
        };
      }

      applySessionPayload(payloadFromFallback, {
        surface: type,
        persistTokens: true,
        reason: `${type}_login_success`,
      });
      setAuthStatus('authenticated', `login:${type}_success`);
      setSessionStatus('authenticated', `login:${type}_success`);

      logAuthSessionState(`${type}-login_success`, getUserSession());
      console.info('[LOGIN SUCCESS]', {
        surface: type,
        userId: payloadFromFallback.user?.id ?? null,
        membershipCount: payloadFromFallback.memberships?.length ?? 0,
      });

      if (type === 'admin') {
        enqueueAudit({
          action: 'admin_login',
          details: {
            email: payloadFromFallback.user?.email ?? normalizedEmail,
            id: payloadFromFallback.user?.id ?? null,
          },
        });
        void flushAuditQueue();
      }

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
