import express from 'express';
import { createCourseManagementService } from '../services/courseManagementService.js';
import { createCourseManagementController } from '../controllers/courseManagementController.js';

export const createCourseManagementRouter = ({
  authenticate,
  requireOrgAdmin,
  logger,
  supabase,
  ensureSupabase,
  isDemoOrTestMode,
  e2eStore,
  persistE2EStore,
  requireUserContext,
  resolveCourseIdentifierToUuid,
  isUuid,
  handleAdminCourseUpsert,
  getCourseOrgId,
  pickOrgId,
  requireOrgAccess,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createCourseManagementService({
    supabase,
    ensureSupabase,
    isDemoOrTestMode,
    e2eStore,
    persistE2EStore,
    requireUserContext,
    resolveCourseIdentifierToUuid,
    isUuid,
    handleAdminCourseUpsert,
    getCourseOrgId,
    pickOrgId,
    requireOrgAccess,
  });
  const controller = createCourseManagementController({ logger, service });

  router.post('/admin/courses', authenticate, requireOrgAdmin, controller.create);
  router.put('/admin/courses/:id', authenticate, requireOrgAdmin, controller.update);
  router.delete('/admin/courses/:id', authenticate, requireOrgAdmin, controller.delete);

  return router;
};

export default createCourseManagementRouter;
