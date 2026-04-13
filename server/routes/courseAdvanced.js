import express from 'express';
import { createCourseAdvancedService } from '../services/courseAdvancedService.js';
import { createCourseAdvancedController } from '../controllers/courseAdvancedController.js';

export const createCourseAdvancedRouter = ({
  authenticate,
  requireOrgAdmin,
  logger,
  ...deps
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createCourseAdvancedService(deps);
  const controller = createCourseAdvancedController({ logger, service });

  router.post('/admin/courses/import', authenticate, requireOrgAdmin, controller.importCourses);
  router.post('/admin/courses/:id/publish', authenticate, controller.publishCourse);

  return router;
};

export default createCourseAdvancedRouter;
