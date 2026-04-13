export const createAuditLogService = ({
  logger,
  supabase,
  e2eStore,
  persistE2EStore,
  isDemoOrTestMode,
  normalizeOrgIdValue,
} = {}) => ({
  record: async ({ req, res }) => {
    const { action, details = {}, timestamp, userId, user_id, orgId, org_id } = req.body || {};
    const sessionUser = req.user || req.supabaseJwtUser || null;
    if (!sessionUser) {
      logger.info('audit_log_missing_authenticated_user', {
        requestId: req.requestId ?? null,
        bodyUserId: userId || user_id || null,
        bodyOrgId: orgId || org_id || null,
      });
    }
    const sessionUserId = sessionUser?.userId || sessionUser?.id || userId || user_id || null;
    const normalizedAction = typeof action === 'string' ? action.trim() : '';
    if (!normalizedAction) {
      return {
        status: 400,
        error: { code: 'validation_failed', message: 'Action is required.' },
        meta: { requestId: req.requestId ?? null },
      };
    }

    const normalizedOrgId = normalizeOrgIdValue(orgId ?? org_id ?? null);
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action: normalizedAction,
      details,
      user_id: sessionUserId ?? userId ?? user_id ?? null,
      organization_id: normalizedOrgId ?? null,
      org_id: normalizedOrgId ?? null,
      timestamp: timestamp || new Date().toISOString(),
    };

    if (isDemoOrTestMode) {
      e2eStore.auditLogs.unshift(entry);
      if (e2eStore.auditLogs.length > 500) e2eStore.auditLogs.length = 500;
      persistE2EStore?.();
      return {
        status: 200,
        data: { stored: true, entry },
        code: 'audit_log_recorded',
        message: 'Audit log request processed.',
        meta: { requestId: req.requestId ?? null, demo: true },
      };
    }

    if (!supabase) {
      logger.warn('audit_log_supabase_unavailable', { requestId: req.requestId ?? null });
      return {
        status: 200,
        data: { stored: false, reason: 'supabase_disabled' },
        code: 'audit_log_recorded',
        message: 'Audit log request processed.',
        meta: { requestId: req.requestId ?? null },
      };
    }

    try {
      const { error } = await supabase.from('audit_logs').insert({
        action: entry.action,
        details: entry.details,
        user_id: entry.user_id,
        organization_id: entry.organization_id ?? null,
        created_at: entry.timestamp,
      });
      if (error) throw error;

      return {
        status: 200,
        data: { stored: true },
        code: 'audit_log_recorded',
        message: 'Audit log request processed.',
        meta: { requestId: req.requestId ?? null },
      };
    } catch (error) {
      logger.error('audit_log_persist_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return {
        status: 200,
        data: {
          stored: false,
          reason: error?.code || 'persistence_failed',
          errorCode: error?.code || null,
          message: error?.message || null,
        },
        code: 'audit_log_recorded',
        message: 'Audit log request processed.',
        meta: { requestId: req.requestId ?? null },
      };
    }
  },
});

export default createAuditLogService;
