import express from 'express';
import { createClientSurveyAssignmentsService } from '../services/clientSurveyAssignmentsService.js';
import { createClientSurveyAssignmentsController } from '../controllers/clientSurveyAssignmentsController.js';

export const createClientSurveyAssignmentsRouter = ({
  logger,
  supabase,
  e2eStore,
  persistE2EStore,
  isDemoOrTestMode,
  surveyAssignmentType,
  ensureSurveyAssignmentsForUserFromOrgScope,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  isUuid,
  runTimedQuery,
  surveyAssignmentSelect,
  isSupabaseTransientError,
  loadSurveyRecordsByAssignmentIds,
  requireUserContext,
  resolveOrgScopeFromRequest,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createClientSurveyAssignmentsService({
    supabase,
    logger,
    e2eStore,
    persistE2EStore,
    isDemoOrTestMode,
    surveyAssignmentType,
    ensureSurveyAssignmentsForUserFromOrgScope,
    detectAssignmentsUserIdUuidColumnAvailability,
    getAssignmentsOrgColumnName,
    isUuid,
    runTimedQuery,
    surveyAssignmentSelect,
    isSupabaseTransientError,
    loadSurveyRecordsByAssignmentIds,
  });
  const controller = createClientSurveyAssignmentsController({
    logger,
    service,
    requireUserContext,
    resolveOrgScopeFromRequest,
  });

  router.get('/assigned', controller.listAssigned);

  return router;
};

export default createClientSurveyAssignmentsRouter;
