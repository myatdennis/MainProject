import express from 'express';
import { createAdminSurveyAssignmentsService } from '../services/adminSurveyAssignmentsService.js';
import { createAdminSurveyAssignmentsController } from '../controllers/adminSurveyAssignmentsController.js';

export const createAdminSurveyAssignmentsRouter = ({
  supabase,
  sql,
  logger,
  e2eStore,
  shouldUseAssignmentWriteFallback,
  isDemoOrTestMode,
  surveyAssignmentType,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  fetchOrgMembersWithProfiles,
  coerceOrgIdentifierToUuid,
  InvalidOrgIdentifierError,
  isUuid,
  refreshSurveyAssignmentAggregates,
  notifyAssignmentRecipients,
  logSurveyAssignmentEvent,
  createEmptyAssignedTo,
  updateDemoSurveyAssignments,
  isInfrastructureUnavailableError,
  ensureSupabase,
  ensureAdminSurveySchemaOrRespond,
  loadSurveyWithAssignments,
  rememberSurveyIdentifierAlias,
  normalizeLegacyOrgInput,
  normalizeAssignmentUserIds,
  deriveSurveyAssignmentOrgScope,
  requireUserContext,
  normalizeOrgIdValue,
  pickOrgId,
  requireOrgAccess,
  resolveSurveyIdentifierToCanonicalId,
  clampNumber,
  surveyAssignmentSelect,
}) => {
  const router = express.Router({ mergeParams: true });

  const service = createAdminSurveyAssignmentsService({
    supabase,
    sql,
    logger,
    e2eStore,
    shouldUseAssignmentWriteFallback,
    isDemoOrTestMode,
    surveyAssignmentType,
    detectAssignmentsUserIdUuidColumnAvailability,
    getAssignmentsOrgColumnName,
    fetchOrgMembersWithProfiles,
    coerceOrgIdentifierToUuid,
    InvalidOrgIdentifierError,
    isUuid,
    refreshSurveyAssignmentAggregates,
    notifyAssignmentRecipients,
    logSurveyAssignmentEvent,
    createEmptyAssignedTo,
    updateDemoSurveyAssignments,
    isInfrastructureUnavailableError,
  });
  service.supabaseAvailable = Boolean(supabase);
  service.requireOrgAccess = requireOrgAccess;
  service.logSurveyAssignmentEvent = logSurveyAssignmentEvent;
  service.loadMembershipRows = async (normalizedUserIds) => {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('user_id, organization_id, status, is_active, accepted_at')
      .in('user_id', normalizedUserIds)
      .eq('status', 'active');
    if (error) throw error;
    return data;
  };

  const controller = createAdminSurveyAssignmentsController({
    logger,
    service,
    ensureSupabase,
    ensureAdminSurveySchemaOrRespond,
    loadSurveyWithAssignments,
    rememberSurveyIdentifierAlias,
    normalizeLegacyOrgInput,
    normalizeAssignmentUserIds,
    deriveSurveyAssignmentOrgScope,
    requireUserContext,
    normalizeOrgIdValue,
    pickOrgId,
    resolveSurveyIdentifierToCanonicalId,
    clampNumber,
    surveyAssignmentSelect,
    getAssignmentsOrgColumnName,
  });

  router.post('/:id/assign', controller.assign);
  router.get('/:id/assignments', controller.listAssignments);
  router.delete('/:surveyId/assignments/:assignmentId', controller.deleteAssignment);

  return router;
};

export default createAdminSurveyAssignmentsRouter;
