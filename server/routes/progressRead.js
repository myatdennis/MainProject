import express from 'express';
import { createProgressReadService } from '../services/progressReadService.js';
import { createProgressReadController } from '../controllers/progressReadController.js';

export const createProgressReadRouter = (deps) => {
  const router = express.Router({ mergeParams: true });
  const service = createProgressReadService(deps);
  const controller = createProgressReadController({ logger: deps.logger, service });

  router.get('/learner/progress', controller.learnerProgress);
  router.get('/client/progress/summary', controller.clientSummary);

  return router;
};

export default createProgressReadRouter;
