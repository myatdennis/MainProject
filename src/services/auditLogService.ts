// src/services/auditLogService.ts
// Simple audit logging service for admin actions
import { getSupabase } from '../lib/supabaseClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';
import { apiFetch } from '../lib/apiClient';

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
    await apiFetch('/audit-log', {
      method: 'POST',
      body: JSON.stringify({
        action,
        details,
        timestamp: new Date().toISOString(),
      }),
      headers: buildSessionAuditHeaders(),
    }).catch(() => {});
  })();
}

// Backwards compatibility
export const logAuditAction = logAuditBestEffort;
