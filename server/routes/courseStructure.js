import express from 'express';
import { createCourseStructureService } from '../services/courseStructureService.js';
import { createCourseStructureController } from '../controllers/courseStructureController.js';

export const createCourseStructureRouter = ({
  authenticate,
  requireOrgAdmin,
  logger,
  ...deps
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createCourseStructureService({ logger, ...deps });
  const controller = createCourseStructureController({ logger, service });

  router.post('/admin/modules', authenticate, requireOrgAdmin, controller.createModule);
  router.patch('/admin/modules/:id', authenticate, requireOrgAdmin, controller.updateModule);
  router.delete('/admin/modules/:id', authenticate, requireOrgAdmin, controller.deleteModule);
  router.post('/admin/modules/reorder', authenticate, requireOrgAdmin, controller.reorderModules);

  router.post('/admin/lessons', authenticate, requireOrgAdmin, controller.createLesson);
  router.patch('/admin/lessons/:id', authenticate, requireOrgAdmin, controller.updateLesson);
  router.delete('/admin/lessons/:id', authenticate, requireOrgAdmin, controller.deleteLesson);
  router.post('/admin/lessons/reorder', authenticate, requireOrgAdmin, controller.reorderLessons);

  return router;
};

export default createCourseStructureRouter;
