import { clearAdminAccessSnapshot } from '../lib/adminAccess';
import {
  clearActiveOrgPreference,
  clearAuth,
  getRefreshToken,
} from '../lib/secureStorage';
import { clearCanonicalSession } from '../lib/canonicalAuth';
import { getSupabase } from '../lib/supabaseClient';
import apiRequest from '../utils/apiClient';

type LogoutDeps = {
  buildSessionAuditHeaders: () => Record<string, string>;
  enqueueAudit: (entry: { action: string; details?: Record<string, unknown> }) => void;
  setUser: (value: any) => void;
  setMemberships: (value: any[]) => void;
  setOrganizationIds: (value: string[]) => void;
  setActiveOrgIdState: (value: string | null) => void;
  setSessionMetaVersion: (value: (current: number) => number) => void;
  setAuthStatus: (status: 'booting' | 'authenticated' | 'unauthenticated' | 'error', reason?: string) => void;
  setSessionStatus: (status: 'loading' | 'authenticated' | 'unauthenticated', reason?: string) => void;
  setIsAuthenticated: (value: any) => void;
  hasAuthenticatedSessionRef: { current: boolean };
  user: { role?: string | null; email?: string | null; id?: string | null } | null;
};

export const performLogout = async (
  type: 'lms' | 'admin' | undefined,
  deps: LogoutDeps,
): Promise<void> => {
  try {
    const refreshToken = getRefreshToken();
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      headers: deps.buildSessionAuditHeaders(),
    });
  } catch (error) {
    console.warn('[SecureAuth] Logout request failed (continuing with local cleanup)', error);
  } finally {
    try {
      const supabaseClient = getSupabase();
      supabaseClient?.auth.signOut();
    } catch (signOutErr) {
      console.warn('[SecureAuth] supabase.signOut() failed during logout cleanup', signOutErr);
    }
  }

  if (deps.user?.role === 'admin') {
    deps.enqueueAudit({ action: 'admin_logout', details: { email: deps.user.email, id: deps.user.id } });
  }

  clearAuth('manual_logout');
  clearAdminAccessSnapshot();
  // Ensure canonical in-memory session is cleared so no module thinks there's
  // an authenticated session after logout.
  try {
    clearCanonicalSession();
  } catch (e) {
    console.warn('[SecureAuth] clearCanonicalSession failed', e);
  }
  deps.setUser(null);
  deps.setMemberships([]);
  deps.setOrganizationIds([]);
  deps.setActiveOrgIdState(null);
  deps.setSessionMetaVersion((value) => value + 1);
  clearActiveOrgPreference();
  deps.hasAuthenticatedSessionRef.current = false;
  deps.setAuthStatus('unauthenticated', 'logout:manual_logout');
  deps.setSessionStatus('unauthenticated', 'logout:manual_logout');

  if (type) {
    deps.setIsAuthenticated((prev: Record<string, boolean>) => ({
      ...prev,
      [type]: false,
    }));
    return;
  }

  deps.setIsAuthenticated({
    lms: false,
    admin: false,
    client: false,
  });
};
