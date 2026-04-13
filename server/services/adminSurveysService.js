export const createAdminSurveysService = ({
  logger,
  supabase,
  e2eStore,
  isDemoOrTestMode,
  ensureSupabase,
  ensureAdminSurveySchemaOrRespond,
  requireUserContext,
  requireOrgAccess,
  runSupabaseReadQueryWithRetry,
  runSupabaseQueryWithRetry,
  runTimedQuery,
  fetchSurveyAssignmentsMap,
  applyAssignmentToSurvey,
  listDemoSurveys,
  getDemoSurveyById,
  upsertDemoSurvey,
  removeDemoSurvey,
  normalizeAssignedTargets,
  buildSurveyPersistencePayload,
  isMissingColumnError,
  maybeHandleSurveyColumnError,
  firstRow,
  syncSurveyAssignments,
  loadSurveyWithAssignments,
  rememberSurveyIdentifierAlias,
  resolveSurveyIdentifierToCanonicalId,
  coerceIdArray,
  buildHdiSurveyTemplate,
  pickOrgId,
  clampNumber,
  buildHdiParticipantRows,
  buildHdiCohortAnalytics,
  buildHdiComparison,
  createHdiResponseEnvelope,
  hdiResponseShapes,
  toHdiRecord,
}) => {
  const createAssignmentPayloadSummary = (payload = {}) => ({
    organizationIdCount: coerceIdArray(
      payload.organizationIds ??
        payload.organization_ids ??
        payload.assignedTo?.organizationIds ??
        payload.assigned_to?.organization_ids,
    ).length,
  });

  const logSurveyMutation = ({ event, req, context, surveyId = null, payload = {} }) => {
    logger.info(`[survey] ${event}`, {
      requestId: req.requestId ?? null,
      userId: context.userId,
      surveyId,
      status: payload.status ?? 'draft',
      organizationIdCount: createAssignmentPayloadSummary(payload).organizationIdCount,
    });
  };

  const listSurveys = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.list'))) return null;

    if (!supabase) {
      return { status: 200, data: listDemoSurveys() };
    }

    const { data } = await runSupabaseReadQueryWithRetry('admin.surveys.list', () =>
      supabase.from('surveys').select('*').order('updated_at', { ascending: false }),
    );

    const ids = (data || []).map((survey) => survey.id).filter(Boolean);
    const assignmentMap = await fetchSurveyAssignmentsMap(ids);
    const shaped = (data || []).map((survey) => applyAssignmentToSurvey({ ...survey }, assignmentMap.get(survey.id)));
    return { status: 200, data: shaped };
  };

  const getSurvey = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.detail'))) return null;
    const { id } = req.params;

    if (!supabase) {
      const survey = getDemoSurveyById(id);
      if (!survey) {
        return { status: 404, error: { code: 'survey_not_found', message: 'Survey not found' } };
      }
      return { status: 200, data: survey };
    }

    const survey = await loadSurveyWithAssignments(id);
    if (!survey) {
      return { status: 404, error: { code: 'survey_not_found', message: 'Survey not found' } };
    }
    return { status: 200, data: survey };
  };

  const createSurvey = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.upsert'))) return null;
    const payload = req.body || {};
    const incomingSurveyIdentifier = typeof payload.id === 'string' ? payload.id.trim() : null;
    const context = requireUserContext(req, res);
    if (!context) return null;

    if (!payload.title) {
      return { status: 400, error: { code: 'validation_failed', message: 'title is required' } };
    }

    logSurveyMutation({ event: 'create_request', req, context, surveyId: incomingSurveyIdentifier, payload });
    if (String(payload.status ?? '').toLowerCase() === 'published') {
      logger.info('[survey] publish_request', {
        requestId: req.requestId ?? null,
        userId: context.userId,
        surveyId: incomingSurveyIdentifier,
      });
    }

    if (!supabase) {
      const survey = upsertDemoSurvey(payload);
      return { status: 201, data: survey };
    }

    const { assignedTo } = normalizeAssignedTargets(payload);
    const performUpsert = async () => {
      const insertPayload = buildSurveyPersistencePayload(payload);
      try {
        const result = await runTimedQuery('admin.surveys.upsert', () =>
          supabase.from('surveys').upsert(insertPayload).select('*'),
        );
        return firstRow(result);
      } catch (error) {
        if (isMissingColumnError(error) && maybeHandleSurveyColumnError(error)) {
          const retryPayload = buildSurveyPersistencePayload(payload);
          const retryResult = await runTimedQuery('admin.surveys.upsert.retry', () =>
            supabase.from('surveys').upsert(retryPayload).select('*'),
          );
          return firstRow(retryResult);
        }
        throw error;
      }
    };

    const data = await performUpsert();
    rememberSurveyIdentifierAlias(incomingSurveyIdentifier, data?.id ?? null);
    await syncSurveyAssignments(data.id, assignedTo);
    const survey = await loadSurveyWithAssignments(data.id);
    return { status: 201, data: survey };
  };

  const updateSurvey = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.update'))) return null;
    const { id } = req.params;
    const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(id);
    const surveyIdForWrite = canonicalSurveyId ?? id;
    const patch = req.body || {};
    const context = requireUserContext(req, res);
    if (!context) return null;

    if (String(patch.status ?? '').toLowerCase() === 'published') {
      logger.info('[survey] publish_request', {
        requestId: req.requestId ?? null,
        userId: context.userId,
        surveyId: surveyIdForWrite,
      });
    }

    if (!supabase) {
      const survey = upsertDemoSurvey({ ...patch, id });
      return { status: 200, data: survey };
    }

    const assignmentUpdateRequested = Object.prototype.hasOwnProperty.call(patch, 'assignedTo') ||
      Object.prototype.hasOwnProperty.call(patch, 'assigned_to') ||
      Object.prototype.hasOwnProperty.call(patch, 'organizationIds') ||
      Object.prototype.hasOwnProperty.call(patch, 'organization_ids') ||
      Object.prototype.hasOwnProperty.call(patch, 'userIds') ||
      Object.prototype.hasOwnProperty.call(patch, 'user_ids') ||
      Object.prototype.hasOwnProperty.call(patch, 'cohortIds') ||
      Object.prototype.hasOwnProperty.call(patch, 'cohort_ids') ||
      Object.prototype.hasOwnProperty.call(patch, 'departmentIds') ||
      Object.prototype.hasOwnProperty.call(patch, 'department_ids');
    const { assignedTo } = assignmentUpdateRequested ? normalizeAssignedTargets(patch) : { assignedTo: undefined };
    const performUpdate = async () => {
      const updatePayload = buildSurveyPersistencePayload({ ...patch, id });
      delete updatePayload.id;
      try {
        const result = await runTimedQuery('admin.surveys.update', () =>
          supabase.from('surveys').update(updatePayload).eq('id', surveyIdForWrite).select('*'),
        );
        return firstRow(result);
      } catch (error) {
        if (isMissingColumnError(error) && maybeHandleSurveyColumnError(error)) {
          const retryPayload = buildSurveyPersistencePayload({ ...patch, id });
          delete retryPayload.id;
          const retryResult = await runTimedQuery('admin.surveys.update.retry', () =>
            supabase.from('surveys').update(retryPayload).eq('id', surveyIdForWrite).select('*'),
          );
          return firstRow(retryResult);
        }
        throw error;
      }
    };

    await performUpdate();
    if (assignmentUpdateRequested) {
      await syncSurveyAssignments(surveyIdForWrite, assignedTo);
    }
    const survey = await loadSurveyWithAssignments(surveyIdForWrite);
    rememberSurveyIdentifierAlias(id, survey?.id ?? surveyIdForWrite);
    return { status: 200, data: survey };
  };

  const deleteSurvey = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, 'admin.surveys.delete'))) return null;
    const { id } = req.params;
    const canonicalSurveyId = await resolveSurveyIdentifierToCanonicalId(id);
    const surveyIdForDelete = canonicalSurveyId ?? id;

    if (!supabase) {
      const deleted = removeDemoSurvey(id);
      return deleted ? { status: 204, data: null } : { status: 404, error: { code: 'survey_not_found', message: 'Survey not found' } };
    }

    await runSupabaseQueryWithRetry('admin.surveys.delete.assignments', () =>
      supabase.from('survey_assignments').delete().eq('survey_id', surveyIdForDelete),
    );
    await runSupabaseQueryWithRetry('admin.surveys.delete', () =>
      supabase.from('surveys').delete().eq('id', surveyIdForDelete),
    );
    return { status: 204, data: null };
  };

  const getHdiTemplate = async () => ({
    status: 200,
    data: buildHdiSurveyTemplate(),
  });

  const resolveAdminSurveyContext = async ({ req, res, label, requireOrgFilter = true }) => {
    if (!ensureSupabase(res)) return null;
    if (!(await ensureAdminSurveySchemaOrRespond(res, label))) return null;
    const context = requireUserContext(req, res);
    if (!context) return null;

    const { id } = req.params;
    const surveyRecord = await loadSurveyWithAssignments(id);
    if (!surveyRecord) {
      return {
        result: {
          status: 404,
          error: { code: 'survey_not_found', message: `Survey not found for identifier ${id}` },
        },
      };
    }

    const organizationId = pickOrgId(req.query.orgId, req.query.organizationId);
    if (organizationId) {
      const access = await requireOrgAccess(req, res, organizationId, { write: false, requireOrgAdmin: false });
      if (!access) {
        return {
          result: {
            status: 403,
            error: { code: 'org_access_denied', message: 'You do not have access to this organization.' },
          },
        };
      }
    } else if (requireOrgFilter && !context.isPlatformAdmin) {
      return {
        result: {
          status: 403,
          error: {
            code: 'org_required',
            message: 'Organization filter is required unless you are a platform administrator.',
          },
        },
      };
    }

    return { context, surveyRecord, organizationId };
  };

  const querySurveyResponses = async ({ surveyId, organizationId, userIdFilter = null, limit = 200, selectColumns = '*' }) => {
    if (!supabase && isDemoOrTestMode) {
      const rows = Array.isArray(e2eStore?.surveyResponses) ? e2eStore.surveyResponses : [];
      return rows
        .filter((row) => {
          if (!row) return false;
          if (String(row.survey_id ?? row.surveyId ?? '') !== String(surveyId)) return false;
          if (organizationId) {
            const rowOrgId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
            if (!rowOrgId || String(rowOrgId) !== String(organizationId)) return false;
          }
          if (userIdFilter) {
            const rowUserId = row.user_id ?? row.userId ?? null;
            if (!rowUserId || String(rowUserId).trim().toLowerCase() !== String(userIdFilter).trim().toLowerCase()) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const aTs = Date.parse(a?.completed_at || a?.completedAt || a?.created_at || '') || 0;
          const bTs = Date.parse(b?.completed_at || b?.completedAt || b?.created_at || '') || 0;
          return bTs - aTs;
        })
        .slice(0, limit);
    }

    const runQuery = async ({ orgColumn, columns }) => {
      let query = supabase
        .from('survey_responses')
        .select(columns)
        .eq('survey_id', surveyId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (organizationId) {
        query = query.eq(orgColumn, organizationId);
      }
      if (userIdFilter) {
        query = query.eq('user_id', userIdFilter);
      }
      return query;
    };

    let data = null;
    let error = null;
    ({ data, error } = await runQuery({ orgColumn: 'organization_id', columns: selectColumns }));
    if (error && isMissingColumnError(error)) {
      const fallbackColumns =
        selectColumns === '*'
          ? '*'
          : String(selectColumns).replace(/\borganization_id\b/g, 'org_id');
      ({ data, error } = await runQuery({ orgColumn: 'org_id', columns: fallbackColumns }));
    }
    if (error) throw error;
    return data || [];
  };

  const getResults = async ({ req, res }) => {
    const resolved = await resolveAdminSurveyContext({
      req,
      res,
      label: 'admin.surveys.results',
      requireOrgFilter: true,
    });
    if (!resolved) return null;
    if (resolved.result) return resolved.result;

    const { surveyRecord, organizationId } = resolved;
    const userIdFilter =
      typeof req.query.userId === 'string'
        ? req.query.userId.trim().toLowerCase()
        : typeof req.query.user_id === 'string'
          ? req.query.user_id.trim().toLowerCase()
          : null;
    const limit = clampNumber(parseInt(req.query.limit, 10) || 200, 1, 1000);

    try {
      const primarySelect =
        'id,survey_id,user_id,organization_id,assignment_id,response,status,metadata,completed_at,created_at';
      const data = await querySurveyResponses({
        surveyId: surveyRecord.id,
        organizationId,
        userIdFilter,
        limit,
        selectColumns: primarySelect,
      });

      return {
        status: 200,
        data,
        meta: {
          surveyId: surveyRecord.id,
          count: Array.isArray(data) ? data.length : 0,
          organizationId: organizationId ?? null,
        },
      };
    } catch (error) {
      logger.error('admin_survey_results_failed', {
        surveyId: surveyRecord.id,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      return {
        status: 500,
        error: { code: 'survey_results_failed', message: 'Unable to load survey results' },
      };
    }
  };

  const getHdiParticipantReport = async ({ req, res }) => {
    const resolved = await resolveAdminSurveyContext({
      req,
      res,
      label: 'admin.surveys.hdi.participant-report',
      requireOrgFilter: true,
    });
    if (!resolved) return null;
    if (resolved.result) return resolved.result;

    const { surveyRecord, organizationId } = resolved;
    const participantFilter =
      typeof req.query.participant === 'string' && req.query.participant.trim().length
        ? req.query.participant.trim().toLowerCase()
        : null;

    try {
      const limit = clampNumber(parseInt(req.query.limit, 10) || 500, 1, 2000);
      const data = await querySurveyResponses({
        surveyId: surveyRecord.id,
        organizationId,
        limit,
      });

      let rows = buildHdiParticipantRows(data || []);
      if (participantFilter) {
        rows = rows.filter((row) => String(row.participantIdentifier || '').toLowerCase() === participantFilter);
      }

      const envelope = createHdiResponseEnvelope(hdiResponseShapes.PARTICIPANT_REPORT, rows, {
        count: rows.length,
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
      });
      return { status: 200, data: envelope.data, meta: envelope.meta };
    } catch (error) {
      logger.error('admin_hdi_participant_report_failed', {
        surveyId: surveyRecord.id,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      return {
        status: 500,
        error: { code: 'hdi_participant_report_failed', message: 'Unable to load HDI participant report' },
      };
    }
  };

  const getHdiCohortAnalytics = async ({ req, res }) => {
    const resolved = await resolveAdminSurveyContext({
      req,
      res,
      label: 'admin.surveys.hdi.cohort-analytics',
      requireOrgFilter: true,
    });
    if (!resolved) return null;
    if (resolved.result) return resolved.result;

    const { surveyRecord, organizationId } = resolved;

    try {
      const limit = clampNumber(parseInt(req.query.limit, 10) || 2000, 1, 5000);
      const data = await querySurveyResponses({
        surveyId: surveyRecord.id,
        organizationId,
        limit,
      });
      const analytics = buildHdiCohortAnalytics(data || []);
      const envelope = createHdiResponseEnvelope(hdiResponseShapes.COHORT_ANALYTICS, analytics, {
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
      });
      return { status: 200, data: envelope.data, meta: envelope.meta };
    } catch (error) {
      logger.error('admin_hdi_cohort_analytics_failed', {
        surveyId: surveyRecord.id,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      return {
        status: 500,
        error: { code: 'hdi_cohort_analytics_failed', message: 'Unable to load HDI cohort analytics' },
      };
    }
  };

  const getHdiPrePostComparison = async ({ req, res }) => {
    const resolved = await resolveAdminSurveyContext({
      req,
      res,
      label: 'admin.surveys.hdi.pre-post-comparison',
      requireOrgFilter: true,
    });
    if (!resolved) return null;
    if (resolved.result) return resolved.result;

    const { surveyRecord, organizationId, context } = resolved;
    const participantFilter =
      typeof req.query.participant === 'string' && req.query.participant.trim().length
        ? req.query.participant.trim().toLowerCase()
        : null;
    if (!participantFilter) {
      return {
        status: 400,
        error: { code: 'participant_required', message: 'participant query parameter is required.' },
      };
    }

    try {
      logger.info('[survey] admin_results_query', {
        requestId: req.requestId ?? null,
        surveyId: surveyRecord.id,
        userId: context.userId,
        organizationId: organizationId ?? null,
        participant: participantFilter,
      });
      const data = await querySurveyResponses({
        surveyId: surveyRecord.id,
        organizationId,
        limit: 2000,
      });

      const records = (data || [])
        .map((row) => toHdiRecord(row))
        .filter(Boolean)
        .filter((record) => {
          if (record.userId && String(record.userId).toLowerCase() === participantFilter) return true;
          return Array.isArray(record.participantKeys) && record.participantKeys.includes(participantFilter);
        });

      const latestPost = records
        .filter((record) => record.administrationType === 'post' || record.administrationType === 'pulse')
        .sort((a, b) => (Date.parse(b.completedAt ?? '') || 0) - (Date.parse(a.completedAt ?? '') || 0))[0];
      const preRecord = records
        .filter((record) => record.administrationType === 'pre')
        .sort((a, b) => (Date.parse(b.completedAt ?? '') || 0) - (Date.parse(a.completedAt ?? '') || 0))[0];

      const comparison = latestPost && preRecord ? buildHdiComparison({ pre: preRecord, post: latestPost }) : null;
      const envelope = createHdiResponseEnvelope(hdiResponseShapes.PRE_POST_COMPARISON, comparison, {
        surveyId: surveyRecord.id,
        organizationId: organizationId ?? null,
        participant: participantFilter,
      });
      return { status: 200, data: envelope.data, meta: envelope.meta };
    } catch (error) {
      logger.error('admin_hdi_pre_post_comparison_failed', {
        surveyId: surveyRecord.id,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      return {
        status: 500,
        error: { code: 'hdi_pre_post_comparison_failed', message: 'Unable to load HDI pre/post comparison' },
      };
    }
  };

  return {
    listSurveys,
    getSurvey,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    getHdiTemplate,
    getResults,
    getHdiParticipantReport,
    getHdiCohortAnalytics,
    getHdiPrePostComparison,
  };
};

export default createAdminSurveysService;
