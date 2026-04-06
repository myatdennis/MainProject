import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createAdminAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';

const TEST_ORG_ID = process.env.TEST_ORGANIZATION_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';

const asJson = (headers: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...headers,
});

const adminHeaders = async () => ({
  ...asJson(await createAdminAuthHeaders()),
  'x-user-id': 'integration-admin',
  'x-user-role': 'admin',
  'x-org-id': TEST_ORG_ID,
});

describe('Admin course assignment (organization mode)', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('does not attempt null user_id inserts when assigning by organization', async () => {
    const slug = `org-assign-${randomUUID()}`;
    const moduleId = randomUUID();
    const lessonId = randomUUID();

    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        course: {
          title: `Org Assignment ${slug}`,
          slug,
          status: 'draft',
          organization_id: TEST_ORG_ID,
        },
        modules: [
          {
            id: moduleId,
            title: 'Module 1',
            lessons: [
              {
                id: lessonId,
                title: 'Lesson 1',
                type: 'text',
                content_json: { type: 'text', body: { blocks: [{ type: 'paragraph', data: { text: 'Hello' } }] } },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    const courseId = created?.data?.id;
    expect(courseId).toBeTruthy();

    const publishRes = await server!.fetch(`/api/admin/courses/${courseId}/publish`, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({ action: 'course.publish' }),
    });
    expect([200, 201]).toContain(publishRes.status);

    const assignRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        organization_id: TEST_ORG_ID,
        mode: 'organization',
        user_ids: [],
        status: 'assigned',
      }),
    });

    expect(assignRes.status).toBe(200);
    const assignJson = await assignRes.json();
    const assignedRows = Array.isArray(assignJson?.data) ? assignJson.data : [];
    assignedRows.forEach((row: any) => {
      const userId = row?.user_id ?? row?.userId ?? null;
      const orgId = row?.organization_id ?? row?.org_id ?? row?.organizationId ?? null;
      expect(Boolean(userId) || orgId === TEST_ORG_ID).toBe(true);
    });

    const assignmentsRes = await server!.fetch(
      `/api/admin/courses/${courseId}/assignments?orgId=${encodeURIComponent(TEST_ORG_ID)}`,
      { headers: await adminHeaders() },
    );
    expect(assignmentsRes.status).toBe(200);

    const assignmentsJson = await assignmentsRes.json();
    const persistedRows = Array.isArray(assignmentsJson?.data) ? assignmentsJson.data : [];
    persistedRows.forEach((row: any) => {
      const userId = row?.user_id ?? row?.userId ?? null;
      const orgId = row?.organization_id ?? row?.org_id ?? row?.organizationId ?? null;
      expect(Boolean(userId) || orgId === TEST_ORG_ID).toBe(true);
    });
  }, 60000);
});
