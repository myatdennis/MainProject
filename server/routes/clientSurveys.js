import express from 'express';
import { createClientSurveysService } from '../services/clientSurveysService.js';
import { createClientSurveysController } from '../controllers/clientSurveysController.js';

export const createClientSurveysRouter = ({
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
  const router = express.Router({ mergeParams: true });
  const service = createClientSurveysService({
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
  });
  const controller = createClientSurveysController({ logger, service });

  router.get('/', controller.list);
  router.post('/:id/submit', controller.submit);
  router.get('/:id/results', controller.results);

  return router;
};

export default createClientSurveysRouter;
