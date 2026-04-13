import express from 'express';
import { createCourseAssignmentsService } from '../services/courseAssignmentsService.js';
import { createCourseAssignmentsController } from '../controllers/courseAssignmentsController.js';

export const createCourseAssignmentsRouter = ({
  supabase,
  logger,
  e2eStore,
  isDemoOrTestMode,
  isDemoMode,
  defaultSandboxOrgId,
  shouldUseAssignmentWriteFallback,
  normalizeOrgIdValue,
  normalizeAssignmentRow,
  ensureOrgFieldCompatibility,
  ensureCourseAssignmentsForUserFromOrgScope,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  getOrganizationMembershipsOrgColumnName,
  getOrganizationMembershipsStatusColumnName,
  isUuid,
  resolveUserIdentifierToUuid,
  isMissingRelationError,
  isMissingColumnError,
  resolveCourseIdentifierToUuid,
  coerceOrgIdentifierToUuid,
  sanitizeAssignmentRecordForSchema,
  notifyAssignmentRecipients,
  broadcastToTopic,
  logCourseRequestEvent,
  logAdminCoursesError,
  normalizeLegacyOrgInput,
  pickOrgId,
  assertUuid,
  summarizeHeaders,
  summarizeRequestBody,
  isInfrastructureUnavailableError,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  isFallbackMode,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createCourseAssignmentsService({
    supabase,
    logger,
    e2eStore,
    isDemoOrTestMode,
    isDemoMode,
    defaultSandboxOrgId,
    shouldUseAssignmentWriteFallback,
    normalizeOrgIdValue,
    normalizeAssignmentRow,
    ensureOrgFieldCompatibility,
    ensureCourseAssignmentsForUserFromOrgScope,
    detectAssignmentsUserIdUuidColumnAvailability,
    getAssignmentsOrgColumnName,
    getOrganizationMembershipsOrgColumnName,
    getOrganizationMembershipsStatusColumnName,
    isUuid,
    resolveUserIdentifierToUuid,
    isMissingRelationError,
    isMissingColumnError,
    resolveCourseIdentifierToUuid,
    coerceOrgIdentifierToUuid,
    sanitizeAssignmentRecordForSchema,
    notifyAssignmentRecipients,
    broadcastToTopic,
    logCourseRequestEvent,
    logAdminCoursesError,
    normalizeLegacyOrgInput,
    pickOrgId,
    assertUuid,
    summarizeHeaders,
    summarizeRequestBody,
    isInfrastructureUnavailableError,
  });
  const controller = createCourseAssignmentsController({
    logger,
    service,
    ensureSupabase,
    requireUserContext,
    requireOrgAccess,
    isFallbackMode,
  });

  router.post('/admin/courses/:id/assign', controller.adminAssign);
  router.get('/client/assignments', controller.clientList);
  router.get('/admin/courses/:id/assignments', controller.adminList);
  router.delete('/admin/assignments/:assignmentId', controller.adminDelete);

  return router;
};

export default createCourseAssignmentsRouter;
