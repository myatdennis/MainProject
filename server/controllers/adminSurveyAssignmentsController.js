import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAdminSurveyAssignmentsController = ({
  logger,
  service,
  ensureSupabase,
  ensureAdminSurveySchemaOrRespond,
  loadSurveyWithAssignments,
  rememberSurveyIdentifierAlias,
  resolveSurveyIdentifierToCanonicalId,
  normalizeLegacyOrgInput,
  normalizeAssignmentUserIds,
  deriveSurveyAssignmentOrgScope,
  requireUserContext,
  normalizeOrgIdValue,
  pickOrgId,
  clampNumber,
  surveyAssignmentSelect,
  getAssignmentsOrgColumnName,
}) => {
  return {
    assign: async (req, res) => {
      if (!ensureSupabase(res)) return;
      if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assign'))) return;

      const { id } = req.params;
      let surveyRecord;
      try {
        surveyRecord = await loadSurveyWithAssignments(id);
      } catch (error) {
        const invalidSurveyId =
          error?.code === '22P02' ||
          (typeof error?.message === 'string' && error.message.includes('invalid input syntax for type uuid'));
        if (invalidSurveyId) {
          return sendError(
            res,
            400,
            'invalid_survey_id',
            `Survey identifier ${id} is not valid for this environment. Refresh surveys and retry.`,
          );
        }
        throw error;
      }

      if (!surveyRecord) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'survey_not_found';
        return sendError(res, 404, 'survey_not_found', `Survey not found for identifier ${id}`);
      }

      const surveyId = surveyRecord.id ?? id;
      rememberSurveyIdentifierAlias(id, surveyId);
      const body = normalizeLegacyOrgInput(req.body ?? {}, {
        surface: 'admin.surveys.assign',
        requestId: req.requestId ?? null,
      });
      const hasBodyKey = (key) => Object.prototype.hasOwnProperty.call(body, key);
      const rawOrgInput = body.organization_ids ?? body.organizationIds ?? body.organizations ?? body.orgIds;
      const organizationIds = Array.isArray(rawOrgInput)
        ? rawOrgInput.map((value) => String(value || '').trim()).filter(Boolean)
        : [];

      const rawUserIds = Array.isArray(body.user_ids)
        ? body.user_ids
        : Array.isArray(body.userIds)
          ? body.userIds
          : [];
      const { normalizedUserIds, invalidTargetIds } = normalizeAssignmentUserIds(rawUserIds);

      if (!organizationIds.length) {
        const singleOrg = body.organization_id ?? body.organizationId ?? null;
        if (singleOrg) organizationIds.push(String(singleOrg).trim());
      }

      const context = requireUserContext(req, res);
      if (!context) return;

      if (!organizationIds.length && normalizedUserIds.length > 0) {
        let derivedScope = null;
        if (service.supabaseAvailable) {
          try {
            const membershipRows = await service.loadMembershipRows(normalizedUserIds);
            derivedScope = deriveSurveyAssignmentOrgScope({
              normalizedUserIds,
              membershipRows,
            });
          } catch (deriveOrgError) {
            logger.warn('survey_assignment_org_derivation_failed', {
              requestId: req.requestId ?? null,
              surveyId,
              message: deriveOrgError?.message ?? String(deriveOrgError),
            });
          }
        }

        if (derivedScope?.ok) {
          organizationIds.push(...(derivedScope.organizationIds || []));
        } else {
          const fallbackOrgIds = Array.from(
            new Set([
              ...(Array.isArray(context.organizationIds)
                ? context.organizationIds.map((orgId) => normalizeOrgIdValue(orgId)).filter(Boolean)
                : []),
              ...(Array.isArray(context.memberships)
                ? context.memberships
                    .map((membership) =>
                      normalizeOrgIdValue(
                        pickOrgId(
                          membership.organization_id,
                          membership.organizationId,
                          membership.org_id,
                          membership.orgId,
                        ),
                      ),
                    )
                    .filter(Boolean)
                : []),
            ].filter(Boolean)),
          );
          if (fallbackOrgIds.length === 1) {
            organizationIds.push(fallbackOrgIds[0]);
            logger.warn('[survey] assign_target_resolution_context_fallback', {
              requestId: req.requestId ?? null,
              surveyId,
              organizationIds: fallbackOrgIds,
              userIdCount: normalizedUserIds.length,
              derivedError: derivedScope?.code || null,
              derivedMeta: derivedScope?.meta ?? null,
            });
          } else {
            return sendError(
              res,
              400,
              derivedScope?.code || 'organization_scope_required',
              derivedScope?.message ||
                'Unable to resolve organization scope from user memberships. Provide organizationIds explicitly.',
              derivedScope?.meta ?? null,
            );
          }
        }
        logger.info('[survey] assign_target_resolution', {
          requestId: req.requestId ?? null,
          surveyId,
          organizationIdCount: organizationIds.length,
          userIdCount: normalizedUserIds.length,
        });
      }

      if (!organizationIds.length) {
        return sendError(res, 400, 'organization_id_required', 'Provide at least one organization id.');
      }

      logger.info('[survey] assign_request', {
        requestId: req.requestId ?? null,
        surveyId,
        userId: context.userId,
        rawOrganizationIdCount: organizationIds.length,
        rawUserIdCount: normalizedUserIds.length,
      });

      if (!context.isPlatformAdmin && organizationIds.length > 0) {
        const membershipOrgIds = (Array.isArray(context.memberships) ? context.memberships : [])
          .map((row) => normalizeOrgIdValue(pickOrgId(row.orgId, row.organizationId, row.organization_id, row.org_id)))
          .filter(Boolean)
          .map((value) => String(value));
        const scopedOrgIds = new Set([
          ...membershipOrgIds,
          ...(Array.isArray(context.organizationIds)
            ? context.organizationIds.map((value) => normalizeOrgIdValue(value)).filter(Boolean).map((value) => String(value))
            : []),
        ]);
        const deniedOrgIds = organizationIds
          .map((value) => normalizeOrgIdValue(value))
          .filter(Boolean)
          .filter((value) => !scopedOrgIds.has(String(value)));
        if (deniedOrgIds.length > 0) {
          return sendError(res, 403, 'org_access_denied', 'You do not have admin access to one or more requested organizations.');
        }
      }

      const dueProvided = hasBodyKey('due_at') || hasBodyKey('dueAt');
      const noteProvided = hasBodyKey('note');
      const dueAtValue = dueProvided ? (body.due_at ?? body.dueAt ?? null) : undefined;
      const noteValue =
        noteProvided && typeof body.note === 'string'
          ? body.note
          : noteProvided && body.note === null
            ? null
            : undefined;
      const assignedByRaw = body.assigned_by ?? body.assignedBy;
      const assignedBy =
        typeof assignedByRaw === 'string' && assignedByRaw.trim().length > 0 ? assignedByRaw.trim() : context.userId;
      const allowedStatuses = new Set(['assigned', 'in-progress', 'completed']);
      const statusProvided = typeof body.status === 'string';
      const requestedStatus = statusProvided ? String(body.status).toLowerCase() : '';
      const statusValue = allowedStatuses.has(requestedStatus) ? requestedStatus : 'assigned';
      const metadataInput = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};
      let metadata = {};
      try {
        metadata = JSON.parse(JSON.stringify(metadataInput));
      } catch {
        metadata = {};
      }
      metadata = {
        ...metadata,
        assigned_via: metadata.assigned_via ?? 'admin_survey_api',
        request_user: context.userId,
        request_ip: req.ip,
        surface: 'admin.surveys.assign',
        assignment_audit: {
          created_by: context.userId,
          created_at: new Date().toISOString(),
          source: 'admin.surveys.assign',
        },
      };

      try {
        const result = await service.assignSurvey({
          req,
          res,
          surveyId,
          organizationIds,
          normalizedUserIds,
          invalidTargetIds,
          dueProvided,
          dueAtValue,
          noteProvided,
          noteValue,
          statusProvided,
          statusValue,
          metadata,
          assignedBy,
          context,
          requireOrgAccess: service.requireOrgAccess,
        });
        return sendOk(res, result.data, { status: result.status, meta: result.meta });
      } catch (error) {
        if (res.headersSent) return;
        return sendError(
          res,
          error?.statusCode ?? 500,
          error?.code ?? 'survey_assignment_failed',
          error?.userMessage ?? error?.message ?? 'Unable to assign survey',
        );
      }
    },
    listAssignments: async (req, res) => {
      if (!ensureSupabase(res)) return;
      if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assignments'))) return;
      const { id } = req.params;
      const surveyRecord = await loadSurveyWithAssignments(id);
      if (!surveyRecord) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'survey_not_found';
        return sendError(res, 404, 'survey_not_found', `Survey not found for identifier ${id}`);
      }
      const surveyId = surveyRecord.id ?? id;
      const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
      const userIdFilter =
        typeof req.query.userId === 'string'
          ? req.query.userId.trim().toLowerCase()
          : typeof req.query.user_id === 'string'
            ? req.query.user_id.trim().toLowerCase()
            : null;
      const includeInactive = String(req.query.active ?? 'true').toLowerCase() === 'false';
      const limit = clampNumber(parseInt(req.query.limit, 10) || 200, 1, 1000);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const context = requireUserContext(req, res);
      if (!context) return;

      if (organizationId) {
        const access = await service.requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
        if (!access) {
          if (res.headersSent) return;
          return sendError(res, 403, 'org_access_denied', 'You do not have access to this organization.');
        }
      } else if (!context.isPlatformAdmin) {
        return sendError(res, 403, 'org_required', 'Organization filter is required unless you are a platform administrator.');
      }

      try {
        const result = await service.listAssignments({
          surveyId,
          organizationId,
          userIdFilter,
          includeInactive,
          offset,
          limit,
          getAssignmentsOrgColumnName,
          surveyAssignmentSelect,
        });
        return sendOk(res, result.data, { meta: { count: result.count } });
      } catch (error) {
        logger.error('[admin.surveys.assignments] failed', error);
        return sendError(res, 500, 'survey_assignments_load_failed', 'Unable to load survey assignments');
      }
    },
    deleteAssignment: async (req, res) => {
      if (!ensureSupabase(res)) return;
      if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.assignments.delete'))) return;
      const { surveyId, assignmentId } = req.params;
      const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(surveyId);
      const surveyIdForLookup = canonicalSurveyId ?? surveyId;
      if (!assignmentId) {
        return sendError(res, 400, 'assignment_id_required', 'Assignment id is required.');
      }

      const context = requireUserContext(req, res);
      if (!context) return;

      try {
        const existing = await service.fetchAssignment({
          assignmentId,
          surveyIdForLookup,
          supabaseSelect: surveyAssignmentSelect,
        });
        if (!existing) {
          return sendError(res, 404, 'assignment_not_found', 'Assignment not found.');
        }

        if (existing.organization_id) {
          const access = await service.requireOrgAccess(req, res, existing.organization_id, {
            write: true,
            requireOrgAdmin: true,
          });
          if (!access) {
            if (res.headersSent) return;
            return sendError(res, 403, 'org_access_denied', 'You do not have access to this organization.');
          }
        } else if (!context.isPlatformAdmin) {
          return sendError(res, 403, 'org_required', 'Only platform admins can remove global assignments.');
        }

        await service.deleteAssignment({
          assignmentId,
          hardDelete: String(req.query.hard ?? 'false').toLowerCase() === 'true',
          existing,
        });
        await service.refreshAggregates(surveyIdForLookup);

        service.logSurveyAssignmentEvent?.('survey_assignment_updated', {
          requestId: req.requestId ?? null,
          surveyId: surveyIdForLookup,
          organizationCount: existing.organization_id ? 1 : 0,
          userCount: existing.user_id ? 1 : 0,
          insertedRowCount: 0,
          skippedRowCount: 0,
          metadata: { action: String(req.query.hard ?? 'false').toLowerCase() === 'true' ? 'deleted' : 'deactivated', assignmentId },
        });

        return sendOk(res, { deleted: true, id: assignmentId });
      } catch (error) {
        logger.error('[admin.surveys.assignments.delete] failed', error);
        return sendError(res, 500, 'survey_assignment_delete_failed', 'Unable to remove survey assignment');
      }
    },
  };
};

export default createAdminSurveyAssignmentsController;
