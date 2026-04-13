import express from 'express';
import { createProgressWriteService } from '../services/progressWriteService.js';
import { createProgressWriteController } from '../controllers/progressWriteController.js';

export const createProgressWriteRouter = (deps) => {
  const router = express.Router({ mergeParams: true });
  const service = createProgressWriteService(deps);
  const controller = createProgressWriteController({ logger: deps.logger, service });

  router.post('/learner/progress', controller.learnerSnapshot);
  router.post('/client/progress/course', controller.clientCourse);
  router.post('/client/progress/lesson', controller.clientLesson);
  router.post('/client/progress/batch', controller.clientBatch);

  return router;
};

export default createProgressWriteRouter;
