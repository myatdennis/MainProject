import express from 'express';
import { createLearnerNotificationsService } from '../services/learnerNotificationsService.js';
import { createLearnerNotificationsController } from '../controllers/learnerNotificationsController.js';

export const createLearnerNotificationsRouter = ({
  logger,
  supabase,
  notificationService,
  broadcastToTopic,
  ENABLE_NOTIFICATIONS,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  normalizeOrgIdValue,
  clampNumber,
  runNotificationQuery,
  mapNotificationRecord,
  isNotificationsTableMissingError,
  logNotificationsMissingTable,
  isMissingColumnError,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createLearnerNotificationsService({
    logger,
    supabase,
    notificationService,
    broadcastToTopic,
    ENABLE_NOTIFICATIONS,
    isDemoOrTestMode,
    ensureSupabase,
    requireUserContext,
    requireOrgAccess,
    normalizeOrgIdValue,
    clampNumber,
    runNotificationQuery,
    mapNotificationRecord,
    isNotificationsTableMissingError,
    logNotificationsMissingTable,
    isMissingColumnError,
  });
  const controller = createLearnerNotificationsController({ logger, service });

  router.get('/', controller.list);
  router.post('/:id/read', controller.markRead);
  router.delete('/:id', controller.delete);

  return router;
};

export default createLearnerNotificationsRouter;
