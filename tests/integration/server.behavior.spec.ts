import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createAdminAuthHeaders,
  createMemberAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';
import { authCookieNames } from '../../server/utils/authCookies.js';

const asJson = (headers: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...headers,
});

const adminContextHeaders = async () => ({
  ...asJson(await createAdminAuthHeaders()),
  'x-user-id': 'integration-admin',
  'x-user-role': 'admin',
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Server demo-mode behavior', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer({ idempotencyFallback: true });
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('persists admin course upserts in demo mode and exposes them to admins/clients', async () => {
    const slug = `demo-${randomUUID()}`;
    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: {
          title: `Integration Course ${slug}`,
          slug,
          status: 'draft',
        },
        modules: [],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    expect(created).toHaveProperty('data.id');

    const adminList = await server!.fetch('/api/admin/courses', {
      headers: await adminContextHeaders(),
    });
    expect(adminList.status).toBe(200);
    const adminJson = await adminList.json();
    const adminSlugs = (adminJson.data || []).map((course: any) => course.slug);
    expect(adminSlugs).toContain(slug);

    const clientList = await server!.fetch('/api/client/courses');
    expect(clientList.status).toBe(200);
    const clientJson = await clientList.json();
    const clientSlugs = (clientJson.data || []).map((course: any) => course.slug);
    expect(clientSlugs).toContain(slug);
  }, 20000);

  it('returns 409 slug_taken when creating a course with a duplicate slug', async () => {
    const slug = `dup-${randomUUID()}`;
    const headers = await adminContextHeaders();

    const firstRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        course: { title: `Original ${slug}`, slug },
        modules: [],
      }),
    });
    expect([200, 201]).toContain(firstRes.status);

    const conflictRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        course: { title: 'Duplicate Attempt', slug },
        modules: [],
      }),
    });
    expect(conflictRes.status).toBe(409);
    const conflictJson = await conflictRes.json();
    expect(conflictJson).toHaveProperty('code', 'slug_taken');
    expect(typeof conflictJson.suggestion).toBe('string');
    expect(conflictJson.suggestion).not.toEqual(slug);
  });

  it('returns nested modules and lessons from the admin course detail endpoint', async () => {
    const slug = `detail-${randomUUID()}`;
    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: {
          title: `Course ${slug}`,
          slug,
        },
        modules: [
          {
            title: 'Module 1',
            description: 'Demo module',
            lessons: [
              {
                title: 'Lesson 1',
                type: 'text',
                content: { textContent: 'Some body content' },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const createdJson = await createRes.json();
    const courseId = createdJson.data?.id;
    expect(courseId).toBeTruthy();

    const detailRes = await server!.fetch(`/api/admin/courses/${courseId}`, {
      headers: await adminContextHeaders(),
    });
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(Array.isArray(detailJson.data?.modules)).toBe(true);
    expect(detailJson.data.modules[0]?.lessons).toHaveLength(1);

    const listRes = await server!.fetch('/api/admin/courses?includeStructure=true&includeLessons=true', {
      headers: await adminContextHeaders(),
    });
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    const hydrated = (listJson.data || []).find((course: any) => course.id === courseId);
    expect(hydrated).toBeTruthy();
    expect(Array.isArray(hydrated.modules)).toBe(true);
    expect(hydrated.modules[0]?.lessons).toHaveLength(1);

    const clientDetail = await server!.fetch(`/api/client/courses/${courseId}?includeDrafts=true`);
    expect(clientDetail.status).toBe(200);
    const clientJson = await clientDetail.json();
    expect(Array.isArray(clientJson.data?.modules)).toBe(true);
    expect(clientJson.data.modules[0]?.lessons).toHaveLength(1);
  }, 20000);

  it('normalizes non-UUID module and lesson ids before persistence', async () => {
    const headers = await adminContextHeaders();
    const res = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        course: {
          title: `Temp UUID Course ${Date.now()}`,
          status: 'draft',
        },
        modules: [
          {
            id: 'mod-temp-e2e',
            title: 'Temp Module',
            description: 'demo',
            lessons: [
              {
                id: 'les-temp-e2e',
                title: 'Temp Lesson',
                type: 'text',
                content: { textContent: 'demo' },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    const module = body?.data?.modules?.[0];
    expect(module).toBeTruthy();
    expect(UUID_REGEX.test(module.id)).toBe(true);
    expect(module.client_temp_id).toBe('mod-temp-e2e');
    const lesson = module?.lessons?.[0];
    expect(lesson).toBeTruthy();
    expect(UUID_REGEX.test(lesson.id)).toBe(true);
    expect(lesson.client_temp_id).toBe('les-temp-e2e');
  });

  it('rejects admin course creation when no auth token is provided', async () => {
    const res = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: asJson(),
      body: JSON.stringify({
        course: { title: 'Unauthorized', slug: `unauth-${Date.now()}` },
        modules: [],
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('rejects admin course listing when no headers or cookies exist', async () => {
    const res = await server!.fetch('/api/admin/courses');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Authentication required');
  });

  it('allows admin access when a signed cookie supplies the access token', async () => {
    const adminAuth = await createAdminAuthHeaders();
    const token = adminAuth.Authorization?.replace(/^Bearer\s+/i, '') ?? '';
    expect(token).not.toHaveLength(0);
    const cookieHeader = `${authCookieNames.access || 'access_token'}=${token}`;
    const res = await server!.fetch('/api/admin/courses', {
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });

  it('rejects admin route access for authenticated non-admin users', async () => {
    const res = await server!.fetch('/api/admin/courses', {
      headers: asJson(await createMemberAuthHeaders({ userId: 'member-user', email: 'member@tests.local' })),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Forbidden');
    expect(body).toHaveProperty('message');
  });

  it('scopes client course listings to assigned organizations', async () => {
    const createCourse = async (slug: string) => {
      const res = await server!.fetch('/api/admin/courses', {
        method: 'POST',
        headers: await adminContextHeaders(),
        body: JSON.stringify({ course: { title: slug, slug }, modules: [] }),
      });
      expect([200, 201]).toContain(res.status);
      const json = await res.json();
      return json.data;
    };

    const assignToOrg = async (courseId: string, orgId: string) => {
      const res = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
        method: 'POST',
        headers: await adminContextHeaders(),
        body: JSON.stringify({ organization_id: orgId, user_ids: [] }),
      });
      // Assign is an idempotent upsert — returns 200 regardless of insert vs update.
      expect([200, 201]).toContain(res.status);
    };

    const courseA = await createCourse(`org-a-${randomUUID()}`);
    const courseB = await createCourse(`org-b-${randomUUID()}`);

    await assignToOrg(courseA.id, 'org-a');
    await assignToOrg(courseB.id, 'org-b');

    const orgAFetch = await server!.fetch('/api/client/courses?assigned=true&orgId=org-a');
    const orgAJson = await orgAFetch.json();
    const orgASlugs = (orgAJson.data || []).map((course: any) => course.slug);
    expect(orgASlugs).toContain(courseA.slug);
    expect(orgASlugs).not.toContain(courseB.slug);

    const orgBFetch = await server!.fetch('/api/client/courses?assigned=true&orgId=org-b');
    const orgBJson = await orgBFetch.json();
    const orgBSlugs = (orgBJson.data || []).map((course: any) => course.slug);
    expect(orgBSlugs).toContain(courseB.slug);
    expect(orgBSlugs).not.toContain(courseA.slug);
  }, 20000);

  it('returns assigned published courses without legacy org_id fields', async () => {
    const slug = `pub-${randomUUID()}`;
    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: { title: `Published ${slug}`, slug },
        modules: [],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const createdJson = await createRes.json();
    const courseId = createdJson.data?.id;
    expect(courseId).toBeTruthy();

    const assignRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({ organization_id: 'org-smoke', user_ids: [] }),
    });
    expect([200, 201]).toContain(assignRes.status);

    const publishRes = await server!.fetch(`/api/admin/courses/${courseId}/publish`, {
      method: 'POST',
      headers: await adminContextHeaders(),
    });
    expect([200, 201]).toContain(publishRes.status);

    const listRes = await server!.fetch('/api/client/courses?assigned=true&orgId=org-smoke');
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(Array.isArray(listJson.data)).toBe(true);
    expect(JSON.stringify(listJson)).not.toContain('org_id');
  }, 20000);

  it('publishes courses with the standardized success envelope', async () => {
    const slug = `publish-contract-${randomUUID()}`;
    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: { title: `Publish Contract ${slug}`, slug, status: 'draft' },
        modules: [
          {
            title: 'Module 1',
            lessons: [{ title: 'Lesson 1', type: 'text', content: { textContent: 'Ready to publish' } }],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    const courseId = created.data?.id;
    expect(courseId).toBeTruthy();

    const publishRes = await server!.fetch(`/api/admin/courses/${courseId}/publish`, {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({ version: created.data?.version ?? 1 }),
    });
    expect(publishRes.status).toBe(200);
    const body = await publishRes.json();
    expect(body).toMatchObject({
      ok: true,
      code: 'course_published',
      message: 'Course published successfully.',
    });
    expect(body?.meta?.courseId).toBe(courseId);
    expect(body?.data?.status).toBe('published');
  }, 20000);

  it('rolls back a batched import when one course in the batch fails', async () => {
    const slugA = `batch-rollback-a-${randomUUID()}`;
    const slugB = `batch-rollback-b-${randomUUID()}`;
    const importRes = await server!.fetch('/api/admin/courses/import', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        organizationId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        items: [
          {
            course: { title: `Course ${slugA}`, slug: slugA, status: 'draft' },
            modules: [],
          },
          {
            course: { title: `Course ${slugA}`, slug: slugA, status: 'draft' },
            modules: [],
          },
        ],
      }),
    });
    expect(importRes.status).toBe(409);
    const importJson = await importRes.json();
    expect(importJson).toMatchObject({
      ok: false,
      code: 'slug_conflict',
    });

    const listRes = await server!.fetch('/api/admin/courses', {
      headers: await adminContextHeaders(),
    });
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    const slugs = (listJson.data || []).map((course: any) => course.slug);
    expect(slugs).not.toContain(slugA);
    expect(slugs).not.toContain(slugB);
  }, 20000);

  it('creates and updates modules without falsely resolving module ids as course ids', async () => {
    const slug = `module-update-${randomUUID()}`;
    const createCourseRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: { title: `Module Course ${slug}`, slug, status: 'draft' },
        modules: [],
      }),
    });
    expect([200, 201]).toContain(createCourseRes.status);
    const createdCourse = await createCourseRes.json();
    const courseId = createdCourse.data?.id;

    const createModuleRes = await server!.fetch('/api/admin/modules', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({ courseId, title: 'Original Module' }),
    });
    expect(createModuleRes.status).toBe(201);
    const createdModule = await createModuleRes.json();
    expect(createdModule).toMatchObject({
      ok: true,
      code: 'module_created',
    });
    const moduleId = createdModule.data?.id;
    expect(moduleId).toBeTruthy();

    const updateModuleRes = await server!.fetch(`/api/admin/modules/${moduleId}`, {
      method: 'PATCH',
      headers: await adminContextHeaders(),
      body: JSON.stringify({ title: 'Updated Module' }),
    });
    expect(updateModuleRes.status).toBe(200);
    const updatedModule = await updateModuleRes.json();
    expect(updatedModule).toMatchObject({
      ok: true,
      code: 'module_updated',
      message: 'Module updated.',
    });
    expect(updatedModule.data?.title).toBe('Updated Module');
  }, 20000);

  it('creates and updates lessons without falsely resolving lesson ids as course ids', async () => {
    const slug = `lesson-update-${randomUUID()}`;
    const createCourseRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        course: { title: `Lesson Course ${slug}`, slug, status: 'draft' },
        modules: [{ title: 'Module A', lessons: [] }],
      }),
    });
    expect([200, 201]).toContain(createCourseRes.status);
    const createdCourse = await createCourseRes.json();
    const moduleId = createdCourse.data?.modules?.[0]?.id;
    expect(moduleId).toBeTruthy();

    const createLessonRes = await server!.fetch('/api/admin/lessons', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        moduleId,
        title: 'Original Lesson',
        type: 'text',
        orderIndex: 0,
        content: { textContent: 'Hello' },
      }),
    });
    expect(createLessonRes.status).toBe(201);
    const createdLesson = await createLessonRes.json();
    expect(createdLesson).toMatchObject({
      ok: true,
      code: 'lesson_created',
    });
    const lessonId = createdLesson.data?.id;
    expect(lessonId).toBeTruthy();

    const updateLessonRes = await server!.fetch(`/api/admin/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: await adminContextHeaders(),
      body: JSON.stringify({ title: 'Updated Lesson' }),
    });
    expect(updateLessonRes.status).toBe(200);
    const updatedLesson = await updateLessonRes.json();
    expect(updatedLesson).toMatchObject({
      ok: true,
      code: 'lesson_updated',
      message: 'Lesson updated.',
    });
    expect(updatedLesson.data?.title).toBe('Updated Lesson');
  }, 20000);

  it('records audit log metadata when provided', async () => {
    const payload = {
      action: `integration_audit_${Date.now()}`,
      userId: 'integration-user',
      orgId: 'integration-org',
      details: { surface: 'integration-test' },
    };
    const res = await server!.fetch('/api/audit-log', {
      method: 'POST',
      headers: asJson(),
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      code: 'audit_log_recorded',
      message: 'Audit log request processed.',
    });
    expect(body.data).toHaveProperty('stored', true);
    expect(body.data).toHaveProperty('entry');
    expect(body.data.entry).toMatchObject({
      user_id: payload.userId,
      org_id: payload.orgId,
      action: payload.action,
    });
  });

  it('imports a legacy TLC-style payload with nested course wrapper', async () => {
    const slug = `tlc-${randomUUID()}`;
    const importRes = await server!.fetch('/api/admin/courses/import', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        organizationId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        items: [
          {
            course: {
              title: `TLC Course ${slug}`,
              slug,
              status: 'draft',
            },
            modules: [
              {
                title: 'Introduction',
                lessons: [
                  { title: 'Getting started', type: 'text', content: { textContent: 'Welcome' } },
                ],
              },
            ],
          },
        ],
      }),
    });
    expect(importRes.status).toBe(201);
    const result = await importRes.json();
    expect(result).toMatchObject({ ok: true, code: 'courses_imported' });
    expect(result.data?.[0]?.slug).toBe(slug);
  }, 20000);

  it('imports a direct { course, modules } payload shape successfully', async () => {
    const slug = `direct-${randomUUID()}`;
    const importRes = await server!.fetch('/api/admin/courses/import', {
      method: 'POST',
      headers: await adminContextHeaders(),
      body: JSON.stringify({
        organizationId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        course: {
          title: `Direct Course ${slug}`,
          slug,
          status: 'draft',
        },
        modules: [
          {
            title: 'Overview',
            lessons: [
              { title: 'Overview lesson', type: 'text', content: { textContent: 'Overview content' } },
            ],
          },
        ],
      }),
    });
    expect(importRes.status).toBe(201);
    const result = await importRes.json();
    expect(result).toMatchObject({ ok: true, code: 'courses_imported' });
    expect(result.data?.[0]?.slug).toBe(slug);
  }, 20000);
});
