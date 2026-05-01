import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCourseAdvancedRouter } from '../routes/courseAdvanced.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const sendApiResponse = vi.fn((res, data, options = {}) =>
    res.status(options.statusCode ?? 200).json({
      ok: true,
      data,
      code: options.code ?? null,
      message: options.message ?? null,
      meta: options.meta ?? null,
    }));
  const sendApiError = vi.fn((res, statusCode, code, message, extra = {}) =>
    res.status(statusCode).json({
      ok: false,
      data: null,
      code,
      error: code,
      message,
      ...extra,
    }));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'course-advanced-req-1';
    req.user = { id: 'admin-1' };
    next();
  });

  app.use(
    '/api',
    createCourseAdvancedRouter({
      authenticate: (_req, _res, next) => next(),
      requireOrgAdmin: (_req, _res, next) => next(),
      logger,
      normalizeLegacyOrgInput: vi.fn(),
      normalizeImportEntries: vi.fn((body) => ({
        entries: [{ index: 0, course: body.course ?? body, modules: body.modules ?? [] }],
        sourceLabel: 'items',
      })),
      normalizeOrgIdValue: (value) => value ?? null,
      pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
      requireUserContext: vi.fn(() => ({
        userId: 'admin-1',
        activeOrganizationId: 'org-1',
        memberships: [{ organization_id: 'org-1' }],
        organizationIds: ['org-1'],
        isPlatformAdmin: true,
      })),
      requireOrgAccess: vi.fn(async () => true),
      validateCoursePayload: vi.fn((payload) => ({ ok: true, data: payload })),
      normalizeModuleForImport: vi.fn((module) => module),
      normalizeLessonOrder: vi.fn(),
      slugify: (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      shapeCourseForValidation: (course) => course,
      validatePublishableCourse: vi.fn(() => ({ isValid: true, issues: [] })),
      e2eStore: { courses: new Map([['course-1', { id: 'course-1', organization_id: 'org-1', version: 1, modules: [] }]]) },
      persistE2EStore: vi.fn(),
      logAdminCoursesError: vi.fn(),
      ensureSupabase: vi.fn(() => true),
      ensureTablesReady: vi.fn(async () => ({ ok: true })),
      respondSchemaUnavailable: vi.fn(),
      sql: { begin: vi.fn() },
      upsertCourseGraphWithTx: vi.fn(),
      isUuid: (value) => typeof value === 'string' && value.length > 0,
      firstRow: (rows) => (Array.isArray(rows) ? rows[0] ?? null : rows ?? null),
      prepareLessonPersistencePayload: vi.fn((payload) => payload),
      extractCompletionRule: vi.fn(() => null),
      assignPublishedOrganizationCoursesToActiveMembers: vi.fn(async () => {}),
      assignPublishedOrganizationCoursesToUser: vi.fn(async () => {}),
      logCourseImportEvent: vi.fn(),
      respondImportError: vi.fn(({ res, status, code, message, requestId, details }) =>
        res.status(status ?? 500).json({
          ok: false,
          code: code ?? 'import_failed',
          error: code ?? 'import_failed',
          message: message ?? 'Import failed',
          details: details ?? null,
          meta: { requestId: requestId ?? null },
        })),
      sendApiResponse,
      sendApiError,
      resolveCourseIdentifierToUuid: vi.fn(async (id) => (id === 'course-1' ? 'course-1' : null)),
      parsePublishRequestBody: vi.fn((body) => ({ version: body.version ?? null, idempotencyKey: body.idempotencyKey ?? null })),
      logCourseRequestEvent: vi.fn(),
      detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => true),
      getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
      getOrganizationMembershipsOrgColumnName: vi.fn(async () => 'organization_id'),
      getOrganizationMembershipsStatusColumnName: vi.fn(async () => 'status'),
      isIdempotencyTableMissingError: vi.fn(() => false),
      isInfrastructureUnavailableError: vi.fn(() => false),
      getInMemoryIdempotencyKey: vi.fn(() => null),
      setInMemoryIdempotencyKey: vi.fn(),
      loadCourseGraphWithTx: vi.fn(),
      backfillPublishedCourseAssignmentsWithTx: vi.fn(async () => {}),
      broadcastToTopic: vi.fn(),
      courseWithModulesLessonsSelect: 'id, title',
      supabase: { from: vi.fn() },
      isDemoOrTestMode: true,
      prepareLessonContentWithCompletionRule: vi.fn(),
      randomUUID: () => '12345678-1234-5678-1234-567812345678',
    }),
  );

  return { app, sendApiResponse, sendApiError };
};

describe('course advanced router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    server.__context = context;
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('imports courses through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        course: { title: 'Imported Course', slug: 'imported-course' },
        modules: [],
      }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].title).toBe('Imported Course');
  });

  it('publishes a course through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1 }),
    });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe('published');
  });
});
