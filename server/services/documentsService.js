import { createDocumentsRepository } from '../repositories/documentsRepository.js';
import { buildDocumentUpdatePayload, validateAdminDocumentCreatePayload } from '../validators/documents.js';

export const createDocumentsService = ({
  supabase,
  logger,
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
}) => {
  const repository = supabase ? createDocumentsRepository({ supabase }) : null;
  const collectRequestOrganizationIds = (context = {}, req = {}) => {
    const ids = new Set();
    const push = (candidate) => {
      const normalized = normalizeOrgIdValue(candidate);
      if (normalized) ids.add(normalized);
    };

    const membershipSources = [
      ...(Array.isArray(context.memberships) ? context.memberships : []),
      ...(Array.isArray(req.user?.memberships) ? req.user.memberships : []),
      ...(Array.isArray(req.user?.app_metadata?.memberships) ? req.user.app_metadata.memberships : []),
    ];
    membershipSources.forEach((membership) => {
      if (!membership || typeof membership !== 'object') return;
      push(membership.orgId ?? membership.organizationId ?? membership.organization_id ?? membership.org_id ?? null);
    });

    [
      ...(Array.isArray(context.organizationIds) ? context.organizationIds : []),
      ...(Array.isArray(req.user?.organizationIds) ? req.user.organizationIds : []),
      ...(Array.isArray(req.user?.organization_ids) ? req.user.organization_ids : []),
      ...(Array.isArray(req.user?.app_metadata?.organization_ids) ? req.user.app_metadata.organization_ids : []),
      ...(Array.isArray(req.user?.app_metadata?.organizationIds) ? req.user.app_metadata.organizationIds : []),
      ...(Array.isArray(req.supabaseJwtUser?.organizationIds) ? req.supabaseJwtUser.organizationIds : []),
      ...(Array.isArray(req.supabaseJwtClaims?.organization_ids) ? req.supabaseJwtClaims.organization_ids : []),
      ...(Array.isArray(req.supabaseJwtClaims?.organizationIds) ? req.supabaseJwtClaims.organizationIds : []),
      ...(Array.isArray(req.supabaseJwtClaims?.app_metadata?.organization_ids)
        ? req.supabaseJwtClaims.app_metadata.organization_ids
        : []),
      ...(Array.isArray(req.supabaseJwtClaims?.app_metadata?.organizationIds)
        ? req.supabaseJwtClaims.app_metadata.organizationIds
        : []),
    ].forEach(push);

    push(context.organizationId);
    push(req.user?.organizationId);
    push(req.user?.organization_id);

    return Array.from(ids);
  };

  const listClientDocuments = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;

    const requestedOrgId =
      pickOrgId(req.query?.orgId, req.query?.org_id, req.query?.organization_id) || context.organizationId || null;
    const resolvedRequestedOrgId = requestedOrgId ? await coerceOrgIdentifierToUuid(req, requestedOrgId) : null;

    if (isDemoOrTestMode) {
      const requestedOrgIds = Array.isArray(context.organizationIds)
        ? context.organizationIds.map((value) => normalizeOrgIdValue(value)).filter(Boolean)
        : [];
      const effectiveOrgIds = new Set(
        [
          ...(resolvedRequestedOrgId ? [resolvedRequestedOrgId] : []),
          ...requestedOrgIds,
        ].filter(Boolean),
      );
      const rows = Array.from(e2eStore.documents.values())
        .filter((row) => {
          if (!row) return false;
          const visibility = String(row.visibility || 'global').toLowerCase();
          const rowOrgId = normalizeOrgIdValue(row.organization_id ?? row.org_id ?? null);
          const rowUserId = row.user_id ?? null;
          if (visibility === 'global') return true;
          if (visibility === 'user') return Boolean(rowUserId) && String(rowUserId) === String(context.userId);
          if (visibility === 'org') return Boolean(rowOrgId) && effectiveOrgIds.has(rowOrgId);
          return false;
        })
        .sort((a, b) => Date.parse(b?.created_at || 0) - Date.parse(a?.created_at || 0));
      return { status: 200, data: rows };
    }

    if (!ensureSupabase(res)) return null;
    if (!(await ensureDocumentsSchemaOrRespond(res, 'client.documents.list'))) return null;

    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (resolvedRequestedOrgId) {
      const userId = context.userId;
      query = query.or(
        `visibility.eq.global,and(visibility.eq.org,organization_id.eq.${resolvedRequestedOrgId}),and(visibility.eq.user,user_id.eq.${userId})`,
      );
    } else {
      query = query.or(`visibility.eq.global,and(visibility.eq.user,user_id.eq.${context.userId})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    await refreshDocumentSignedUrls(data ?? []);
    return { status: 200, data: data ?? [] };
  };

  const listAdminDocuments = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;

    const { user_id, tag, category, search, visibility } = req.query;
    const requestedOrgId = pickOrgId(req.query?.orgId, req.query?.org_id, req.query?.organization_id);
    const resolvedRequestedOrgId = requestedOrgId ? await coerceOrgIdentifierToUuid(req, requestedOrgId) : null;

    if (requestedOrgId && (!resolvedRequestedOrgId || !isUuid(String(resolvedRequestedOrgId).trim()))) {
      return {
        status: 403,
        error: { code: 'org_access_denied', message: 'Organization scope not permitted' },
      };
    }

    const isPlatformAdmin = Boolean(context.isPlatformAdmin);
    const adminOrgIds = Array.isArray(context.memberships)
      ? context.memberships
          .filter((membership) => hasOrgAdminRole(membership.role) && membership.orgId)
          .map((membership) => normalizeOrgIdValue(membership.orgId))
          .filter(Boolean)
      : [];
    const allowedOrgIdSet = new Set(adminOrgIds);

    if (resolvedRequestedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedRequestedOrgId, { write: false, requireOrgAdmin: true });
      if (!access) return null;
      if (!isPlatformAdmin && !allowedOrgIdSet.has(resolvedRequestedOrgId)) {
        return {
          status: 403,
          error: { code: 'org_access_denied', message: 'Organization scope not permitted' },
        };
      }
    }

    if (isDemoOrTestMode) {
      return {
        status: 200,
        data: filterE2EDocumentsForAdmin({
          context,
          requestedOrgId: resolvedRequestedOrgId,
          visibility,
          userId: user_id,
          category,
          tag,
          search,
        }),
        meta: { demo: true },
      };
    }

    if (!ensureSupabase(res)) return null;
    if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.list'))) return null;

    const rows = await repository.listDocuments((query) => {
      let next = query.order('created_at', { ascending: false });
      if (visibility) next = next.eq('visibility', visibility);
      if (resolvedRequestedOrgId) {
        next = next.eq('organization_id', resolvedRequestedOrgId);
      } else if (!isPlatformAdmin) {
        if (adminOrgIds.length > 0) {
          next = next.or(`visibility.eq.global,organization_id.in.(${adminOrgIds.join(',')})`);
        } else {
          next = next.eq('visibility', 'global');
        }
      }
      if (user_id) next = next.eq('user_id', user_id);
      if (category) next = next.eq('category', category);
      if (tag) next = next.contains('tags', [tag]);
      if (search) next = next.ilike('name', `%${search}%`);
      return next;
    });

    return { status: 200, data: rows };
  };

  const createAdminDocument = async ({ req, res }) => {
    normalizeLegacyOrgInput(req.body, { surface: 'admin.documents.create', requestId: req.requestId });
    const context = requireUserContext(req, res);
    if (!context) return null;

    const payload = req.body || {};
    const requestId = req.requestId ?? null;
    logger.info('[admin_documents] create_request', {
      requestId,
      route: '/api/admin/documents',
      userId: context.userId,
      visibility: payload.visibility ?? 'global',
      hasFile: Boolean(payload.storagePath || payload.url),
      payloadKeys: Object.keys(payload).slice(0, 30),
    });

    const validation = validateAdminDocumentCreatePayload(payload, { isUuid });
    if (!validation.ok) {
      return {
        status: validation.status,
        error: {
          code: validation.code,
          message: validation.message,
          details: { fields: validation.fields },
        },
      };
    }

    const explicitOrgId = pickOrgId(
      payload.organization_id,
      payload.organizationId,
      payload.orgId,
      req.query?.orgId,
      req.query?.organization_id,
    );
    const contextOrgIds = collectRequestOrganizationIds(context, req);
    if (!explicitOrgId && contextOrgIds.length > 1) {
      return {
        status: 400,
        error: {
          code: 'explicit_org_selection_required',
          message: 'This document upload is ambiguous across multiple organizations. Select an organization explicitly.',
        },
      };
    }

    try {
      const resolvedOrg = await resolveDocumentTargetOrg(req, res, context, payload, {
        surface: 'admin.documents.create',
      });
      if (!resolvedOrg) return null;
      const organizationId = resolvedOrg.organizationId;

      let storagePath = payload.storagePath ?? null;
      let url = payload.url ?? null;
      let urlExpiresAt = payload.urlExpiresAt ?? null;
      const documentBucket = payload.bucket ?? documentsBucket;

      if (storagePath && (!url || !urlExpiresAt)) {
        const signed = await createSignedDocumentUrl(storagePath, documentUrlTtlSeconds, documentBucket);
        if (signed) {
          url = signed.url;
          urlExpiresAt = signed.expiresAt;
        }
      }

      if (isDemoOrTestMode && !supabase) {
        if (req.headers['x-test-documents-fail'] === 'db') {
          throw Object.assign(new Error('Simulated document metadata insert failure'), { code: 'TEST_DOCUMENT_DB_FAILURE' });
        }
        const demoRow = buildE2EDocumentRecord({
          payload,
          organizationId,
          context,
          url,
          storagePath,
          urlExpiresAt,
          bucket: documentBucket,
        });
        e2eStore.documents.set(demoRow.id, demoRow);
        savePersistedData(e2eStore);
        return { status: 201, data: demoRow };
      }

      if (!ensureSupabase(res)) return null;
      if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.create'))) return null;

      let insertPayload = buildDocumentsInsertPayload({
        payload,
        contextUserId: context.userId,
        organizationId,
        fallbackBucket: documentsBucket,
        url,
        storagePath,
        urlExpiresAt,
      });

      if (!isUuid(String(insertPayload.created_by || '').trim())) {
        insertPayload.metadata = {
          ...(insertPayload.metadata || {}),
          createdByLabel: payload.createdBy ?? null,
        };
        delete insertPayload.created_by;
      }

      const { result: docInsert, insertPayload: effectiveInsertPayload } = await executeDocumentInsert(insertPayload);
      if (docInsert.error) {
        await removeDocumentStorageObject({
          bucket: documentBucket,
          storagePath: effectiveInsertPayload.storage_path ?? storagePath,
        });
        throw docInsert.error;
      }
      return { status: 201, data: firstRow(docInsert) };
    } catch (error) {
      logger.error('[admin_documents] create_failure', {
        requestId,
        route: '/api/admin/documents',
        userId: context.userId,
        error: error instanceof Error ? error.message : String(error),
        code: error?.code ?? null,
      });
      const normalizedFailure = buildDocumentCreateFailure(error);
      return {
        status: normalizedFailure.status,
        error: {
          code: normalizedFailure.body.code ?? normalizedFailure.body.error ?? 'document_create_failed',
          message: normalizedFailure.body.message ?? 'Document metadata could not be saved.',
          details: normalizedFailure.body.meta ?? null,
        },
      };
    }
  };

  const updateAdminDocument = async ({ req, res }) => {
    const { id } = req.params;
    const context = requireUserContext(req, res);
    if (!context) return null;
    const patch = normalizeLegacyOrgInput(req.body || {}, { surface: 'admin.documents.update', requestId: req.requestId });

    try {
      if (isDemoOrTestMode && !supabase) {
        const existingDoc = e2eStore.documents.get(id) ?? null;
        if (!existingDoc) {
          return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
        }
        const currentOrgId = normalizeOrgIdValue(existingDoc.organization_id);
        if (currentOrgId) {
          const access = await requireOrgAccess(req, res, currentOrgId, { write: true });
          if (!access) return null;
        } else if (!context.isPlatformAdmin) {
          return { status: 403, error: { code: 'organization_scope_required', message: 'Document is platform scoped' } };
        }

        const next = { ...existingDoc };
        const updatePayload = buildDocumentUpdatePayload(patch);
        Object.assign(next, updatePayload, { updated_at: new Date().toISOString() });
        e2eStore.documents.set(id, next);
        savePersistedData(e2eStore);
        return { status: 200, data: next };
      }

      if (!ensureSupabase(res)) return null;
      if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.update'))) return null;
      const existingDoc = await repository.selectDocumentById(
        id,
        'id, organization_id, bucket, storage_path, url, url_expires_at, visibility, user_id',
      );
      if (!existingDoc) {
        return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
      }

      const currentOrgId = normalizeOrgIdValue(existingDoc.organization_id);
      if (currentOrgId) {
        const access = await requireOrgAccess(req, res, currentOrgId, { write: true });
        if (!access) return null;
      } else if (!context.isPlatformAdmin) {
        return { status: 403, error: { code: 'organization_scope_required', message: 'Document is platform scoped' } };
      }

      const updatePayload = buildDocumentUpdatePayload(patch);
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'organization_id')) {
        const nextOrgId = normalizeOrgIdValue(updatePayload.organization_id);
        if (!nextOrgId) {
          return { status: 400, error: { code: 'organization_id_required', message: 'organization_id cannot be empty.' } };
        }
        if (nextOrgId !== currentOrgId) {
          const access = await requireOrgAccess(req, res, nextOrgId, { write: true });
          if (!access) return null;
        }
        updatePayload.organization_id = nextOrgId;
      }

      if (Object.keys(updatePayload).length === 0) {
        const docOnly = await repository.selectDocumentById(id);
        return { status: 200, data: docOnly };
      }

      const effectiveStoragePath = updatePayload.storage_path ?? existingDoc.storage_path ?? null;
      const effectiveBucket = updatePayload.bucket ?? existingDoc.bucket ?? documentsBucket;
      const hasExplicitUrl = Object.prototype.hasOwnProperty.call(updatePayload, 'url');
      const hasExplicitUrlExpiry = Object.prototype.hasOwnProperty.call(updatePayload, 'url_expires_at');
      if (effectiveStoragePath && (!hasExplicitUrl || !hasExplicitUrlExpiry)) {
        const signed = await createSignedDocumentUrl(effectiveStoragePath, documentUrlTtlSeconds, effectiveBucket);
        if (signed) {
          if (!hasExplicitUrl) updatePayload.url = signed.url;
          if (!hasExplicitUrlExpiry) updatePayload.url_expires_at = signed.expiresAt;
        }
      }

      const rows = await repository.updateDocumentById(id, updatePayload);
      return { status: 200, data: firstRow({ data: rows }) };
    } catch (error) {
      logger.error('document_update_failed', {
        requestId: req.requestId ?? null,
        documentId: id,
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      });
      throw error;
    }
  };

  const adminDownloadDocument = async ({ req, res }) => {
    const { id } = req.params;
    const context = requireUserContext(req, res);
    if (!context) return null;

    try {
      if (isDemoOrTestMode && !supabase) {
        const existing = e2eStore.documents.get(id) ?? null;
        if (!existing) return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
        const docOrgId = normalizeOrgIdValue(existing.organization_id);
        if (docOrgId) {
          const access = await requireOrgAccess(req, res, docOrgId, { write: false });
          if (!access) return null;
        }
        const updated = {
          ...existing,
          download_count: Number(existing.download_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        };
        e2eStore.documents.set(id, updated);
        savePersistedData(e2eStore);
        return { status: 200, data: updated };
      }

      if (!ensureSupabase(res)) return null;
      if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.download'))) return null;
      const existing = await repository.selectDocumentById(id);
      if (!existing) return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
      const docOrgId = normalizeOrgIdValue(existing.organization_id ?? existing.org_id ?? null);
      if (docOrgId) {
        const access = await requireOrgAccess(req, res, docOrgId, { write: false });
        if (!access) return null;
      }
      const data = await repository.incrementDownload(id);
      await refreshDocumentSignedUrls(data ? [data] : []);
      return { status: 200, data };
    } catch (error) {
      logger.error('document_download_failed', {
        requestId: req.requestId ?? null,
        documentId: id,
        message: error?.message ?? String(error),
      });
      throw error;
    }
  };

  const clientDownloadDocument = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const { id } = req.params;

    try {
      if (isDemoOrTestMode && !supabase) {
        const existing = e2eStore.documents.get(id) ?? null;
        if (!existing) return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
        const visibility = String(existing.visibility || 'global').toLowerCase();
        const docOrgId = normalizeOrgIdValue(existing.organization_id ?? existing.org_id ?? null);
        const docUserId = existing.user_id ?? null;
        if (visibility === 'user' && docUserId !== context.userId) {
          return { status: 403, error: { code: 'forbidden', message: 'Document is not assigned to this user' } };
        }
        if (visibility === 'org' && docOrgId && !(Array.isArray(context.organizationIds) && context.organizationIds.includes(docOrgId))) {
          const access = await requireOrgAccess(req, res, docOrgId, { write: false });
          if (!access) return null;
        }
        const updated = {
          ...existing,
          download_count: Number(existing.download_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        };
        e2eStore.documents.set(id, updated);
        savePersistedData(e2eStore);
        return { status: 200, data: updated };
      }

      if (!ensureSupabase(res)) return null;
      if (!(await ensureDocumentsSchemaOrRespond(res, 'client.documents.download'))) return null;
      const documentRow = await repository.selectDocumentById(id);
      if (!documentRow) {
        return { status: 404, error: { code: 'document_not_found', message: 'Document not found' } };
      }

      const visibility = String(documentRow.visibility || 'global').toLowerCase();
      const docOrgId = normalizeOrgIdValue(documentRow.organization_id ?? documentRow.org_id ?? null);
      const docUserId = documentRow.user_id ?? null;
      const requestedOrgIds = Array.isArray(context.organizationIds)
        ? context.organizationIds.filter((value) => typeof value === 'string' && value.trim())
        : [];

      if (visibility === 'user') {
        if (!docUserId || docUserId !== context.userId) {
          return { status: 403, error: { code: 'forbidden', message: 'Document is not assigned to this user' } };
        }
      } else if (visibility === 'org') {
        if (!docOrgId) {
          return { status: 403, error: { code: 'forbidden', message: 'Document organization scope is invalid' } };
        }
        if (!requestedOrgIds.includes(docOrgId)) {
          const access = await requireOrgAccess(req, res, docOrgId, { write: false });
          if (!access) return null;
        }
      }

      const data = await repository.incrementDownload(id);
      await refreshDocumentSignedUrls(data ? [data] : []);
      return { status: 200, data };
    } catch (error) {
      logger.error('client_document_download_failed', {
        requestId: req.requestId ?? null,
        documentId: id,
        message: error?.message ?? String(error),
      });
      throw error;
    }
  };

  const deleteAdminDocument = async ({ req, res }) => {
    const { id } = req.params;
    const context = requireUserContext(req, res);
    if (!context) return null;

    try {
      if (isDemoOrTestMode && !supabase) {
        const existing = e2eStore.documents.get(id) ?? null;
        if (!existing) return { status: 204, data: null };
        const docOrgId = normalizeOrgIdValue(existing.organization_id);
        if (docOrgId) {
          const access = await requireOrgAccess(req, res, docOrgId, { write: true });
          if (!access) return null;
        } else if (!context.isPlatformAdmin) {
          return { status: 403, error: { code: 'organization_scope_required', message: 'Document is platform scoped' } };
        }
        e2eStore.documents.delete(id);
        savePersistedData(e2eStore);
        return { status: 204, data: null };
      }

      if (!ensureSupabase(res)) return null;
      if (!(await ensureDocumentsSchemaOrRespond(res, 'admin.documents.delete'))) return null;
      const existing = await repository.selectDocumentById(id, 'storage_path, organization_id');
      if (!existing) {
        return { status: 204, data: null };
      }
      const docOrgId = normalizeOrgIdValue(existing.organization_id);
      if (docOrgId) {
        const access = await requireOrgAccess(req, res, docOrgId, { write: true });
        if (!access) return null;
      } else if (!context.isPlatformAdmin) {
        return { status: 403, error: { code: 'organization_scope_required', message: 'Document is platform scoped' } };
      }

      await repository.deleteDocumentById(id);
      if (existing.storage_path) {
        await removeDocumentStorageObject({ bucket: documentsBucket, storagePath: existing.storage_path });
      }
      return { status: 204, data: null };
    } catch (error) {
      logger.error('document_delete_failed', {
        requestId: req.requestId ?? null,
        documentId: id,
        message: error?.message ?? String(error),
      });
      throw error;
    }
  };

  return {
    listClientDocuments,
    listAdminDocuments,
    createAdminDocument,
    updateAdminDocument,
    adminDownloadDocument,
    clientDownloadDocument,
    deleteAdminDocument,
  };
};

export default createDocumentsService;
