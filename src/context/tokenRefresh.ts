import { type UserSession } from '../lib/secureStorage';
import { getSupabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { ApiError } from '../utils/apiClient';
import { resolveLoginPath } from '../utils/surface';
import type { SessionResponsePayload } from './sessionBootstrap';
import type { RefreshOptions } from './authTypes';

// Removed manual refresh-token resolution. The Supabase client is the
// authoritative source for tokens. Callers should use `supabase.auth.getSession()`
// or `supabase.auth.refreshSession()` directly.
export const resolveRefreshTokenForRequest = async (_sessionSnapshot: UserSession | null): Promise<string | null> => {
  // Deprecated shim: do not rely on persisted refresh tokens.
  return null;
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
        const supabaseClient = getSupabase();
        if (!supabaseClient) {
          console.warn('[SecureAuth] No Supabase client available for refresh');
          refreshStatus = 'error';
          return false;
        }

        // Ask Supabase client to refresh its session using the embedded
        // refresh token. This is the canonical client-side refresh.
        try {
          // supabase.auth.refreshSession() will instruct the client to refresh
          // using its stored refresh token. It may be a no-op if the session is
          // already fresh.
          // Note: some supabase client versions may not expose refreshSession on
          // the client; in that case, we fall back to getSession() which may
          // also trigger auto-refresh when configured with autoRefreshToken.
          if (typeof (supabaseClient.auth as any).refreshSession === 'function') {
            await (supabaseClient.auth as any).refreshSession();
          }
        } catch (refreshErr) {
          // Non-fatal: continue to attempt to read session below.
          console.warn('[SecureAuth] supabase refreshSession() failed', refreshErr);
        }

        // Re-query the Supabase session after attempting refresh.
        const { data } = await supabaseClient.auth.getSession();
        const currentSession = (data as any)?.session ?? null;
        if (!currentSession) {
          console.warn('[SecureAuth] No Supabase session present after refresh attempt');
          refreshStatus = 'unauthenticated';
          return false;
        }

        // Retrieve server-side enriched session (memberships, orgs).
        const serverApplied = await deps.fetchServerSession({ silent: true });
        if (serverApplied) {
          deps.setAuthStatus('authenticated', 'refreshTokenCallback:refresh_success');
          deps.setSessionStatus('authenticated', 'refreshTokenCallback:refresh_success');
          refreshStatus = 'success';
          deps.lastRefreshSuccessRef.current = deps.getSkewedNow();
          return true;
        }

        // Fallback: apply the minimal Supabase session payload so UI reflects
        // the refreshed user object even if server enrichment failed.
        const minimalPayload: SessionResponsePayload = {
          user: (currentSession as any).user ?? null,
          accessToken: (currentSession as any).access_token ?? null,
          refreshToken: (currentSession as any).refresh_token ?? null,
          expiresAt: (currentSession as any).expires_at ?? null,
          refreshExpiresAt: (currentSession as any).refresh_expires_at ?? null,
        };
        deps.applySessionPayload(minimalPayload, { persistTokens: false, reason: 'supabase_refresh_fallback' });
        deps.setAuthStatus('authenticated', 'refreshTokenCallback:refresh_fallback');
        deps.setSessionStatus('authenticated', 'refreshTokenCallback:refresh_fallback');
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
              hadToken: false,
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
