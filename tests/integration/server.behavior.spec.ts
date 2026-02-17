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

describe('Server demo-mode behavior', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
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
      expect(res.status).toBe(201);
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
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('stored');
    expect(body).toHaveProperty('entry');
    expect(body.entry).toMatchObject({
      user_id: payload.userId,
      org_id: payload.orgId,
      action: payload.action,
    });
  });
});
