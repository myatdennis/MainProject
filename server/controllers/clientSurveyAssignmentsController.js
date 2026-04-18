import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createClientSurveyAssignmentsController = ({
  logger,
  service,
  requireUserContext,
  resolveOrgScopeFromRequest,
}) => {
  return {
    listAssigned: async (req, res) => {
      console.info('[SURVEYS_ASSIGNED_DEPLOY_MARKER_V3]', {
        route: '/api/client/surveys/assigned',
        ts: new Date().toISOString(),
      });
      // Diagnostic marker: inserted to prove this handler version is deployed.
      // DO NOT remove — used by prod log grep to confirm deployed revision.
      console.info('[SURVEYS_ASSIGNED_ROUTE_REACHED_V2]', {
        route: '/api/client/surveys/assigned',
        ts: new Date().toISOString(),
      });
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
        // Log invocation context for this route in a structured way so failures
        // are clearly attributable to the exact request and caller.
        logger.info('client_assigned_surveys_invoke', {
          requestId: req.requestId ?? null,
          route: '/api/client/surveys/assigned',
          userId: context.userId,
          userRole: context.userRole ?? null,
          platformRole: context.platformRole ?? null,
          isPlatformAdmin: Boolean(context.isPlatformAdmin),
          activeOrgId: context.activeOrganizationId ?? null,
          scopedOrgIds: scopedOrgIds ?? [],
          includeCompleted: Boolean(includeCompleted),
        });

        const result = await service.listAssigned({
          context,
          orgScope,
          scopedOrgIds,
          includeCompleted,
          requestId: req.requestId ?? null,
        });
        return sendOk(res, result.data, { meta: result.meta });
      } catch (error) {
        // Rich error logging: include request and user context, exact failing step if available,
        // and the server-side stack. This makes it impossible for this route to return 500
        // without a clear labeled cause in the logs.
        logger.error('client_assigned_surveys_failed', {
          requestId: req.requestId ?? null,
          route: '/api/client/surveys/assigned',
          userId: context.userId,
          userRole: context.userRole ?? null,
          platformRole: context.platformRole ?? null,
          isPlatformAdmin: Boolean(context.isPlatformAdmin),
          memberships: Array.isArray(context.memberships) ? context.memberships.length : null,
          organizationIds: Array.isArray(context.organizationIds) ? context.organizationIds : null,
          activeOrgId: context.activeOrganizationId ?? null,
          scopedOrgIds: scopedOrgIds ?? [],
          includeCompleted: Boolean(includeCompleted),
          // If the service annotated the error with a step/label (e.g. 'survey.assigned.load_assignments')
          // include it to make the root cause explicit.
          failingStep: error?.label ?? error?.step ?? null,
          code: error?.code ?? null,
          message: error?.message ?? String(error),
          // Stack is server-side only — useful to pinpoint the exact throw site.
          stack: error?.stack ?? null,
        });

        // Fail fast for DB/service availability issues with a clear 503 envelope
        const isServiceUnavailable =
          error?.statusCode === 503 ||
          String(error?.code || '').toUpperCase() === 'DATABASE_UNAVAILABLE' ||
          String(error?.code || '').toUpperCase() === 'SUPABASE_TIMEOUT';
        if (isServiceUnavailable) {
          return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Survey service temporarily unavailable');
        }

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
