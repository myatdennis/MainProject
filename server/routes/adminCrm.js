import express from 'express';
import { createAdminCrmService } from '../services/adminCrmService.js';
import { createAdminCrmController } from '../controllers/adminCrmController.js';

export const createAdminCrmRouter = ({ logger, loadCrmSummary, loadCrmActivity }) => {
  const router = express.Router({ mergeParams: true });
  const service = createAdminCrmService({ loadCrmSummary, loadCrmActivity });
  const controller = createAdminCrmController({ logger, service });

  router.get('/summary', controller.summary);
  router.get('/activity', controller.activity);

  return router;
};

export default createAdminCrmRouter;
