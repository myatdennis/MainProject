import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createMemberAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';

describe('Client assignments API', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('returns empty payload when user has no assignments', async () => {
    const userId = `learner-${randomUUID()}`;
    const headers = {
      ...(await createMemberAuthHeaders({ email: `${userId}@example.com` })),
      'x-user-id': userId,
      'x-user-role': 'member',
    };

    const response = await server!.fetch('/api/client/assignments', {
      headers,
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      data: [],
      count: 0,
      orgId: null,
    });
  });
});
