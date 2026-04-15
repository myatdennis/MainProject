import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCourseCatalogRouter } from '../routes/courseCatalog.js';
import { AddressInfo } from 'net';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const e2eStore = {
    courses: new Map([
      [
        'course-1',
        {
          id: 'course-1',
          slug: 'course-1',
          title: 'Belonging 101',
          status: 'published',
          organization_id: 'org-1',
          modules: [
            {
              id: 'module-1',
              title: 'Intro',
              lessons: [{ id: 'lesson-1', title: 'Welcome', type: 'video', content_json: { videoUrl: 'https://example.com/video.mp4' } }],
            },
          ],
        },
      ],
    ]),
    assignments: [
      {
        id: 'assignment-1',
        course_id: 'course-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        assignment_type: 'course',
        active: true,
      },
    ],
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const anyReq = req as any;
    anyReq.requestId = 'course-catalog-req-1';
    anyReq.user = { id: 'user-1', userId: 'user-1' };
    next();
  });

  app.use(
    '/api',
    createCourseCatalogRouter({
      authenticate: (_req: any, _res: any, next: any) => next(),
      logger,
      supabase: null,
      e2eStore,
      nodeEnv: 'test',
      isDemoMode: false,
      isDemoOrTestMode: true,
      isTestMode: true,
      defaultSandboxOrgId: 'org-1',
      ensureSupabase: () => true,
      requireUserContext: vi.fn(() => ({
        userId: 'user-1',
        userRole: 'learner',
        memberships: [{ orgId: 'org-1', role: 'admin' }],
        organizationIds: ['org-1'],
        requestedOrgId: 'org-1',
        activeOrganizationId: 'org-1',
        isPlatformAdmin: true,
      })),
      pickOrgId: (...values: any[]) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
      coerceOrgIdentifierToUuid: vi.fn(async (_req: any, value: any) => value),
      isUuid: (value: any) => typeof value === 'string' && value.length > 0,
      hasOrgAdminRole: () => true,
      normalizeOrgIdValue: (value: any) => (typeof value === 'string' ? value.trim() : null),
      requireOrgAccess: vi.fn(async () => true),
      parseBooleanParam: (value: any, fallback: any) =>
        typeof value === 'string' ? value.trim().toLowerCase() === 'true' : Boolean(fallback),
      parsePaginationParams: () => ({ page: 1, pageSize: 20, from: 0, to: 19 }),
      sanitizeIlike: (value: any) => value,
      runSupabaseReadQueryWithRetry: vi.fn(),
      runSupabaseTransientRetry: vi.fn(async (_label: any, fn: any) => fn()),
      resolveOrgScopeForRequest: vi.fn(async () => ({
        resolvedOrgId: 'org-1',
        scopedOrgIds: ['org-1'],
        membershipSet: new Set(['org-1']),
        primaryOrgId: 'org-1',
        requiresExplicitSelection: false,
      })),
      detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
      getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
      ensureOrgFieldCompatibility: (record: any) => record,
      ensureCourseStructureLoaded: vi.fn(async (course: any) => course),
      normalizeModuleGraph: (modules: any) => modules,
      attachCompletionRuleForResponse: vi.fn(),
      e2eFindCourse: (identifier: any) => {
        return Array.from(e2eStore.courses.values()).find(
          (course) => course.id === identifier || course.slug === identifier,
        ) ?? null;
      },
      logAdminCoursesError: vi.fn(),
      logStructuredError: vi.fn(),
      courseModulesWithLessonFields: ',modules(*)',
      courseModulesNoLessonsFields: ',modules(*)',
      courseWithModulesLessonsSelect: '*',
      moduleLessonsForeignTable: 'lessons',
    }),
  );

  return app;
};

