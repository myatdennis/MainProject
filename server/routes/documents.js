import express from 'express';
import { createDocumentsService } from '../services/documentsService.js';
import { createDocumentsController } from '../controllers/documentsController.js';

export const createDocumentsRouter = ({
  logger,
  supabase,
  e2eStore,
  isDemoOrTestMode,
  ensureDocumentsSchemaOrRespond,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  requireAdmin,
  requireOrgAdmin,
  pickOrgId,
  coerceOrgIdentifierToUuid,
  isUuid,
  normalizeOrgIdValue,
  hasOrgAdminRole,
  filterE2EDocumentsForAdmin,
  buildE2EDocumentRecord,
  savePersistedData,
  createSignedDocumentUrl,
  refreshDocumentSignedUrls,
  resolveDocumentTargetOrg,
  buildDocumentsInsertPayload,
  executeDocumentInsert,
  buildDocumentCreateFailure,
  removeDocumentStorageObject,
  documentsBucket,
  documentUrlTtlSeconds,
  firstRow,
  normalizeLegacyOrgInput,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createDocumentsService({
    logger,
    supabase,
    e2eStore,
    isDemoOrTestMode,
    ensureDocumentsSchemaOrRespond,
    ensureSupabase,
    requireUserContext,
    requireOrgAccess,
    pickOrgId,
    coerceOrgIdentifierToUuid,
    isUuid,
    normalizeOrgIdValue,
    hasOrgAdminRole,
    filterE2EDocumentsForAdmin,
    buildE2EDocumentRecord,
    savePersistedData,
    createSignedDocumentUrl,
    refreshDocumentSignedUrls,
    resolveDocumentTargetOrg,
    buildDocumentsInsertPayload,
    executeDocumentInsert,
    buildDocumentCreateFailure,
    removeDocumentStorageObject,
    documentsBucket,
    documentUrlTtlSeconds,
    firstRow,
    normalizeLegacyOrgInput,
  });
  const controller = createDocumentsController({ logger, service });

  router.get('/client/documents', controller.clientList);
  router.post('/client/documents/:id/download', controller.clientDownload);

  router.get('/admin/documents', requireOrgAdmin, controller.adminList);
  router.post('/admin/documents', requireAdmin, controller.adminCreate);
  router.put('/admin/documents/:id', requireAdmin, controller.adminUpdate);
  router.post('/admin/documents/:id/download', requireAdmin, controller.adminDownload);
  router.delete('/admin/documents/:id', requireAdmin, controller.adminDelete);

  return router;
};

export default createDocumentsRouter;
