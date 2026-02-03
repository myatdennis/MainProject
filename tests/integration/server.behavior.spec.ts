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
});
