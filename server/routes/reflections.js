import express from 'express';
import { createReflectionsService } from '../services/reflectionsService.js';
import { createReflectionsController } from '../controllers/reflectionsController.js';

export const createReflectionsRouter = (deps) => {
  const router = express.Router({ mergeParams: true });
  const service = createReflectionsService(deps);
  const controller = createReflectionsController({ logger: deps.logger, service });

  router.get('/learner/reflections', controller.learnerGet);
  router.get('/learner/lessons/:lessonId/reflection', controller.learnerGet);
  router.post('/learner/reflections', controller.learnerSave);
  router.post('/learner/lessons/:lessonId/reflection', controller.learnerSave);
  router.get('/admin/reflections', controller.adminLessonList);
  router.get('/admin/lessons/:lessonId/reflections', controller.adminLessonList);
  router.get('/admin/courses/:courseId/reflections', controller.adminCourseList);

  return router;
};

export default createReflectionsRouter;
