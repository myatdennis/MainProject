export const createClientSurveyAssignmentsService = ({
  supabase,
  logger,
  e2eStore,
  persistE2EStore,
  isDemoOrTestMode,
  surveyAssignmentType,
  ensureSurveyAssignmentsForUserFromOrgScope,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  buildClientSurveyAssignmentSelect,
  isUuid,
  runTimedQuery,
  surveyAssignmentSelect,
  isSupabaseTransientError,
  loadSurveyRecordsByAssignmentIds,
}) => {
  const isInvalidUuidFilterError = (error) =>
    error?.code === '22P02' ||
    (typeof error?.message === 'string' && error.message.toLowerCase().includes('invalid input syntax for type uuid'));

  const createServiceUnavailableError = (step, message, cause = null) => {
    const error = new Error(message);
    error.statusCode = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    error.userMessage = message;
    error.label = step;
    if (cause) {
      error.cause = cause;
    }
    return error;
  };

  const buildSurveyAssignmentSelect = buildClientSurveyAssignmentSelect ?? ((assignmentsOrgColumn) => {
    const baseColumns =
      typeof surveyAssignmentSelect === 'string' && surveyAssignmentSelect.trim().length > 0 && surveyAssignmentSelect.trim() !== '*'
        ? surveyAssignmentSelect
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .filter((value) => value !== 'organization_id' && value !== 'org_id')
        : ['id', 'survey_id', 'status', 'due_at', 'note', 'assigned_by', 'metadata', 'active'];

    if (assignmentsOrgColumn === 'org_id') {
      return [...baseColumns, 'organization_id:org_id', 'org_id'].join(',');
    }
    return [...baseColumns, 'organization_id'].join(',');
  });

  const parseBoolean = (value, defaultValue = true) => {
    if (value === undefined || value === null) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  };

  const buildDemoAssignments = ({ context, scopedOrgIds, includeCompleted }) => {
    const allAssignments = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
    const scopedOrgIdSet = new Set(scopedOrgIds.map((value) => String(value || '').trim()).filter(Boolean));
    const existingUserSurveySet = new Set(
      allAssignments
        .filter((assignment) => {
          if (!assignment) return false;
          if ((assignment.assignment_type ?? assignment.assignmentType ?? null) !== surveyAssignmentType) return false;
          const rowUserId = assignment.user_id ?? assignment.userId ?? null;
          return rowUserId && String(rowUserId).toLowerCase() === String(context.userId).toLowerCase();
        })
        .map((assignment) => String(assignment.survey_id ?? assignment.surveyId ?? ''))
        .filter(Boolean),
    );

    const materializedRows = [];
    for (const assignment of allAssignments) {
      if (!assignment) continue;
      if ((assignment.assignment_type ?? assignment.assignmentType ?? null) !== surveyAssignmentType) continue;
      const surveyId = assignment.survey_id ?? assignment.surveyId ?? null;
      if (!surveyId) continue;
      const rowUserId = assignment.user_id ?? assignment.userId ?? null;
      if (rowUserId) continue;
      const rowOrgId = assignment.organization_id ?? assignment.organizationId ?? assignment.org_id ?? assignment.orgId ?? null;
      if (rowOrgId && scopedOrgIdSet.size > 0 && !scopedOrgIdSet.has(String(rowOrgId))) continue;
      if (existingUserSurveySet.has(String(surveyId))) continue;

      const nowIso = new Date().toISOString();
      const userScopedAssignment = {
        ...assignment,
        id: `survey-asn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        user_id: context.userId,
        status: assignment.status ?? 'assigned',
        active: true,
        metadata: {
          ...(assignment.metadata && typeof assignment.metadata === 'object' ? assignment.metadata : {}),
          assigned_via: 'org_rollup',
        },
        created_at: nowIso,
        updated_at: nowIso,
      };
      materializedRows.push(userScopedAssignment);
      existingUserSurveySet.add(String(surveyId));
    }

    if (materializedRows.length > 0) {
      e2eStore.assignments.push(...materializedRows);
      persistE2EStore();
    }

    const rows = (e2eStore.assignments || []).filter((assignment) => {
      if (!assignment) return false;
      if ((assignment.assignment_type ?? assignment.assignmentType ?? null) !== surveyAssignmentType) return false;
      const rowUserId = assignment.user_id ?? assignment.userId ?? null;
      if (!rowUserId || String(rowUserId).toLowerCase() !== String(context.userId).toLowerCase()) return false;
      if (!includeCompleted && assignment.status === 'completed') return false;
      return true;
    });

    return {
      data: rows.map((assignment) => ({
        assignment,
        survey: e2eStore.surveys.get(assignment.survey_id) ?? null,
      })),
      meta: {
        hydrationPending: false,
        orgId: scopedOrgIds[0] ?? null,
      },
    };
  };

  const listAssigned = async ({ context, orgScope, scopedOrgIds, includeCompleted, requestId }) => {
    if (!supabase) {
      if (isDemoOrTestMode) {
        return buildDemoAssignments({ context, scopedOrgIds, includeCompleted });
      }
      const error = new Error('Assigned surveys are unavailable because the database is not configured.');
      error.statusCode = 503;
      error.code = 'database_unavailable';
      throw error;
    }

    logger.info('[survey] learner_assigned_query', {
      requestId,
      route: '/api/client/surveys/assigned',
      userId: context.userId,
      orgId: orgScope.orgId ?? null,
      scopedOrgIdCount: scopedOrgIds.length,
      includeCompleted,
    });
    logger.info('client_assigned_surveys_request_context', {
      requestId,
      route: '/api/client/surveys/assigned',
      userId: context.userId,
      activeOrgId: orgScope.orgId ?? null,
      scopedOrgIdCount: scopedOrgIds.length,
      membershipOrgIdCount: Array.isArray(context.organizationIds) ? context.organizationIds.length : 0,
      authResolved: Boolean(context.userId),
    });

    const materializePromise = ensureSurveyAssignmentsForUserFromOrgScope({
      userId: context.userId,
      orgIds: scopedOrgIds,
      refreshAggregates: false,
    });

    const materializeOutcome = materializePromise
      .then(() => ({ state: 'done' }))
      .catch((error) => ({ state: 'error', error }));

    const waitForMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const materializeBudgetMs = Math.min(
      Math.max(Number(process.env.SURVEY_ASSIGNMENT_MATERIALIZE_BUDGET_MS || 2500), 250),
      8000,
    );

    const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
    const assignmentsOrgColumn = await getAssignmentsOrgColumnName();
    const assignmentSelect = buildSurveyAssignmentSelect(assignmentsOrgColumn);
    const isUserIdUuid = isUuid(context.userId);

    const retryQuery = async (label, buildQuery, timeoutMs = undefined) => {
      let lastError;
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const attemptId = `${label}#${attempt}`;
        const start = Date.now();
        logger.info('client_assigned_surveys_query_start', { requestId, label, attempt, attemptId });
        try {
          const result = await runTimedQuery(label, buildQuery, timeoutMs);
          const duration = Date.now() - start;
          logger.info('client_assigned_surveys_query_success', { requestId, label, attempt, attemptId, duration });
          return result;
        } catch (error) {
          lastError = error;
          const duration = Date.now() - start;
          logger.warn('client_assigned_surveys_query_error', {
            requestId,
            label,
            attempt,
            attemptId,
            duration,
            code: error?.code ?? null,
            message: error?.message ?? String(error),
          });
          if (!isSupabaseTransientError(error) || attempt >= maxAttempts) {
            throw error;
          }
          logger.warn('client_assigned_surveys_query_retry', {
            requestId,
            label,
            attempt,
            maxAttempts,
            code: error?.code ?? null,
            message: error?.message ?? String(error),
          });
          await waitForMs(150 * attempt);
        }
      }
      throw lastError;
    };

    const loadAssignmentsForUser = async (column, value) => {
      const buildQuery = () => {
        let query = supabase
          .from('assignments')
          .select(assignmentSelect)
          .eq('assignment_type', surveyAssignmentType)
          .eq(column, value);
        if (scopedOrgIds.length > 0) {
          query = query.in(assignmentsOrgColumn, scopedOrgIds);
        }
        if (!includeCompleted) {
          query = query.eq('active', true).in('status', ['assigned', 'in-progress']);
        }
        return query;
      };
      const result = await retryQuery('survey.assigned.load_assignments', () => buildQuery(), 10000);
      return Array.isArray(result?.data) ? result.data : [];
    };

    const loadMergedUserAssignments = async () => {
      if (assignmentsSupportUserIdUuid && isUserIdUuid) {
        const [uuidRows, legacyRows] = await Promise.all([
          loadAssignmentsForUser('user_id_uuid', context.userId).catch(() => []),
          loadAssignmentsForUser('user_id', context.userId),
        ]);
        const merged = [...uuidRows, ...legacyRows];
        const seen = new Set();
        return merged.filter((row) => {
          const id = row?.id ? String(row.id) : '';
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
      return loadAssignmentsForUser('user_id', context.userId);
    };

    let assignments = [];
    try {
      assignments = await loadMergedUserAssignments();
    } catch (error) {
      if (isSupabaseTransientError(error)) {
        logger.warn('client_assigned_surveys_load_transient', {
          requestId,
          userId: context.userId,
          orgId: orgScope.orgId ?? null,
          code: error?.code ?? null,
          message: error?.message ?? String(error),
        });
        throw createServiceUnavailableError(
          'survey.assigned.load_assignments',
          'Survey assignments are temporarily unavailable. Please retry.',
          error,
        );
      } else {
        if (isInvalidUuidFilterError(error)) {
          logger.warn('client_assigned_surveys_invalid_userid_filter', {
            requestId,
            userId: context.userId,
            orgId: orgScope.orgId ?? null,
            code: error?.code ?? null,
            message: error?.message ?? String(error),
          });
          assignments = [];
        } else {
          throw error;
        }
      }
    }

    if (assignments.length === 0) {
      const outcome = await Promise.race([
        materializeOutcome,
        waitForMs(materializeBudgetMs).then(() => ({ state: 'timeout' })),
      ]);

      if (outcome?.state === 'done') {
        try {
          assignments = await loadMergedUserAssignments();
        } catch (error) {
          if (isInvalidUuidFilterError(error)) {
            logger.warn('client_assigned_surveys_invalid_userid_filter_after_materialize', {
              requestId,
              userId: context.userId,
              orgId: orgScope.orgId ?? null,
              code: error?.code ?? null,
              message: error?.message ?? String(error),
            });
            assignments = [];
          } else if (isSupabaseTransientError(error)) {
            throw createServiceUnavailableError(
              'survey.assigned.reload_assignments',
              'Survey assignments are temporarily unavailable. Please retry.',
              error,
            );
          } else {
            throw error;
          }
        }
      } else if (outcome?.state === 'error') {
        if (isInvalidUuidFilterError(outcome.error)) {
          logger.warn('client_assigned_surveys_materialize_invalid_userid_filter', {
            requestId,
            userId: context.userId,
            orgId: orgScope.orgId ?? null,
            code: outcome.error?.code ?? null,
            message: outcome.error?.message ?? String(outcome.error),
          });
          assignments = [];
        } else if (isSupabaseTransientError(outcome.error)) {
          logger.warn('client_assigned_surveys_materialize_transient', {
            requestId,
            userId: context.userId,
            orgId: orgScope.orgId ?? null,
            code: outcome.error?.code ?? null,
            message: outcome.error?.message ?? String(outcome.error),
          });
          throw createServiceUnavailableError(
            'survey.assigned.materialize_assignments',
            'Survey assignments are temporarily unavailable. Please retry.',
            outcome.error,
          );
        } else {
          throw outcome.error;
        }
      } else {
        logger.warn('client_assigned_surveys_materialize_timeout', {
          requestId,
          userId: context.userId,
          orgId: orgScope.orgId ?? null,
          budgetMs: materializeBudgetMs,
        });
        throw createServiceUnavailableError(
          'survey.assigned.materialize_timeout',
          'Survey assignments are temporarily unavailable. Please retry.',
        );
      }
    }

    logger.info('client_assigned_surveys_fetched', {
      requestId,
      route: '/api/client/surveys/assigned',
      userId: context.userId,
      orgId: orgScope.orgId ?? null,
      orgIdCount: Array.isArray(context.organizationIds) ? context.organizationIds.length : 0,
      includeCompleted,
      assignedSurveyCount: assignments.length,
      rawDbRowCount: assignments.length,
    });

    const surveyIds = Array.from(new Set(assignments.map((row) => row?.survey_id).filter(Boolean)));
    let surveyMap = new Map();
    let surveyResolution = {
      requestedCount: surveyIds.length,
      resolvedIdCount: 0,
      rawRowCount: 0,
    };
    if (surveyIds.length) {
      try {
        surveyResolution = await loadSurveyRecordsByAssignmentIds(surveyIds);
        surveyMap = surveyResolution.surveyMap;
      } catch (error) {
        logger.warn('client_assigned_surveys_survey_lookup_unavailable', {
          requestId,
          userId: context.userId,
          orgId: orgScope.orgId ?? null,
          code: error?.code ?? null,
          message: error?.message ?? null,
          surveyIdCount: surveyIds.length,
          transient: Boolean(isSupabaseTransientError(error)),
        });
      }
    }

    const malformedAssignments = [];
    const data = assignments
      .map((assignment) => {
        const assignmentId = assignment?.id ? String(assignment.id) : '';
        const surveyId = assignment?.survey_id ? String(assignment.survey_id) : '';
        if (!assignmentId || !surveyId) {
          malformedAssignments.push({
            assignmentId: assignmentId || null,
            surveyId: surveyId || null,
          });
          return null;
        }
        return {
          assignment,
          survey: surveyMap.get(surveyId) ?? null,
        };
      })
      .filter(Boolean);

    if (malformedAssignments.length > 0) {
      logger.warn('client_assigned_surveys_skipped_malformed_rows', {
        requestId,
        userId: context.userId,
        orgId: orgScope.orgId ?? null,
        skippedCount: malformedAssignments.length,
        skipped: malformedAssignments,
      });
    }

    logger.info('client_assigned_surveys_render_ready', {
      requestId,
      route: '/api/client/surveys/assigned',
      userId: context.userId,
      orgId: orgScope.orgId ?? null,
      assignedSurveyCount: assignments.length,
      rawDbRowCount: assignments.length,
      surveyLookupRequestedCount: surveyResolution.requestedCount,
      surveyLookupResolvedIdCount: surveyResolution.resolvedIdCount,
      surveyLookupRowCount: surveyResolution.rawRowCount,
      transformResultCount: data.length,
      missingSurveyCount: data.filter((entry) => entry.assignment?.survey_id && !entry.survey).length,
    });

    return {
      data,
      meta: {
        hydrationPending: false,
        orgId: orgScope.orgId ?? null,
      },
    };
  };

  return {
    parseBoolean,
    listAssigned,
  };
};

export default createClientSurveyAssignmentsService;
