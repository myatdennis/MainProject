import { getSupabase, hasSupabaseConfig, SUPABASE_MISSING_CONFIG_MESSAGE } from '../lib/supabaseClient';
import { getUserSession } from '../lib/secureStorage';

export const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  // First, try to get user session from secure storage
  if (typeof window !== 'undefined') {
    try {
      const userSession = getUserSession();
      if (userSession) {
        // Set user authentication headers
        if (userSession.id) {
          headers['X-User-Id'] = String(userSession.id);
        }
        if (userSession.role) {
          headers['X-User-Role'] = String(userSession.role);
        }
        if (userSession.organizationId) {
          headers['X-Org-Id'] = String(userSession.organizationId);
        }

      }
    } catch (error) {
      console.warn('[buildAuthHeaders] Failed to read from secure storage:', error);
    }

    // Fallback: Check localStorage for legacy 'huddle_user' (migration support)
    if (!headers['X-User-Id'] && 'localStorage' in window) {
      try {
        const stored = window.localStorage.getItem('huddle_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Provide a stable demo-mode user id when Supabase isn't configured
          if (parsed?.id || parsed?.email) {
            headers['X-User-Id'] = String(parsed.id || parsed.email).toLowerCase();
          }
          if (parsed?.role) {
            headers['X-User-Role'] = String(parsed.role);
          }
          if (parsed?.activeOrgId) {
            headers['X-Org-Id'] = String(parsed.activeOrgId);
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // Check for organization override in localStorage
    if ('localStorage' in window) {
      try {
        const storedOrg = window.localStorage.getItem('huddle_active_org');
        if (storedOrg && !headers['X-Org-Id']) {
          headers['X-Org-Id'] = storedOrg;
        }
      } catch {
        // ignore
      }
    }
  }

  if (hasSupabaseConfig) {
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const userId = data?.session?.user?.id;
        if (userId) {
          headers['X-User-Id'] = userId;
        }
      } else {
        console.log('[buildAuthHeaders] Supabase configured but client not available');
      }
    } catch (error) {
      console.warn('[buildAuthHeaders] Failed to resolve Supabase session:', error);
    }
  }

  if (!hasSupabaseConfig) {
    headers['X-Supabase-Disabled'] = 'true';
    headers['X-Supabase-Reason'] = SUPABASE_MISSING_CONFIG_MESSAGE;
  }

  return headers;
};

export default buildAuthHeaders;
