// src/services/auditLogService.ts
// Simple audit logging service for admin actions
import axios from 'axios';
import { resolveApiUrl } from '../config/apiBase';

export type AuditAction = 'admin_login' | 'admin_logout' | 'user_update' | 'role_change' | 'settings_change';

export function logAuditAction(action: AuditAction, details: Record<string, any> = {}) {
  axios
    .post(
      resolveApiUrl('/api/audit-log'),
      {
        action,
        details,
        timestamp: new Date().toISOString(),
      },
      { withCredentials: true },
    )
    .catch((error) => {
      console.warn('Audit log failed:', error);
    });
}
