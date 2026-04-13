import express from 'express';
import { createClientPortalController } from '../controllers/clientPortalController.js';

export const createClientPortalRouter = (deps) => {
  const router = express.Router();
  const controller = createClientPortalController(deps);
  const { authenticate } = deps;

  router.get('/client/me', authenticate, controller.getClientMe);
  router.get('/client/activity', authenticate, controller.getClientActivity);

  return router;
};

