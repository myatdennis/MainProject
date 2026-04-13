import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createClientSurveyAssignmentsController = ({
  logger,
  service,
  requireUserContext,
  resolveOrgScopeFromRequest,
}) => {
  return {
    listAssigned: async (req, res) => {
      const context = requireUserContext(req, res);
      if (!context) return;

      const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
      const scopedOrgIds = orgScope.orgId
        ? [orgScope.orgId]
        : Array.isArray(context.organizationIds)
          ? context.organizationIds
          : [];

      if (orgScope.requiresExplicitSelection) {
        logger.warn('client_assigned_surveys_org_selection_ambiguous', {
          requestId: req.requestId ?? null,
          userId: context.userId,
          orgIdCount: scopedOrgIds.length,
        });
        return sendError(res, 400, 'explicit_org_selection_required', 'Select an organization to load assigned surveys.');
      }

      if (!context.isPlatformAdmin && scopedOrgIds.length === 0) {
        return sendError(res, 403, 'org_membership_required', 'Organization membership is required to load assigned surveys.');
      }

      const includeCompleted = service.parseBoolean(req.query.include_completed ?? req.query.includeCompleted, true);

      try {
        const result = await service.listAssigned({
          context,
          orgScope,
          scopedOrgIds,
          includeCompleted,
          requestId: req.requestId ?? null,
        });
        return sendOk(res, result.data, { meta: result.meta });
      } catch (error) {
        logger.error('client_assigned_surveys_failed', {
          requestId: req.requestId ?? null,
          userId: context.userId,
          code: error?.code ?? null,
          message: error?.message ?? null,
        });
        return sendError(
          res,
          error?.statusCode ?? 500,
          error?.code ?? 'client_assigned_surveys_failed',
          error?.userMessage ?? error?.message ?? 'Unable to load assigned surveys',
        );
      }
    },
  };
};

export default createClientSurveyAssignmentsController;
