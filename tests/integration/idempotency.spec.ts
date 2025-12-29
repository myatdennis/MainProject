import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { startTestServer, stopTestServer, createAdminAuthHeaders, TestServerHandle } from './utils/server.ts';

let server: TestServerHandle | null = null;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await stopTestServer(server);
  server = null;
});

describe('Idempotency keys (integration)', () => {
  it('should accept a course upsert and reject duplicate idempotency_key', async () => {
    const body = {
      course: { title: 'Integration Test Course' },
      modules: [],
      idempotency_key: 'itest-key-1'
    };

    const res1 = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...createAdminAuthHeaders() },
      body: JSON.stringify(body),
    });
    expect([200, 201]).toContain(res1.status);
    const json1 = await res1.json();
    expect(json1).toHaveProperty('data');

    // Retry with same idempotency key should be treated as duplicate
    const res2 = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...createAdminAuthHeaders() },
      body: JSON.stringify(body),
    });
    const json2 = await res2.json();
    if (res2.status === 409) {
      expect(json2).toHaveProperty('error', 'idempotency_conflict');
    } else {
      expect(res2.status).toBe(200);
      expect(json2).toHaveProperty('idempotent', true);
      expect(json2).toHaveProperty('data');
    }
  }, 20000);
});
