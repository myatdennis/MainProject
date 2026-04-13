import express from 'express';
import { createAdminNotificationsService } from '../services/adminNotificationsService.js';
import { createAdminNotificationsController } from '../controllers/adminNotificationsController.js';

export const createAdminNotificationsRouter = ({
  logger,
  supabase,
  notificationService,
  ENABLE_NOTIFICATIONS,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  normalizeOrgIdValue,
  parsePaginationParams,
  sanitizeIlike,
  mapNotificationRecord,
  buildDisabledNotificationsResponse,
  isNotificationsTableMissingError,
  logNotificationsMissingTable,
  parseFlag,
  coerceIdArray,
}) => {
  const router = express.Router({ mergeParams: true });

  const service = createAdminNotificationsService({
    logger,
    supabase,
    notificationService,
    ENABLE_NOTIFICATIONS,
    isDemoOrTestMode,
    ensureSupabase,
    requireUserContext,
    requireOrgAccess,
    normalizeOrgIdValue,
    parsePaginationParams,
    sanitizeIlike,
    mapNotificationRecord,
    buildDisabledNotificationsResponse,
    isNotificationsTableMissingError,
    logNotificationsMissingTable,
    parseFlag,
    coerceIdArray,
  });

  const controller = createAdminNotificationsController({ logger, service });

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/broadcast', controller.broadcast);
  router.post('/:id/read', controller.markRead);
  router.delete('/:id', controller.delete);

  return router;
};

export default createAdminNotificationsRouter;
