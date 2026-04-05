import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, stopTestServer, TestServerHandle } from './utils/server.ts';

const hasContractKeys = (body: Record<string, unknown>) =>
  ['ok', 'data', 'code', 'message', 'meta'].every((key) => Object.prototype.hasOwnProperty.call(body, key));

describe('API response envelope contract', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer({ idempotencyFallback: true });
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('normalizes success responses to include required contract fields', async () => {
    const res = await server!.fetch('/api/client/courses');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect(hasContractKeys(body)).toBe(true);
    expect(body.ok).toBe(true);
  });

  it('normalizes error responses to include required contract fields', async () => {
    const res = await server!.fetch('/api/client/progress/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-e2e-bypass': 'true',
        'x-user-role': 'learner',
        'x-org-id': 'demo-sandbox-org',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(hasContractKeys(body)).toBe(true);
    expect(body.ok).toBe(false);
    expect(typeof body.code === 'string' || body.code === null).toBe(true);
  });

  it('keeps legacy fields while injecting contract fields', async () => {
    const res = await server!.fetch('/api/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(hasContractKeys(body)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, 'timestamp')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, 'status')).toBe(true);
  });
});
