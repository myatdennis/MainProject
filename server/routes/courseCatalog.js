import express from 'express';
import { createCourseCatalogService } from '../services/courseCatalogService.js';
import { createCourseCatalogController } from '../controllers/courseCatalogController.js';

export const createCourseCatalogRouter = ({
  authenticate,
  logger,
  supabase,
  getSupabase,
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
  requireAdminAccess,
}) => {
  const router = express.Router({ mergeParams: true });

  const service = createCourseCatalogService({
    logger,
    supabase,
    getSupabase,
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
  const logAdminCoursesEntry = (req, _res, next) => {
    console.log('[ROUTE ENTRY]', {
      route: '/api/admin/courses',
      hasUser: !!req.user,
      userId: req.user?.id || req.user?.userId || null,
      orgId: req.organizationId,
    });
    console.log('[COURSES ENTRY]', {
      hasUser: !!req.user,
      userId: req.user?.id,
      orgId: req.organizationId,
      activeOrgId: req.activeOrgId,
    });
    return next();
  };

  router.get('/admin/courses', logAdminCoursesEntry, requireAdminAccess || authenticate, controller.adminList);
  router.get('/admin/courses/:identifier', requireAdminAccess || authenticate, controller.adminDetail);
  router.get('/client/courses', authenticate, controller.clientList);
  router.get('/client/courses/:courseIdentifier', authenticate, controller.clientDetail);

  return router;
};

export default createCourseCatalogRouter;
