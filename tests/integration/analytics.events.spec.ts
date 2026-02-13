import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startTestServer, stopTestServer, TestServerHandle } from './utils/server.ts';

const ORG_ID = '11111111-1111-1111-1111-111111111111';

describe('analytics events API', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  const postEvent = (body: Record<string, any>) =>
    server!.fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Org-Id': ORG_ID,
      },
      body: JSON.stringify(body),
    });

  it('accepts minimal payloads with visibility-only data when org can be derived', async () => {
    const res = await postEvent({
      id: `evt-${randomUUID()}`,
      event_type: 'page_view',
      session_id: 'session-vis',
      user_agent: 'integration-tests',
      payload: { visibility: 'private' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status');
    expect(json.missingOrgContext).toBe(false);
  });

  it('accepts payloads without org context but flags missingOrgContext', async () => {
    const res = await server!.fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `evt-${randomUUID()}`,
        event_type: 'page_view',
        session_id: 'session-no-org',
        user_agent: 'integration-tests',
        payload: { visibility: 'limited' },
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status');
    expect(json.missingOrgContext).toBe(true);
  });

  it('rejects empty payloads with structured error details', async () => {
    const res = await postEvent({});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'ANALYTICS_PAYLOAD_INVALID',
      ok: false,
    });
    expect(Array.isArray(json.details)).toBe(true);
  });
});
