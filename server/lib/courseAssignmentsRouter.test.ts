import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCourseAssignmentsRouter } from '../routes/courseAssignments.js';

const createApp = () => {
  const e2eStore = {
    assignments: [
      {
        id: 'assignment-1',
        course_id: 'course-1',
        organization_id: 'org-1',
        user_id: 'learner-1',
        assignment_type: 'course',
        active: true,
        status: 'assigned',
        created_at: '2026-04-11T00:00:00.000Z',
      },
    ],
  };

  const requireUserContext = vi.fn((req, _res) => {
    const isLearner = req.path.startsWith('/client/');
    return {
      userId: isLearner ? 'learner-1' : 'admin-1',
      organizationIds: ['org-1'],
      requestedOrgId: null,
      isPlatformAdmin: false,
    };
  });

  const requireOrgAccess = vi.fn(async (_req, _res, orgId) => {
    if (orgId !== 'org-1') return null;
    return { role: 'admin', orgId };
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'course-req-1';
    next();
  });
  app.use(
    '/api',
    createCourseAssignmentsRouter({
      supabase: null,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      e2eStore,
      isDemoOrTestMode: true,
      isDemoMode: false,
      defaultSandboxOrgId: 'org-1',
      shouldUseAssignmentWriteFallback: () => true,
      normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      normalizeAssignmentRow: (row) => row,
      ensureOrgFieldCompatibility: (row) => row,
      ensureCourseAssignmentsForUserFromOrgScope: vi.fn(async () => undefined),
      detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
      getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
      getOrganizationMembershipsOrgColumnName: vi.fn(async () => 'organization_id'),
      getOrganizationMembershipsStatusColumnName: vi.fn(async () => 'status'),
      isUuid: (value) => typeof value === 'string' && value.includes('-'),
      resolveUserIdentifierToUuid: vi.fn(async (_req, value) => value),
      isMissingRelationError: vi.fn(() => false),
      isMissingColumnError: vi.fn(() => false),
      resolveCourseIdentifierToUuid: vi.fn(async (value) => (value === 'course-1' ? value : null)),
      coerceOrgIdentifierToUuid: vi.fn(async (_req, value) => value),
      sanitizeAssignmentRecordForSchema: (record) => record,
      notifyAssignmentRecipients: vi.fn(async () => undefined),
      broadcastToTopic: vi.fn(),
      logCourseRequestEvent: vi.fn(),
      logAdminCoursesError: vi.fn(),
      normalizeLegacyOrgInput: (payload) => payload,
      pickOrgId: (...values) => values.find(Boolean) ?? null,
      assertUuid: vi.fn(),
      summarizeHeaders: vi.fn(() => ({ safe: true })),
      summarizeRequestBody: vi.fn(() => ({ safe: true })),
      isInfrastructureUnavailableError: vi.fn(() => false),
      ensureSupabase: () => true,
      requireUserContext,
      requireOrgAccess,
      isFallbackMode: true,
    }),
  );

  return { app };
};

describe('course assignments router', () => {
  let server: any = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns learner assignments from the extracted client route', async () => {
    const response = await fetch(`${baseUrl}/api/client/assignments`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].course_id).toBe('course-1');
  });

  it('assigns a course from the extracted admin write route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: 'org-1',
        userIds: ['learner-2'],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta).toMatchObject({ fallback: true, organizationId: 'org-1', inserted: 1 });
  });

  it('lists admin course assignments from the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1/assignments?orgId=org-1`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.meta).toMatchObject({ count: 1 });
  });

  it('deletes an assignment from the extracted admin delete route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/assignments/assignment-1`, { method: 'DELETE' });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      code: 'database_unavailable',
    });
  });
});
