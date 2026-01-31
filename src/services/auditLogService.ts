// src/services/auditLogService.ts
// Simple audit logging service for admin actions
import apiRequest from '../utils/apiClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';

export type AuditAction = 'admin_login' | 'admin_logout' | 'user_update' | 'role_change' | 'settings_change';

export function logAuditAction(action: AuditAction, details: Record<string, any> = {}) {
  void apiRequest('/api/audit-log', {
    method: 'POST',
    body: {
      action,
      details,
      timestamp: new Date().toISOString(),
    },
    headers: buildSessionAuditHeaders(),
    allowAnonymous: false,
    timeoutMs: 4000,
  }).catch((error) => {
    if (import.meta.env?.DEV) {
      console.warn('Audit log failed:', error);
    }
  });
}
