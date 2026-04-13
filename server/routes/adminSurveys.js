import express from 'express';
import { createAdminSurveysService } from '../services/adminSurveysService.js';
import { createAdminSurveysController } from '../controllers/adminSurveysController.js';

export const createAdminSurveysRouter = ({
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
  const router = express.Router({ mergeParams: true });

  const service = createAdminSurveysService({
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
  });
  const controller = createAdminSurveysController({ logger, service });

  router.get('/templates/hdi', controller.hdiTemplate);
  router.get('/:id/hdi/participant-report', controller.participantReport);
  router.get('/:id/hdi/cohort-analytics', controller.cohortAnalytics);
  router.get('/:id/hdi/pre-post-comparison', controller.prePostComparison);
  router.get('/:id/results', controller.results);
  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
};

export default createAdminSurveysRouter;
