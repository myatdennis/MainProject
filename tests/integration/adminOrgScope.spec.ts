import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startTestServer, stopTestServer, TestServerHandle } from './utils/server.ts';

const DEMO_ORG_ID = 'demo-org';
const JSON_HEADERS = {
  Accept: 'application/json',
};

describe('Admin organization scoping', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  const fetchJson = async (path: string) => {
    const res = await server!.fetch(path, { headers: JSON_HEADERS });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

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
});
