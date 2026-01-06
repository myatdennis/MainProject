// src/services/auditLogService.ts
// Simple audit logging service for admin actions
import axios from 'axios';
import { resolveApiUrl } from '../config/apiBase';

export type AuditAction = 'admin_login' | 'admin_logout' | 'user_update' | 'role_change' | 'settings_change';

export async function logAuditAction(action: AuditAction, details: Record<string, any> = {}) {
  try {
    await axios.post(
      resolveApiUrl('/api/audit-log'),
      {
        action,
        details,
        timestamp: new Date().toISOString(),
      },
      { withCredentials: true }
    );
  } catch (error) {
    // Log to console for now; in production, consider fallback logging
    console.warn('Audit log failed:', error);
  }
}
