import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentsRouter } from '../routes/documents.js';

const createApp = () => {
  const e2eStore = { documents: new Map(), assignments: [] };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const requireUserContext = vi.fn(() => ({
    userId: 'admin-1',
    organizationIds: ['org-1'],
    memberships: [{ orgId: 'org-1', role: 'admin' }],
    isPlatformAdmin: false,
  }));
  const requireOrgAccess = vi.fn(async (_req, _res, orgId) => (orgId === 'org-1' ? { orgId, role: 'admin' } : null));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'docs-req-1';
    next();
  });
  app.use(
    '/api',
    createDocumentsRouter({
      logger,
      supabase: null,
      e2eStore,
      isDemoOrTestMode: true,
      ensureDocumentsSchemaOrRespond: vi.fn(async () => true),
      ensureSupabase: () => true,
      requireUserContext,
      requireOrgAccess,
      requireAdmin: (_req, _res, next) => next(),
      requireOrgAdmin: (_req, _res, next) => next(),
      pickOrgId: (...values) => values.find(Boolean) ?? null,
      coerceOrgIdentifierToUuid: vi.fn(async (_req, value) => value),
      isUuid: (value) => typeof value === 'string' && value.includes('-'),
      normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      hasOrgAdminRole: (role) => role === 'admin',
      filterE2EDocumentsForAdmin: vi.fn(() => Array.from(e2eStore.documents.values())),
      buildE2EDocumentRecord: ({ payload, organizationId, context }) => ({
        id: 'doc-1',
        name: payload.name,
        category: payload.category,
        visibility: payload.visibility ?? 'org',
        organization_id: organizationId,
        user_id: payload.userId ?? null,
        created_by: context.userId,
      }),
      savePersistedData: vi.fn(),
      createSignedDocumentUrl: vi.fn(async () => null),
      refreshDocumentSignedUrls: vi.fn(async (rows) => rows),
      resolveDocumentTargetOrg: vi.fn(async () => ({ organizationId: 'org-1', resolution: 'explicit' })),
      buildDocumentsInsertPayload: vi.fn(),
      executeDocumentInsert: vi.fn(),
      buildDocumentCreateFailure: vi.fn(),
      removeDocumentStorageObject: vi.fn(async () => undefined),
      documentsBucket: 'course-resources',
      documentUrlTtlSeconds: 3600,
      firstRow: (result) => result?.data?.[0] ?? null,
      normalizeLegacyOrgInput: vi.fn(),
    }),
  );
  return { app, e2eStore };
};

describe('documents router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('creates a document through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Welcome', category: 'Onboarding', visibility: 'org', organization_id: 'org-1' }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.name).toBe('Welcome');
  });

  it('lists documents through the extracted admin route', async () => {
    await fetch(`${baseUrl}/api/admin/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Welcome', category: 'Onboarding', visibility: 'org', organization_id: 'org-1' }),
    });
    const response = await fetch(`${baseUrl}/api/admin/documents?orgId=org-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('requires explicit org selection when request context spans multiple organizations', async () => {
    const e2eStore = { documents: new Map(), assignments: [] };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.requestId = 'docs-req-2';
      req.user = {
        organization_ids: ['org-1', 'org-2'],
        app_metadata: {
          organization_ids: ['org-1', 'org-2'],
        },
      };
      next();
    });
    app.use(
      '/api',
      createDocumentsRouter({
        logger,
        supabase: null,
        e2eStore,
        isDemoOrTestMode: true,
        ensureDocumentsSchemaOrRespond: vi.fn(async () => true),
        ensureSupabase: () => true,
        requireUserContext: vi.fn(() => ({
          userId: 'admin-1',
          organizationIds: [],
          memberships: [],
          isPlatformAdmin: true,
        })),
        requireOrgAccess: vi.fn(async () => ({ orgId: 'org-1', role: 'admin' })),
        requireAdmin: (_req, _res, next) => next(),
        requireOrgAdmin: (_req, _res, next) => next(),
        pickOrgId: (...values) => values.find(Boolean) ?? null,
        coerceOrgIdentifierToUuid: vi.fn(async (_req, value) => value),
        isUuid: (value) => typeof value === 'string' && value.includes('-'),
        normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
        hasOrgAdminRole: (role) => role === 'admin',
        filterE2EDocumentsForAdmin: vi.fn(() => []),
        buildE2EDocumentRecord: vi.fn(),
        savePersistedData: vi.fn(),
        createSignedDocumentUrl: vi.fn(async () => null),
        refreshDocumentSignedUrls: vi.fn(async (rows) => rows),
        resolveDocumentTargetOrg: vi.fn(async () => ({ organizationId: 'org-1', resolution: 'explicit' })),
        buildDocumentsInsertPayload: vi.fn(),
        executeDocumentInsert: vi.fn(),
        buildDocumentCreateFailure: vi.fn(),
        removeDocumentStorageObject: vi.fn(async () => undefined),
        documentsBucket: 'course-resources',
        documentUrlTtlSeconds: 3600,
        firstRow: (result) => result?.data?.[0] ?? null,
        normalizeLegacyOrgInput: vi.fn(),
      }),
    );

    const scopedServer = app.listen(0);
    await new Promise((resolve) => scopedServer.once('listening', resolve));
    const scopedBaseUrl = `http://127.0.0.1:${scopedServer.address().port}`;

    try {
      const response = await fetch(`${scopedBaseUrl}/api/admin/documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ambiguous', category: 'Policy', visibility: 'global' }),
      });
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.code).toBe('explicit_org_selection_required');
      expect(payload.error?.code).toBe('explicit_org_selection_required');
    } finally {
      await new Promise((resolve, reject) => scopedServer.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
