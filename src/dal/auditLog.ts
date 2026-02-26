// DAL facade for audit logging to keep UI contexts from importing services directly.
export { logAuditBestEffort, logAuditAction } from '../services/auditLogService';
export type { AuditAction } from '../services/auditLogService';
