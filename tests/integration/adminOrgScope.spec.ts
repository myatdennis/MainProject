import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startTestServer, stopTestServer, TestServerHandle, createAdminAuthHeaders } from './utils/server.ts';

const DEMO_ORG_ID = 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
const JSON_HEADERS = {
  Accept: 'application/json',
};

describe('Admin organization scoping', () => {
  let server: TestServerHandle | null = null;
  let adminHeaders: Record<string, string> = {};

  beforeAll(async () => {
    server = await startTestServer();
    adminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  const fetchJson = async (path: string) => {
    const res = await server!.fetch(path, { headers: { ...JSON_HEADERS, ...adminHeaders } });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

  it('allows listing organizations without orgId for platform admin', async () => {
    const { res, body } = await fetchJson('/api/admin/organizations');
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('allows listing all admin users without orgId for platform admin', async () => {
    const { res, body } = await fetchJson('/api/admin/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('allows listing organizations when scoped to a known admin org', async () => {
    const { res, body } = await fetchJson(`/api/admin/organizations?orgId=${DEMO_ORG_ID}`);
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
  });

  it('rejects organization listing when requesting an unauthorized org scope', async () => {
    const { res, body } = await fetchJson('/api/admin/organizations?orgId=forbidden-org');
    expect(res.status).toBe(403);
    expect(body).toHaveProperty('error', 'org_access_denied');
  });

  it('rejects admin course listing when requesting an unauthorized org scope', async () => {
    const { res, body } = await fetchJson('/api/admin/courses?orgId=forbidden-org');
    expect(res.status).toBe(403);
    expect(body).toHaveProperty('error', 'org_access_denied');
  });

  it('allows admin course listing for authorized org scopes', async () => {
    const { res, body } = await fetchJson(`/api/admin/courses?orgId=${DEMO_ORG_ID}`);
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
  });

  it('applies the same org scoping rules to admin document listings', async () => {
    const unauthorized = await fetchJson('/api/admin/documents?orgId=unauthorized-org');
    expect(unauthorized.res.status).toBe(403);
    expect(unauthorized.body).toHaveProperty('error', 'org_access_denied');

    const authorized = await fetchJson(`/api/admin/documents?orgId=${DEMO_ORG_ID}`);
    expect(authorized.res.status).toBe(200);
    expect(Array.isArray(authorized.body?.data || [])).toBe(true);
  });

  it('prevents platform admin from bypassing org scope between orgs', async () => {
    const { res: resA } = await fetchJson(`/api/admin/courses?orgId=${DEMO_ORG_ID}`);
    expect(resA.status).toBe(200);

    const { res: resB, body: bodyB } = await fetchJson('/api/admin/courses?orgId=forbidden-org');
    expect(resB.status).toBe(403);
    expect(bodyB).toHaveProperty('error', 'org_access_denied');
  });
});
