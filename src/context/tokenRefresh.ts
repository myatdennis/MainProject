import { getRefreshToken, type UserSession } from '../lib/secureStorage';
import { getSupabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import apiRequest, { ApiError } from '../utils/apiClient';
import { getAccessToken, getUserSession } from '../lib/secureStorage';
import { resolveLoginPath } from '../utils/surface';
import type { SessionResponsePayload } from './sessionBootstrap';
import type { RefreshOptions } from './authTypes';

export const resolveRefreshTokenForRequest = async (sessionSnapshot: UserSession | null): Promise<string | null> => {
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

  try {
    const supabaseClient = getSupabase();
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      const supabaseRefreshToken =
        (data as any)?.session?.refresh_token ?? (data as any)?.session?.refreshToken ?? null;
      if (supabaseRefreshToken) {
        refreshToken = supabaseRefreshToken;
      }
    }
  } catch (supabaseError) {
    console.warn('[SecureAuth] Unable to read Supabase session for refresh token', supabaseError);
  }

  return refreshToken;
};

type RefreshDeps = {
  hasAuthenticatedSessionRef: { current: boolean };
  hasAttemptedRefreshRef: { current: boolean };
  refreshAttemptedRef: { current: boolean };
  refreshRunCountRef: { current: number };
  lastRefreshAttemptRef: { current: number | null };
  lastRefreshSuccessRef: { current: number | null };
  queueRefresh: (work: () => Promise<boolean>) => Promise<boolean>;
  getSkewedNow: () => number;
  buildSessionAuditHeaders: () => Record<string, string>;
  applySessionPayload: (
    payload: SessionResponsePayload | null,
    options?: { persistTokens?: boolean; reason?: string },
  ) => void;
  setAuthStatus: (status: 'booting' | 'authenticated' | 'unauthenticated' | 'error', reason?: string) => void;
  setSessionStatus: (status: 'loading' | 'authenticated' | 'unauthenticated', reason?: string) => void;
  fetchServerSession: (options?: { silent?: boolean }) => Promise<boolean>;
  logAuthDebug: (label: string, payload: Record<string, unknown>) => void;
  logRefreshResult: (status: string) => void;
  MIN_REFRESH_INTERVAL_MS: number;
  isNavigatorOffline: () => boolean;
};

export let REFRESH_MANAGER_ACTIVE = false;

export const setRefreshManagerActive = (active: boolean) => {
  REFRESH_MANAGER_ACTIVE = active;
};

export const runRefreshTokenCallback = async (
  options: RefreshOptions = {},
  deps: RefreshDeps,
): Promise<boolean> => {
  const reason = options.reason ?? 'protected_401';
  console.debug('[SecureAuth] refreshTokenCallback start', { reason, isPlatformAdmin: deps.hasAuthenticatedSessionRef.current });

  const allowedByReason = reason === 'user_retry' || (reason === 'protected_401' && deps.hasAuthenticatedSessionRef.current);
  if (!allowedByReason) {
    console.debug('[SecureAuth] refreshTokenCallback suppressed (not allowed yet)', { reason });
    return false;
  }

  if (reason === 'user_retry') {
    deps.hasAttemptedRefreshRef.current = false;
    deps.refreshAttemptedRef.current = false;
  }

  if (deps.hasAttemptedRefreshRef.current || deps.refreshAttemptedRef.current) {
    return false;
  }

  return deps.queueRefresh(async () => {
    deps.hasAttemptedRefreshRef.current = true;
    deps.refreshAttemptedRef.current = true;
    const refreshRunCount = ++deps.refreshRunCountRef.current;
    deps.logAuthDebug('[auth] refresh start', { count: refreshRunCount, reason });
    let refreshStatus: 'success' | 'unauthenticated' | 'network_issue' | 'error' | 'skipped' = 'skipped';
    const now = deps.getSkewedNow();
    if (deps.lastRefreshAttemptRef.current && now - deps.lastRefreshAttemptRef.current < deps.MIN_REFRESH_INTERVAL_MS) {
      deps.logRefreshResult(refreshStatus);
      return false;
    }

    if (deps.isNavigatorOffline()) {
      console.info('[SecureAuth] Skipping refresh while offline');
      refreshStatus = 'network_issue';
      deps.logRefreshResult(refreshStatus);
      return false;
    }

    deps.lastRefreshAttemptRef.current = now;

    try {
      let sessionSnapshot: UserSession | null = null;
      try {
        sessionSnapshot = getUserSession();
      } catch (sessionError) {
        console.warn('[SecureAuth] Failed to read cached user session for refresh payload', sessionError);
      }

      const refreshToken = await resolveRefreshTokenForRequest(sessionSnapshot);
      if (!refreshToken) {
        console.warn('[SecureAuth] No refresh token available for /api/auth/refresh request');
        refreshStatus = 'unauthenticated';
        return false;
      }

      const payload = await apiRequest<SessionResponsePayload | null>('/api/auth/refresh', {
        method: 'POST',
        allowAnonymous: true,
        headers: {
          ...deps.buildSessionAuditHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (payload?.user) {
        deps.applySessionPayload(payload, { persistTokens: true, reason: 'refresh_success' });
        deps.setAuthStatus('authenticated', 'refreshTokenCallback:refresh_success');
        deps.setSessionStatus('authenticated', 'refreshTokenCallback:refresh_success');
        refreshStatus = 'success';
        deps.lastRefreshSuccessRef.current = deps.getSkewedNow();
        return true;
      }

      await deps.fetchServerSession({ silent: true });
      refreshStatus = 'success';
      deps.lastRefreshSuccessRef.current = deps.getSkewedNow();
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          console.warn('[SecureAuth] Refresh token rejected, clearing session');
          if (import.meta.env?.DEV) {
            console.warn('[AUTH_RESET]', {
              source: 'refreshTokenCallback:refresh_rejected',
              reason: 'refresh_rejected',
              pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
              hadUser: deps.hasAuthenticatedSessionRef.current,
              hadToken: Boolean(getAccessToken()),
            });
          }
          deps.hasAuthenticatedSessionRef.current = false;
          deps.applySessionPayload(null, { persistTokens: true, reason: 'refresh_rejected' });
          deps.setAuthStatus('unauthenticated', 'refreshTokenCallback:refresh_rejected');
          if (typeof window !== 'undefined') {
            toast.error('Your session expired. Please sign in again.', { id: 'session-expired' });
            window.location.assign(resolveLoginPath());
          }
          refreshStatus = 'unauthenticated';
          return false;
        }

        if ((error.body as any)?.code === 'timeout' || error.status === 0) {
          console.warn('[SecureAuth] Refresh deferred due to network issue');
          refreshStatus = 'network_issue';
          return false;
        }
      }

      console.error('Token refresh failed:', error);
      refreshStatus = 'error';
      return false;
    } finally {
      deps.logRefreshResult(refreshStatus);
    }
  });
};