describe('course catalog router', () => {
  let server: any = null;
  let baseUrl = '';

  beforeEach(async () => {
    const app = createApp();
    server = app.listen(0) as any;
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => server.close((error: any) => (error ? reject(error) : resolve())));
    }
  });

  it('lists admin courses through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
  });

  it('loads admin course detail through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe('course-1');
  });

  it('lists client courses through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/courses?assigned=true&orgId=org-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('loads client course detail through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/courses/course-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.id).toBe('course-1');
  });

  it('lists admin courses when memberships use organization_id instead of orgId', async () => {
    const e2eStoreForTest = {
      courses: new Map([
        [
          'course-1',
          {
            id: 'course-1',
            slug: 'course-1',
            title: 'Belonging 101',
            status: 'published',
            organization_id: 'org-1',
            modules: [
              {
                id: 'module-1',
                title: 'Intro',
                lessons: [
                  { id: 'lesson-1', title: 'Welcome', type: 'video', content_json: { videoUrl: 'https://example.com/video.mp4' } },
                ],
              },
            ],
          },
        ],
      ]),
      assignments: [
        {
          id: 'assignment-1',
          course_id: 'course-1',
          organization_id: 'org-1',
          user_id: 'user-2',
          assignment_type: 'course',
          active: true,
        },
      ],
    };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const anyReq = req as any;
      anyReq.requestId = 'course-catalog-req-2';
      anyReq.user = { id: 'user-2', userId: 'user-2' };
      next();
    });

    app.use(
      '/api',
      createCourseCatalogRouter({
        authenticate: (_req: any, _res: any, next: any) => next(),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        supabase: null,
        e2eStore: e2eStoreForTest,
        nodeEnv: 'test',
        isDemoMode: false,
        isDemoOrTestMode: true,
        isTestMode: true,
        defaultSandboxOrgId: 'org-1',
        ensureSupabase: () => true,
        requireUserContext: vi.fn(() => ({
          userId: 'user-2',
          userRole: 'admin',
          memberships: [{ organization_id: 'org-1', role: 'admin' }],
          organizationIds: ['org-1'],
          requestedOrgId: 'org-1',
          activeOrganizationId: 'org-1',
          isPlatformAdmin: false,
        })),
        pickOrgId: (...values: any[]) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
        coerceOrgIdentifierToUuid: vi.fn(async (_req: any, value: any) => value),
        isUuid: (value: any) => typeof value === 'string' && value.length > 0,
        hasOrgAdminRole: () => true,
        normalizeOrgIdValue: (value: any) => (typeof value === 'string' ? value.trim() : null),
        requireOrgAccess: vi.fn(async () => true),
        parseBooleanParam: (value: any, fallback: any) =>
          typeof value === 'string' ? value.trim().toLowerCase() === 'true' : Boolean(fallback),
        parsePaginationParams: () => ({ page: 1, pageSize: 20, from: 0, to: 19 }),
        sanitizeIlike: (value: any) => value,
        runSupabaseReadQueryWithRetry: vi.fn(),
        runSupabaseTransientRetry: vi.fn(async (_label: any, fn: any) => fn()),
        resolveOrgScopeForRequest: vi.fn(async () => ({
          resolvedOrgId: 'org-1',
          scopedOrgIds: ['org-1'],
          membershipSet: new Set(['org-1']),
          primaryOrgId: 'org-1',
          requiresExplicitSelection: false,
        })),
        detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
        getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
        ensureOrgFieldCompatibility: (record: any) => record,
        ensureCourseStructureLoaded: vi.fn(async (course: any) => course),
        normalizeModuleGraph: (modules: any) => modules,
        attachCompletionRuleForResponse: vi.fn(),
        e2eFindCourse: (identifier: any) => {
          return Array.from(e2eStoreForTest.courses.values()).find(
            (course) => course.id === identifier || course.slug === identifier,
          ) ?? null;
        },
        logAdminCoursesError: vi.fn(),
        logStructuredError: vi.fn(),
        courseModulesWithLessonFields: ',modules(*)',
        courseModulesNoLessonsFields: ',modules(*)',
        courseWithModulesLessonsSelect: '*',
        moduleLessonsForeignTable: 'lessons',
      }),
    );

    const server = app.listen(0) as any;
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(`${baseUrl}/api/admin/courses`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    await new Promise<void>((resolve, reject) => server.close((error: any) => (error ? reject(error) : resolve())));
  });

  it('lists admin courses when Supabase membership rows return org_id instead of organization_id', async () => {
    const e2eStoreForTest = {
      courses: new Map([
        [
          'course-1',
          {
            id: 'course-1',
            slug: 'course-1',
            title: 'Belonging 101',
            status: 'published',
            organization_id: 'org-1',
            modules: [
              {
                id: 'module-1',
                title: 'Intro',
                lessons: [
                  { id: 'lesson-1', title: 'Welcome', type: 'video', content_json: { videoUrl: 'https://example.com/video.mp4' } },
                ],
              },
            ],
          },
        ],
      ]),
      assignments: [
        {
          id: 'assignment-1',
          course_id: 'course-1',
          organization_id: 'org-1',
          user_id: 'user-2',
          assignment_type: 'course',
          active: true,
        },
      ],
    };

    const supabase = {
      from: () => {
        const query = {
          select() { return this; },
          eq() { return this; },
          async then(resolve: any) {
            return resolve({ data: [{ org_id: 'org-1', role: 'admin', status: 'active' }], error: null });
          },
        };
        return query;
      },
    };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const anyReq = req as any;
      anyReq.requestId = 'course-catalog-req-3';
      anyReq.user = { id: 'user-2', userId: 'user-2' };
      next();
    });

    app.use(
      '/api',
      createCourseCatalogRouter({
        authenticate: (_req: any, _res: any, next: any) => next(),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        supabase,
        e2eStore: e2eStoreForTest,
        nodeEnv: 'test',
        isDemoMode: false,
        isDemoOrTestMode: true,
        isTestMode: true,
        defaultSandboxOrgId: 'org-1',
        ensureSupabase: () => true,
        requireUserContext: vi.fn(() => ({
          userId: 'user-2',
          userRole: 'admin',
          memberships: [],
          organizationIds: ['org-1'],
          requestedOrgId: 'org-1',
          activeOrganizationId: 'org-1',
          isPlatformAdmin: false,
        })),
        pickOrgId: (...values: any[]) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
        coerceOrgIdentifierToUuid: vi.fn(async (_req: any, value: any) => value),
        isUuid: (value: any) => typeof value === 'string' && value.length > 0,
        hasOrgAdminRole: () => true,
        normalizeOrgIdValue: (value: any) => (typeof value === 'string' ? value.trim() : null),
        requireOrgAccess: vi.fn(async () => true),
        parseBooleanParam: (value: any, fallback: any) =>
          typeof value === 'string' ? value.trim().toLowerCase() === 'true' : Boolean(fallback),
        parsePaginationParams: () => ({ page: 1, pageSize: 20, from: 0, to: 19 }),
        sanitizeIlike: (value: any) => value,
        runSupabaseReadQueryWithRetry: vi.fn(),
        runSupabaseTransientRetry: vi.fn(async (_label: any, fn: any) => fn()),
        resolveOrgScopeForRequest: vi.fn(async () => ({
          resolvedOrgId: 'org-1',
          scopedOrgIds: ['org-1'],
          membershipSet: new Set(['org-1']),
          primaryOrgId: 'org-1',
          requiresExplicitSelection: false,
        })),
        detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
        getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
        ensureOrgFieldCompatibility: (record: any) => record,
        ensureCourseStructureLoaded: vi.fn(async (course: any) => course),
        normalizeModuleGraph: (modules: any) => modules,
        attachCompletionRuleForResponse: vi.fn(),
        e2eFindCourse: (identifier: any) => {
          return Array.from(e2eStoreForTest.courses.values()).find(
            (course) => course.id === identifier || course.slug === identifier,
          ) ?? null;
        },
        logAdminCoursesError: vi.fn(),
        logStructuredError: vi.fn(),
        courseModulesWithLessonFields: ',modules(*)',
        courseModulesNoLessonsFields: ',modules(*)',
        courseWithModulesLessonsSelect: '*',
        moduleLessonsForeignTable: 'lessons',
      }),
    );

    const server = app.listen(0) as any;
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(`${baseUrl}/api/admin/courses`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    await new Promise<void>((resolve, reject) => server.close((error: any) => (error ? reject(error) : resolve())));
  });
});
