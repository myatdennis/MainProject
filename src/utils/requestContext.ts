import { supabase, hasSupabaseConfig } from '../lib/supabase';

export const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      const stored = window.localStorage.getItem('huddle_user');
      if (stored) {
        const parsed = JSON.parse(stored);
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
    try {
      const storedOrg = window.localStorage.getItem('huddle_active_org');
      if (storedOrg && !headers['X-Org-Id']) {
        headers['X-Org-Id'] = storedOrg;
      }
    } catch {
      // ignore
    }
  }

  if (hasSupabaseConfig) {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (userId) {
        headers['X-User-Id'] = userId;
      }
      const accessToken = data?.session?.access_token;
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch (error) {
      console.warn('[buildAuthHeaders] Failed to resolve Supabase session:', error);
    }
  }

  return headers;
};

export default buildAuthHeaders;
