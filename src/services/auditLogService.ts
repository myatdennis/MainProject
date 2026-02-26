// src/services/auditLogService.ts
// Simple audit logging service for admin actions
import apiRequest from '../utils/apiClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';
import { getSupabase } from '../lib/supabaseClient';

export type AuditAction = 'admin_login' | 'admin_logout' | 'user_update' | 'role_change' | 'settings_change';

const hasSupabaseSessionToken = async (): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { data, error } = await supabase.auth.getSession();
    if (error) return false;
    return Boolean(data?.session?.access_token);
  } catch {
    return false;
  }
};

export function logAuditBestEffort(action: AuditAction, details: Record<string, any> = {}) {
  if (!action || typeof action !== 'string') {
    return;
  }

  void (async () => {
    const sessionReady = await hasSupabaseSessionToken();
    if (!sessionReady) {
      return;
    }
    await apiRequest('/api/audit-log', {
      method: 'POST',
      body: {
        action,
        details,
        timestamp: new Date().toISOString(),
      },
      headers: buildSessionAuditHeaders(),
      allowAnonymous: false,
      timeoutMs: 4000,
    }).catch(() => {});
  })();
}

// Backwards compatibility
export const logAuditAction = logAuditBestEffort;
