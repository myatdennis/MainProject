import { sendError } from '../lib/apiEnvelope.js';

export const createClientSurveysService = ({
  logger,
  supabase,
  e2eStore,
  isDemoMode,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  loadSurveyWithAssignments,
  fetchSurveyAssignmentsMap,
  applyAssignmentToSurvey,
  listDemoSurveys,
  loadSurveyAssignmentForUser,
  createEmptyAssignedTo,
  updateDemoSurveyAssignments,
  persistE2EStore,
  logSurveyAssignmentEvent,
  refreshSurveyAssignmentAggregates,
  surveyAssignmentType,
  isHdiAssessment,
  normalizeHdiAdministrationType,
  normalizeHdiLinkedAssessmentId,
  buildParticipantIdentity,
  validateHdiSubmissionContract,
  scoreHdiSubmission,
  buildHdiProfile,
  buildHdiReport,
  compareHdiReports,
  buildHdiComparison,
  findLatestHdiPreRecord,
  toHdiRecord,
  createHdiResponseEnvelope,
  hdiResponseShapes,
  hdiMetadataContractVersion,
  firstRow,
}) => {
  const listClientSurveys = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    const statusFilter = rawStatus && rawStatus !== 'all' ? rawStatus : null;
    const wantsAllStatuses = rawStatus === 'all';
    const fallbackStatus = statusFilter ?? (wantsAllStatuses ? null : 'published');
    const rawOrgQuery =
      typeof req.query.orgId === 'string'
        ? req.query.orgId
        : typeof req.query.organizationId === 'string'
          ? req.query.organizationId
          : '';
    const requestedOrgId = rawOrgQuery.trim() || null;
    const membershipOrgIds = Array.isArray(context.organizationIds)
      ? context.organizationIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const membershipOrgIdSet = new Set(membershipOrgIds);
    const activeOrgId = req.activeOrgId ? String(req.activeOrgId).trim() : null;
    const orgFilter = requestedOrgId || activeOrgId || null;

    if (!context.isPlatformAdmin && membershipOrgIds.length === 0) {
      return {
        status: 403,
        error: {
          code: 'org_membership_required',
          message: 'Organization membership required.',
        },
      };
    }

    if (requestedOrgId && !context.isPlatformAdmin && !membershipOrgIdSet.has(requestedOrgId)) {
      return {
        status: 403,
        error: {
          code: 'org_forbidden',
          message: 'You do not have access to this organization.',
        },
      };
    }

    if (!supabase || isDemoMode) {
      let records = listDemoSurveys();
      if (fallbackStatus) {
        records = records.filter((survey) => String(survey.status || '').toLowerCase() === fallbackStatus);
      }
      if (orgFilter) {
        records = records.filter((survey) => {
          const orgIds = survey.assignedTo?.organizationIds || survey.assigned_to?.organizationIds || [];
          if (!Array.isArray(orgIds) || orgIds.length === 0) return true;
          return orgIds.map(String).includes(orgFilter);
        });
      } else if (!context.isPlatformAdmin) {
        records = records.filter((survey) => {
          const orgIds = survey.assignedTo?.organizationIds || survey.assigned_to?.organizationIds || [];
          if (!Array.isArray(orgIds) || orgIds.length === 0) return false;
          return orgIds.map(String).some((id) => membershipOrgIdSet.has(id));
        });
      }
      return { status: 200, data: records };
    }

    let query = supabase.from('surveys').select('*').order('updated_at', { ascending: false });
    if (fallbackStatus) {
      query = query.eq('status', fallbackStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    const ids = (data || []).map((survey) => survey.id).filter(Boolean);
    const assignmentMap = await fetchSurveyAssignmentsMap(ids);
    let shaped = (data || []).map((survey) => applyAssignmentToSurvey({ ...survey }, assignmentMap.get(survey.id)));

    if (orgFilter) {
      shaped = shaped.filter((survey) => {
        const orgIds = survey.assignedTo?.organizationIds ?? survey.assigned_to?.organizationIds ?? [];
        if (!Array.isArray(orgIds) || orgIds.length === 0) return true;
        return orgIds.map(String).includes(orgFilter);
      });
    } else if (!context.isPlatformAdmin) {
      shaped = shaped.filter((survey) => {
        const orgIds = survey.assignedTo?.organizationIds ?? survey.assigned_to?.organizationIds ?? [];
        if (!Array.isArray(orgIds) || orgIds.length === 0) return false;
        return orgIds.map(String).some((id) => membershipOrgIdSet.has(id));
      });
    }

    return { status: 200, data: shaped };
  };

  const submitClientSurvey = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    let submitStage = 'init';
    const context = requireUserContext(req, res);
    if (!context) return null;
    const { id } = req.params;
    let surveyIdForLogs = id;

    const responses = req.body?.responses;
    const submissionStatusRaw = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : 'completed';
    const submissionStatus = submissionStatusRaw === 'in-progress' ? 'in-progress' : 'completed';
    const isDraftSave = submissionStatus === 'in-progress';
    if (!responses || typeof responses !== 'object') {
      return {
        status: 400,
        error: { code: 'responses_required', message: 'Provide structured responses payload.' },
      };
    }

    try {
      logger.info('[survey] learner_submit_request', {
        requestId: req.requestId ?? null,
        route: '/api/client/surveys/:id/submit',
        userId: context.userId,
        surveyId: id,
        assignmentId: req.body?.assignmentId ?? req.body?.assignment_id ?? null,
        status: submissionStatus,
        responseFieldCount: Object.keys(responses || {}).length,
      });
      submitStage = 'load_survey';
      const surveyRecord = await loadSurveyWithAssignments(id);
      if (!surveyRecord) {
        return {
          status: 404,
          error: { code: 'survey_not_found', message: `Survey not found for identifier ${id}` },
        };
      }

      const surveyId = surveyRecord.id ?? id;
      surveyIdForLogs = surveyId;
      submitStage = 'load_assignment';
      const assignment = await loadSurveyAssignmentForUser(surveyId, context.userId, {
        assignmentId: req.body?.assignmentId ?? req.body?.assignment_id ?? null,
        orgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
        allowSelfEnroll: false,
      });

      let resolvedAssignment = assignment;
      if (!supabase && isDemoOrTestMode) {
        e2eStore.assignments = Array.isArray(e2eStore.assignments) ? e2eStore.assignments : [];
        const requestedAssignmentId = req.body?.assignmentId ?? req.body?.assignment_id ?? null;
        const contextOrgIds = Array.isArray(context.organizationIds)
          ? context.organizationIds.map((value) => String(value))
          : [];

        const findMatchingAssignment = () => {
          const rows = e2eStore.assignments.filter((row) => {
            if (!row) return false;
            const assignmentType = row.assignment_type ?? row.assignmentType ?? null;
            if (assignmentType && assignmentType !== surveyAssignmentType) return false;
            const assignmentSurveyId = row.survey_id ?? row.surveyId ?? null;
            if (String(assignmentSurveyId) !== String(surveyId)) return false;
            if (row.active === false) return false;
            return true;
          });

          if (requestedAssignmentId) {
            const direct = rows.find((row) => String(row?.id ?? '') === String(requestedAssignmentId));
            if (!direct) return null;
            const directUserId = direct.user_id ?? direct.userId ?? null;
            if (directUserId && String(directUserId).toLowerCase() !== String(context.userId).toLowerCase()) return null;
            const directOrgId = direct.organization_id ?? direct.organizationId ?? direct.org_id ?? direct.orgId ?? null;
            if (directOrgId && contextOrgIds.length > 0 && !contextOrgIds.includes(String(directOrgId))) return null;
            return direct;
          }

          const userScoped = rows.find((row) => {
            const rowUserId = row.user_id ?? row.userId ?? null;
            return rowUserId && String(rowUserId).toLowerCase() === String(context.userId).toLowerCase();
          });
          if (userScoped) return userScoped;

          return (
            rows.find((row) => {
              const rowUserId = row.user_id ?? row.userId ?? null;
              if (rowUserId !== null) return false;
              const rowOrgId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
              if (!rowOrgId) return true;
              return contextOrgIds.includes(String(rowOrgId));
            }) || null
          );
        };

        resolvedAssignment = findMatchingAssignment();

        if (resolvedAssignment && (resolvedAssignment.user_id ?? resolvedAssignment.userId ?? null) === null) {
          const now = new Date().toISOString();
          const userScopedAssignment = {
            ...resolvedAssignment,
            id: `survey-asn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            user_id: context.userId,
            status: resolvedAssignment.status ?? 'assigned',
            active: true,
            metadata: {
              ...(resolvedAssignment.metadata && typeof resolvedAssignment.metadata === 'object'
                ? resolvedAssignment.metadata
                : {}),
              assigned_via: 'org_rollup',
            },
            created_at: now,
            updated_at: now,
          };
          e2eStore.assignments.push(userScopedAssignment);
          resolvedAssignment = userScopedAssignment;
        }
      }

      if ((req.body?.assignmentId || req.body?.assignment_id) && !resolvedAssignment) {
        return {
          status: 404,
          error: { code: 'assignment_not_found', message: 'Assignment not found for this survey and learner.' },
        };
      }

      const metadataInput = typeof req.body?.metadata === 'object' && req.body.metadata !== null ? req.body.metadata : {};
      const assignmentMetadata =
        resolvedAssignment?.metadata && typeof resolvedAssignment.metadata === 'object' ? resolvedAssignment.metadata : {};
      let enrichedMetadata = { ...metadataInput };
      const isHdiSubmission =
        isHdiAssessment(surveyRecord) ||
        String(metadataInput.assessmentType ?? '').toLowerCase() === 'hdi' ||
        String(assignmentMetadata.assessmentType ?? '').toLowerCase() === 'hdi';

      if (isHdiSubmission && !isDraftSave) {
        const administrationType = normalizeHdiAdministrationType(
          req.body?.administrationType ??
            metadataInput.administrationType ??
            assignmentMetadata.administrationType,
        );
        const linkedAssessmentId = normalizeHdiLinkedAssessmentId(
          req.body?.linkedAssessmentId ??
            metadataInput.linkedAssessmentId ??
            assignmentMetadata.linkedAssessmentId ??
            null,
        );
        const scoring = scoreHdiSubmission({ survey: surveyRecord, responses });
        if (!scoring?.validation?.isValid) {
          return {
            status: 400,
            error: {
              code: 'invalid_hdi_submission',
              message: 'All 36 HDI items require valid Likert values (1-5).',
              details: scoring.validation,
            },
          };
        }

        const participantIdentity = buildParticipantIdentity({
          userId: context.userId,
          userEmail: context.userEmail ?? null,
          metadata: metadataInput,
          assignmentMetadata,
        });
        const participantKeys = participantIdentity.participantKeys;
        const contractValidation = validateHdiSubmissionContract({
          administrationType,
          linkedAssessmentId,
          participantKeys,
        });
        if (!contractValidation.ok) {
          return {
            status: 400,
            error: {
              code: contractValidation.code,
              message: contractValidation.message,
            },
          };
        }

        const participant = {
          userId: context.userId,
          participantKey: participantIdentity.participantKey,
          participantKeys,
          organizationId: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
        };
        const profile = buildHdiProfile({ scoring });
        const report = buildHdiReport({ participant, scoring, profile });

        let prePostComparison = null;
        if (administrationType === 'post' || administrationType === 'pulse') {
          let historicalRows = [];
          let historyError = null;
          if (supabase) {
            const historyResponse = await supabase
              .from('survey_responses')
              .select('*')
              .eq('survey_id', surveyId)
              .eq('user_id', context.userId)
              .order('completed_at', { ascending: false, nullsFirst: false })
              .limit(50);
            historicalRows = historyResponse.data || [];
            historyError = historyResponse.error || null;
          }
          if (!historyError && Array.isArray(historicalRows) && historicalRows.length > 0) {
            const currentRecord = {
              id: null,
              userId: context.userId,
              participantKeys,
              linkedAssessmentId,
              administrationType,
              scoring,
              report,
            };
            const preRecord = findLatestHdiPreRecord(historicalRows, currentRecord);
            if (linkedAssessmentId && !preRecord) {
              return {
                status: 400,
                error: {
                  code: 'invalid_hdi_linked_assessment',
                  message: 'linkedAssessmentId does not resolve to a valid pre assessment for this participant.',
                },
              };
            }
            if (administrationType === 'post' && !preRecord) {
              return {
                status: 409,
                error: {
                  code: 'missing_hdi_pre_assessment',
                  message: 'Post assessment requires a matching pre assessment record.',
                },
              };
            }
            if (preRecord?.report) {
              prePostComparison = compareHdiReports({ preReport: preRecord.report, postReport: report });
            } else if (preRecord) {
              prePostComparison = buildHdiComparison({
                pre: preRecord,
                post: {
                  id: null,
                  userId: context.userId,
                  participantKeys,
                  linkedAssessmentId,
                  administrationType,
                  scoring,
                  report,
                },
              });
            }
          } else if (administrationType === 'post') {
            return {
              status: 409,
              error: {
                code: 'missing_hdi_pre_assessment',
                message: 'Post assessment requires a matching pre assessment record.',
              },
            };
          }
        }

        enrichedMetadata = {
          ...metadataInput,
          assessmentType: 'hdi',
          administrationType,
          linkedAssessmentId,
          participantKey: participantIdentity.participantKey,
          participantKeys,
          hdiContractVersion: hdiMetadataContractVersion,
          participant: {
            ...(assignmentMetadata.participant && typeof assignmentMetadata.participant === 'object'
              ? assignmentMetadata.participant
              : {}),
            ...(metadataInput.participant && typeof metadataInput.participant === 'object'
              ? metadataInput.participant
              : {}),
          },
          hdi: {
            scoring,
            profile,
            report,
            administrationType,
            linkedAssessmentId,
            participantKeys,
            contractVersion: hdiMetadataContractVersion,
            computedAt: new Date().toISOString(),
            prePostComparison,
          },
        };
      }

      const nowIso = new Date().toISOString();
      const responsePayload = {
        survey_id: surveyId,
        user_id: context.userId,
        organization_id: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
        response: responses,
        response_text: null,
        question_id: null,
        rating: null,
        metadata: enrichedMetadata,
        status: submissionStatus,
        assignment_id: resolvedAssignment?.id ?? null,
        completed_at: isDraftSave ? null : nowIso,
      };
      delete responsePayload.org_id;

      if (!supabase && isDemoOrTestMode) {
        const inserted = {
          id: `survey-response-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...responsePayload,
          created_at: nowIso,
          updated_at: nowIso,
        };

        e2eStore.surveyResponses = Array.isArray(e2eStore.surveyResponses) ? e2eStore.surveyResponses : [];
        e2eStore.surveyResponses.push(inserted);

        if (resolvedAssignment?.id) {
          const assignmentRow = (e2eStore.assignments || []).find((row) => row?.id === resolvedAssignment.id);
          if (assignmentRow) {
            assignmentRow.status = submissionStatus;
            assignmentRow.active = true;
            assignmentRow.metadata = {
              ...(assignmentRow.metadata && typeof assignmentRow.metadata === 'object' ? assignmentRow.metadata : {}),
              ...(isDraftSave
                ? {
                    last_progress_saved_at: nowIso,
                    draft_response: responses,
                    last_response_status: 'in-progress',
                  }
                : {
                    last_completed_at: nowIso,
                    draft_response: responses,
                    completion_audit: {
                      completed_by: context.userId,
                      completed_at: nowIso,
                    },
                    last_response_status: 'completed',
                  }),
            };
            assignmentRow.updated_at = nowIso;
          }
          logSurveyAssignmentEvent(isDraftSave ? 'survey_assignment_progress_saved' : 'survey_assignment_completed', {
            requestId: req.requestId ?? null,
            surveyId,
            organizationCount: resolvedAssignment.organization_id ? 1 : 0,
            userCount: 1,
            insertedRowCount: 0,
            skippedRowCount: 0,
            invalidTargetIds: [],
            metadata: { assignmentId: resolvedAssignment.id },
          });
        }

        const assignedTo = createEmptyAssignedTo();
        const orgSet = new Set();
        const userSet = new Set();
        for (const assignmentRow of e2eStore.assignments || []) {
          if (!assignmentRow) continue;
          const assignmentType = assignmentRow.assignment_type ?? assignmentRow.assignmentType ?? null;
          if (assignmentType && assignmentType !== surveyAssignmentType) continue;
          const assignmentSurveyId = assignmentRow.survey_id ?? assignmentRow.surveyId ?? null;
          if (String(assignmentSurveyId) !== String(surveyId)) continue;
          const orgId = assignmentRow.organization_id ?? assignmentRow.organizationId ?? assignmentRow.org_id ?? assignmentRow.orgId;
          if (orgId) orgSet.add(String(orgId));
          const userId = assignmentRow.user_id ?? assignmentRow.userId ?? null;
          if (userId) userSet.add(String(userId));
        }
        assignedTo.organizationIds = Array.from(orgSet);
        assignedTo.userIds = Array.from(userSet);
        updateDemoSurveyAssignments(surveyId, assignedTo);
        persistE2EStore();

        return { status: isDraftSave ? 200 : 201, data: inserted };
      }

      submitStage = 'insert_response_primary';
      let surveyResp = null;
      let surveyResponseInsertPayload = { ...responsePayload };
      for (let attempt = 0; attempt < 8; attempt += 1) {
        surveyResp = await supabase.from('survey_responses').insert(surveyResponseInsertPayload).select('*');
        if (!surveyResp?.error) break;

        const extractedMissingColumn = normalizeColumnIdentifier(extractMissingColumnName(surveyResp.error));
        const parsedMissingColumn = (() => {
          const message = String(surveyResp?.error?.message || '');
          const match = message.match(/'([a-zA-Z0-9_]+)'/);
          return match?.[1] ? normalizeColumnIdentifier(match[1]) : null;
        })();
        const missingColumn = extractedMissingColumn || parsedMissingColumn;
        if (!isMissingColumnError(surveyResp.error) || !missingColumn) break;
        if (!Object.prototype.hasOwnProperty.call(surveyResponseInsertPayload, missingColumn)) break;
        submitStage = `insert_response_retry_drop_${missingColumn}`;
        delete surveyResponseInsertPayload[missingColumn];
      }

      if (surveyResp.error) throw surveyResp.error;
      submitStage = 'insert_response_success';
      const inserted = firstRow(surveyResp);

      if (isHdiSubmission && inserted?.id && enrichedMetadata?.hdi) {
        const hdiPayload = enrichedMetadata.hdi;
        const report = hdiPayload.report ?? null;
        const scoring = hdiPayload.scoring ?? null;
        const profile = hdiPayload.profile ?? report?.profile ?? null;
        try {
          submitStage = 'persist_hdi_results';
          await supabase.from('hdi_assessment_results').upsert(
            {
              survey_response_id: inserted.id,
              survey_id: surveyId,
              user_id: context.userId,
              organization_id: resolvedAssignment?.organization_id ?? context.activeOrganizationId ?? null,
              stage_scores: report?.stageScores ?? scoring?.stageScores ?? {},
              normalized_scores: report?.normalizedScores ?? scoring?.normalizedScores ?? {},
              do_score: scoring?.developmentalOrientation?.score ?? scoring?.doScore ?? null,
              stage_placement: report?.stagePlacement ?? null,
              profile: profile ?? null,
              feedback: {
                summary: report?.summary ?? null,
                strengths: report?.strengths ?? [],
                growthAreas: report?.growthAreas ?? [],
                nextSteps: report?.nextSteps ?? [],
              },
              comparison: hdiPayload.prePostComparison ?? null,
            },
            { onConflict: 'survey_response_id' },
          );
        } catch (persistError) {
          logger.warn('hdi_result_persist_skipped', {
            surveyId,
            responseId: inserted.id,
            message: persistError?.message ?? String(persistError),
            code: persistError?.code ?? null,
          });
        }
      }

      if (resolvedAssignment?.id) {
        submitStage = 'update_assignment';
        const mergedMetadata = {
          ...(resolvedAssignment.metadata && typeof resolvedAssignment.metadata === 'object' ? resolvedAssignment.metadata : {}),
          ...(isDraftSave
            ? {
                last_progress_saved_at: nowIso,
                draft_response: responses,
                last_response_status: 'in-progress',
              }
            : {
                last_completed_at: nowIso,
                draft_response: responses,
                completion_audit: {
                  completed_by: context.userId,
                  completed_at: nowIso,
                },
                last_response_status: 'completed',
              }),
        };
        const assignmentUpdateResult = await supabase
          .from('assignments')
          .update({ status: submissionStatus, active: true, metadata: mergedMetadata })
          .eq('id', resolvedAssignment.id)
          .select('id,status,active,metadata')
          .maybeSingle();
        if (assignmentUpdateResult.error) throw assignmentUpdateResult.error;
        const updatedAssignment = assignmentUpdateResult.data;
        const completionAuditAt = updatedAssignment?.metadata?.completion_audit?.completed_at ?? null;
        const saveAuditAt = updatedAssignment?.metadata?.last_progress_saved_at ?? null;
        const assignmentUpdateVerified = isDraftSave
          ? Boolean(updatedAssignment && updatedAssignment.status === 'in-progress' && updatedAssignment.active === true && saveAuditAt)
          : Boolean(updatedAssignment && updatedAssignment.status === 'completed' && updatedAssignment.active === true && completionAuditAt);
        if (!assignmentUpdateVerified) {
          const assignmentUpdateVerificationError = new Error('survey_assignment_completion_verification_failed');
          assignmentUpdateVerificationError.code = 'survey_assignment_completion_verification_failed';
          assignmentUpdateVerificationError.statusCode = 503;
          assignmentUpdateVerificationError.meta = { assignmentId: resolvedAssignment.id, surveyId };
          throw assignmentUpdateVerificationError;
        }
        logSurveyAssignmentEvent(isDraftSave ? 'survey_assignment_progress_saved' : 'survey_assignment_completed', {
          requestId: req.requestId ?? null,
          surveyId,
          organizationCount: resolvedAssignment.organization_id ? 1 : 0,
          userCount: 1,
          insertedRowCount: 0,
          skippedRowCount: 0,
          invalidTargetIds: [],
          metadata: { assignmentId: resolvedAssignment.id },
        });
        try {
          submitStage = 'refresh_aggregates';
          await refreshSurveyAssignmentAggregates(surveyId);
        } catch (aggregateError) {
          logger.warn('survey_assignment_aggregate_refresh_skipped_after_submit', {
            surveyId,
            assignmentId: resolvedAssignment.id,
            code: aggregateError?.code ?? null,
            message: aggregateError?.message ?? String(aggregateError),
          });
        }
      }

      submitStage = 'complete_success';
      logger.info('[survey] learner_submit_success', {
        requestId: req.requestId ?? null,
        route: '/api/client/surveys/:id/submit',
        userId: context.userId,
        surveyId,
        assignmentId: resolvedAssignment?.id ?? null,
        status: submissionStatus,
        responseFieldCount: Object.keys(responses || {}).length,
      });
      return { status: isDraftSave ? 200 : 201, data: inserted };
    } catch (error) {
      logger.error('[survey] learner_submit_failure', {
        requestId: req.requestId ?? null,
        route: '/api/client/surveys/:id/submit',
        userId: context.userId,
        surveyId: surveyIdForLogs,
        stage: submitStage,
        status: submissionStatus,
        code: error?.code ?? null,
        message: error?.message ?? String(error),
      });
      logSurveyAssignmentEvent('survey_assignment_failed', {
        requestId: req.requestId ?? null,
        surveyId: surveyIdForLogs,
        organizationCount: 0,
        userCount: 1,
        insertedRowCount: 0,
        skippedRowCount: 0,
        invalidTargetIds: [],
        metadata: { stage: submitStage, error: error?.message ?? String(error) },
      });
      return {
        status: error?.statusCode ?? 500,
        error: {
          code: error?.code ?? 'survey_submit_failed',
          message: error?.statusCode ? error?.message ?? 'Unable to submit survey response' : 'Unable to submit survey response',
        },
      };
    }
  };

  const getClientSurveyResults = async ({ req, res }) => {
    if (!ensureSupabase(res)) return null;
    const context = requireUserContext(req, res);
    if (!context) return null;

    const { id } = req.params;
    const surveyRecord = await loadSurveyWithAssignments(id);
    if (!surveyRecord) {
      return {
        status: 404,
        error: { code: 'survey_not_found', message: `Survey not found for identifier ${id}` },
      };
    }

    try {
      const surveyId = surveyRecord.id ?? id;
      const assignment = await loadSurveyAssignmentForUser(surveyId, context.userId, {
        assignmentId: req.query.assignmentId ?? req.query.assignment_id ?? null,
        orgIds: Array.isArray(context.organizationIds) ? context.organizationIds : [],
        allowSelfEnroll: false,
      });

      if ((req.query.assignmentId || req.query.assignment_id) && !assignment) {
        return {
          status: 404,
          error: { code: 'assignment_not_found', message: 'Assignment not found for this survey and learner.' },
        };
      }

      let data = [];
      if (!supabase && isDemoOrTestMode) {
        const responseRows = Array.isArray(e2eStore?.surveyResponses) ? e2eStore.surveyResponses : [];
        data = responseRows
          .filter((row) => {
            if (!row) return false;
            if (String(row.survey_id ?? row.surveyId ?? '') !== String(surveyRecord.id)) return false;
            if (String(row.user_id ?? row.userId ?? '').toLowerCase() !== String(context.userId).toLowerCase()) return false;
            if (assignment?.id && String(row.assignment_id ?? row.assignmentId ?? '') !== String(assignment.id)) return false;
            return true;
          })
          .sort((left, right) => {
            const leftTime = Date.parse(left?.completed_at ?? left?.updated_at ?? left?.created_at ?? '') || 0;
            const rightTime = Date.parse(right?.completed_at ?? right?.updated_at ?? right?.created_at ?? '') || 0;
            return rightTime - leftTime;
          })
          .slice(0, 100);
      } else {
        let responseQuery = supabase
          .from('survey_responses')
          .select('*')
          .eq('survey_id', surveyRecord.id)
          .eq('user_id', context.userId)
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(100);

        if (assignment?.id) {
          responseQuery = responseQuery.eq('assignment_id', assignment.id);
        }

        const responseResult = await responseQuery;
        if (responseResult.error) throw responseResult.error;
        data = responseResult.data || [];
      }

      const records = (data || []).map((row) => toHdiRecord(row)).filter(Boolean);
      const latest = records[0] ?? null;
      const preRecord = latest ? findLatestHdiPreRecord(data || [], latest) : null;
      const comparison = latest && preRecord && latest.id !== preRecord.id
        ? buildHdiComparison({ pre: preRecord, post: latest })
        : null;

      return {
        status: 200,
        data: createHdiResponseEnvelope(
          hdiResponseShapes.LEARNER_RESULTS,
          {
            surveyId: surveyRecord.id,
            assignmentId: assignment?.id ?? null,
            latest,
            comparison,
          },
          { userId: context.userId },
        ).data,
      };
    } catch (error) {
      logger.error('client_hdi_results_failed', {
        surveyId: surveyRecord.id,
        userId: context.userId,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      return {
        status: 500,
        error: { code: 'survey_results_failed', message: 'Unable to load survey results' },
      };
    }
  };

  return {
    listClientSurveys,
    submitClientSurvey,
    getClientSurveyResults,
  };
};

const normalizeColumnIdentifier = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim().replace(/"/g, '') : null;

const extractMissingColumnName = (error) => {
  const message = String(error?.message || '');
  const match = message.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
  return match?.[1] ?? null;
};

const isMissingColumnError = (error) =>
  String(error?.code || '').toUpperCase() === '42703' || /column .* does not exist/i.test(String(error?.message || ''));

export default createClientSurveysService;
