import express from 'express';
import { createWorkspaceRepository } from '../repositories/workspaceRepository.js';
import { createWorkspaceService } from '../services/workspaceService.js';
import { createWorkspaceController } from '../controllers/workspaceController.js';

export const createWorkspaceRouter = ({ supabase, logger, requireOrgAccess, ensureSupabase }) => {
  const router = express.Router({ mergeParams: true });
  const repository = createWorkspaceRepository({ supabase });
  const service = createWorkspaceService({ repository });
  const controller = createWorkspaceController({
    logger,
    service,
    requireOrgAccess,
    ensureSupabase,
  });

  router.get('/access', controller.getAccess);
  router.get('/', controller.getWorkspace);

  router.get('/strategic-plans', controller.listStrategicPlans);
  router.get('/strategic-plans/:id', controller.getStrategicPlan);
  router.post('/strategic-plans', controller.createStrategicPlan);
  router.delete('/strategic-plans/:id', controller.deleteStrategicPlan);

  router.get('/session-notes', controller.listSessionNotes);
  router.post('/session-notes', controller.createSessionNote);

  router.get('/action-items', controller.listActionItems);
  router.post('/action-items', controller.createActionItem);
  router.put('/action-items/:id', controller.updateActionItem);
  router.delete('/action-items/:id', controller.deleteActionItem);

  return router;
};

export default createWorkspaceRouter;
