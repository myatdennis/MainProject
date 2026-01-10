import { getSupabase, hasSupabaseConfig, SUPABASE_MISSING_CONFIG_MESSAGE } from '../lib/supabaseClient';
import { getUserSession, getActiveOrgPreference } from '../lib/secureStorage';

export const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  // First, try to get user session from secure storage
  if (typeof window !== 'undefined') {
    try {
      const userSession = getUserSession();
      if (userSession) {
        if (userSession.id) {
          headers['X-User-Id'] = String(userSession.id);
        }
        if (userSession.role) {
          headers['X-User-Role'] = String(userSession.role);
        }
        const preferredOrgId = userSession.activeOrgId || userSession.organizationId || getActiveOrgPreference();
        if (preferredOrgId) {
          headers['X-Org-Id'] = String(preferredOrgId);
        }
      } else {
        const fallbackOrg = getActiveOrgPreference();
        if (fallbackOrg) {
          headers['X-Org-Id'] = String(fallbackOrg);
        }
      }
    } catch (error) {
      console.warn('[buildAuthHeaders] Failed to read from secure storage:', error);
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
