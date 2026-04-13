import express from 'express';
import { createAuditLogService } from '../services/auditLogService.js';
import { createAuditLogController } from '../controllers/auditLogController.js';

export const createAuditLogRouter = ({
  logger,
  supabase,
  e2eStore,
  persistE2EStore,
  isDemoOrTestMode,
  normalizeOrgIdValue,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createAuditLogService({
    logger,
    supabase,
    e2eStore,
    persistE2EStore,
    isDemoOrTestMode,
    normalizeOrgIdValue,
  });
  const controller = createAuditLogController({ logger, service });

  router.post('/', controller.record);

  return router;
};

export default createAuditLogRouter;
