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

type PendingAuditEvent = {
  action: AuditAction;
  details: Record<string, any>;
  timestamp: string;
};

const pendingQueue: PendingAuditEvent[] = [];
let flushing = false;

const enqueue = (event: PendingAuditEvent) => {
  pendingQueue.push(event);
  if (!flushing) {
    void flushQueue();
  }
};

const flushQueue = async (): Promise<void> => {
  if (flushing) return;
  flushing = true;
  try {
    while (pendingQueue.length > 0) {
      const sessionReady = await hasSupabaseSessionToken();
      if (!sessionReady) {
        return;
      }
      const nextEvent = pendingQueue[0];
      try {
        await apiFetch('/audit-log', {
          method: 'POST',
          body: JSON.stringify(nextEvent),
          headers: buildSessionAuditHeaders(),
        });
        pendingQueue.shift();
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.warn('[auditLog] best-effort send failed', error);
        }
        return;
      }
    }
  } finally {
    flushing = false;
  }
};

export function logAuditBestEffort(action: AuditAction, details: Record<string, any> = {}) {
  if (!action || typeof action !== 'string') {
    return;
  }

  enqueue({
    action,
    details,
    timestamp: new Date().toISOString(),
  });
}

// Backwards compatibility
export const logAuditAction = logAuditBestEffort;
