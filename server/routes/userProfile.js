import express from 'express';
import { createUserProfileController } from '../controllers/userProfileController.js';

export const createUserProfileRouter = (deps) => {
  const router = express.Router();
  const controller = createUserProfileController(deps);

  router.get('/me', controller.getCurrentUserProfile);
  router.put('/me', controller.updateCurrentUserProfile);

  return router;
};
