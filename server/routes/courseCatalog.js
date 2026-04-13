import express from 'express';
import { createCourseCatalogService } from '../services/courseCatalogService.js';
import { createCourseCatalogController } from '../controllers/courseCatalogController.js';

export const createCourseCatalogRouter = ({
  authenticate,
  logger,
  supabase,
  e2eStore,
  nodeEnv,
  isDemoMode,
  isDemoOrTestMode,
  isTestMode,
  defaultSandboxOrgId,
  ensureSupabase,
  requireUserContext,
  pickOrgId,
  coerceOrgIdentifierToUuid,
  isUuid,
  hasOrgAdminRole,
  normalizeOrgIdValue,
  requireOrgAccess,
  parseBooleanParam,
  parsePaginationParams,
  sanitizeIlike,
  runSupabaseReadQueryWithRetry,
  runSupabaseTransientRetry,
  resolveOrgScopeForRequest,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  ensureOrgFieldCompatibility,
  ensureCourseStructureLoaded,
  normalizeModuleGraph,
  attachCompletionRuleForResponse,
  e2eFindCourse,
  logAdminCoursesError,
  logStructuredError,
  courseModulesWithLessonFields,
  courseModulesNoLessonsFields,
  courseWithModulesLessonsSelect,
  moduleLessonsForeignTable,
}) => {
  const router = express.Router({ mergeParams: true });

  const service = createCourseCatalogService({
    logger,
    supabase,
    e2eStore,
    nodeEnv,
    isDemoMode,
    isDemoOrTestMode,
    isTestMode,
    defaultSandboxOrgId,
    ensureSupabase,
    requireUserContext,
    pickOrgId,
    coerceOrgIdentifierToUuid,
    isUuid,
    hasOrgAdminRole,
    normalizeOrgIdValue,
    requireOrgAccess,
    parseBooleanParam,
    parsePaginationParams,
    sanitizeIlike,
    runSupabaseReadQueryWithRetry,
    runSupabaseTransientRetry,
    resolveOrgScopeForRequest,
    detectAssignmentsUserIdUuidColumnAvailability,
    getAssignmentsOrgColumnName,
    ensureOrgFieldCompatibility,
    ensureCourseStructureLoaded,
    normalizeModuleGraph,
    attachCompletionRuleForResponse,
    e2eFindCourse,
    logAdminCoursesError,
    logStructuredError,
    courseModulesWithLessonFields,
    courseModulesNoLessonsFields,
    courseWithModulesLessonsSelect,
    moduleLessonsForeignTable,
  });
  const controller = createCourseCatalogController({ logger, service });

  router.get('/admin/courses', authenticate, controller.adminList);
  router.get('/admin/courses/:identifier', authenticate, controller.adminDetail);
  router.get('/client/courses', controller.clientList);
  router.get('/client/courses/:courseIdentifier', controller.clientDetail);

  return router;
};

export default createCourseCatalogRouter;
