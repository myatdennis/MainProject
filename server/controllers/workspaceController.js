import { sendError, sendOk } from '../lib/apiEnvelope.js';
import {
  validateActionItemCreate,
  validateActionItemUpdate,
  validateSessionNoteCreate,
  validateStrategicPlanCreate,
} from '../validators/workspace.js';

const logRequest = (logger, event, meta) => {
  logger.info(event, meta);
};

const handleControllerError = (logger, res, event, error, fallbackMessage, details = undefined) => {
  logger.error(event, {
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    details,
  });
  return sendError(res, 500, error?.code || 'workspace_error', fallbackMessage, details);
};

export const createWorkspaceController = ({ logger, service, requireOrgAccess, ensureSupabase }) => {
  const withAccess = async (req, res, options = {}) => {
    if (!ensureSupabase(res)) return null;
    const { orgId } = req.params;
    const access = await requireOrgAccess(req, res, orgId, options);
    if (!access) return null;
    return { orgId, access };
  };

  return {
    getAccess: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      logRequest(logger, 'workspace.access.request', { requestId: req.requestId ?? null, orgId: scoped.orgId });
      const data = await service.getAccessEnvelope(scoped.orgId, scoped.access);
      logger.info('workspace.access.response', {
        requestId: req.requestId ?? null,
        orgId: scoped.orgId,
        role: data.role,
      });
      return sendOk(res, data);
    },

    getWorkspace: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      logRequest(logger, 'workspace.bundle.request', { requestId: req.requestId ?? null, orgId: scoped.orgId });
      try {
        const data = await service.getWorkspace(scoped.orgId);
        logger.info('workspace.bundle.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          strategicPlanCount: data.strategicPlans.length,
          sessionNoteCount: data.sessionNotes.length,
          actionItemCount: data.actionItems.length,
        });
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.bundle.error', error, 'Unable to load organization workspace');
      }
    },

    listStrategicPlans: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      try {
        const data = await service.listStrategicPlans(scoped.orgId);
        logger.info('workspace.strategic_plans.list.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          count: data.length,
        });
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.strategic_plans.list.error', error, 'Unable to fetch strategic plans');
      }
    },

    getStrategicPlan: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      try {
        const data = await service.getStrategicPlan(scoped.orgId, req.params.id);
        if (!data) {
          return sendError(res, 404, 'strategic_plan_not_found', 'Strategic plan version not found');
        }
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.strategic_plans.get.error', error, 'Unable to fetch strategic plan version');
      }
    },

    createStrategicPlan: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      const validation = validateStrategicPlanCreate(req.body || {});
      if (!validation.ok) {
        return sendError(res, 400, validation.code, validation.message);
      }
      logRequest(logger, 'workspace.strategic_plans.create.request', {
        requestId: req.requestId ?? null,
        orgId: scoped.orgId,
        payload: {
          hasContent: Boolean(validation.value.content),
          createdBy: validation.value.createdBy,
          metadataKeys: Object.keys(validation.value.metadata ?? {}),
        },
      });
      try {
        const data = await service.createStrategicPlan(scoped.orgId, validation.value);
        logger.info('workspace.strategic_plans.create.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          planId: data.id,
        });
        return sendOk(res, data, { status: 201 });
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.strategic_plans.create.error', error, 'Unable to create strategic plan version');
      }
    },

    deleteStrategicPlan: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      try {
        await service.deleteStrategicPlan(scoped.orgId, req.params.id);
        logger.info('workspace.strategic_plans.delete.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          planId: req.params.id,
          deleted: true,
        });
        return sendOk(res, { deleted: true, id: req.params.id });
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.strategic_plans.delete.error', error, 'Unable to delete strategic plan version');
      }
    },

    listSessionNotes: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      try {
        const data = await service.listSessionNotes(scoped.orgId);
        logger.info('workspace.session_notes.list.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          count: data.length,
        });
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.session_notes.list.error', error, 'Unable to fetch session notes');
      }
    },

    createSessionNote: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      const validation = validateSessionNoteCreate(req.body || {});
      if (!validation.ok) {
        return sendError(res, 400, validation.code, validation.message);
      }
      logRequest(logger, 'workspace.session_notes.create.request', {
        requestId: req.requestId ?? null,
        orgId: scoped.orgId,
        payload: {
          title: validation.value.title,
          tagCount: validation.value.tags.length,
          attachmentCount: validation.value.attachments.length,
          createdBy: validation.value.createdBy,
        },
      });
      try {
        const data = await service.createSessionNote(scoped.orgId, validation.value);
        logger.info('workspace.session_notes.create.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          noteId: data.id,
        });
        return sendOk(res, data, { status: 201 });
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.session_notes.create.error', error, 'Unable to create session note');
      }
    },

    listActionItems: async (req, res) => {
      const scoped = await withAccess(req, res);
      if (!scoped) return;
      try {
        const data = await service.listActionItems(scoped.orgId);
        logger.info('workspace.action_items.list.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          count: data.length,
        });
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.action_items.list.error', error, 'Unable to fetch action items');
      }
    },

    createActionItem: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      const validation = validateActionItemCreate(req.body || {});
      if (!validation.ok) {
        return sendError(res, 400, validation.code, validation.message);
      }
      logRequest(logger, 'workspace.action_items.create.request', {
        requestId: req.requestId ?? null,
        orgId: scoped.orgId,
        payload: validation.value,
      });
      try {
        const data = await service.createActionItem(scoped.orgId, validation.value);
        logger.info('workspace.action_items.create.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          actionItemId: data.id,
          status: data.status,
        });
        return sendOk(res, data, { status: 201 });
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.action_items.create.error', error, 'Unable to create action item');
      }
    },

    updateActionItem: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      const validation = validateActionItemUpdate(req.body || {});
      if (!validation.ok) {
        return sendError(res, 400, validation.code, validation.message);
      }
      logRequest(logger, 'workspace.action_items.update.request', {
        requestId: req.requestId ?? null,
        orgId: scoped.orgId,
        actionItemId: req.params.id,
        payload: validation.value,
      });
      try {
        const data = await service.updateActionItem(scoped.orgId, req.params.id, validation.value);
        if (!data) {
          return sendError(res, 404, 'action_item_not_found', 'Action item not found');
        }
        logger.info('workspace.action_items.update.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          actionItemId: data.id,
          status: data.status,
        });
        return sendOk(res, data);
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.action_items.update.error', error, 'Unable to update action item');
      }
    },

    deleteActionItem: async (req, res) => {
      const scoped = await withAccess(req, res, { write: true });
      if (!scoped) return;
      try {
        await service.deleteActionItem(scoped.orgId, req.params.id);
        logger.info('workspace.action_items.delete.response', {
          requestId: req.requestId ?? null,
          orgId: scoped.orgId,
          actionItemId: req.params.id,
          deleted: true,
        });
        return sendOk(res, { deleted: true, id: req.params.id });
      } catch (error) {
        return handleControllerError(logger, res, 'workspace.action_items.delete.error', error, 'Unable to delete action item');
      }
    },
  };
};

export default createWorkspaceController;
