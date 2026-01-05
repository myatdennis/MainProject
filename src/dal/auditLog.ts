// DAL facade for audit logging to keep UI contexts from importing services directly.
export { logAuditAction } from '../services/auditLogService';
export type { AuditAction } from '../services/auditLogService';
