import { describe, it, expect } from 'vitest';
import { startTestServer, stopTestServer, createAdminAuthHeaders, getSupabaseAdminClient } from './utils/server.ts';

const createUniqueIdempotencyKey = () => `itest-key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const upsertCourse = async (server: any, headers: Record<string, string>, idempotencyKey = createUniqueIdempotencyKey()) => {
  const body = {
    course: { title: 'Integration Test Course' },
    modules: [],
    idempotency_key: idempotencyKey,
  };
  return server.fetch('/api/admin/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
};

describe('Idempotency keys (integration)', () => {
  it('should accept a course upsert and reject duplicate idempotency_key', async () => {
    const server = await startTestServer();
    try {
      const body = {
        course: { title: 'Integration Test Course' },
        modules: [],
        idempotency_key: 'itest-key-1',
      };

      const res1 = await server.fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await createAdminAuthHeaders()) },
        body: JSON.stringify(body),
      });
      expect([200, 201]).toContain(res1.status);
      const json1 = await res1.json();
      expect(json1).toHaveProperty('data');

      // Retry with same idempotency key should be treated as duplicate
      const res2 = await server.fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await createAdminAuthHeaders()) },
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
    } finally {
      await stopTestServer(server);
    }
  }, 60000);

  it('should use persistent idempotency_keys table in normal integration mode', async () => {
    const server = await startTestServer({ idempotencyFallback: false });
    try {
      const adminHeaders = await createAdminAuthHeaders();
      const headers = adminHeaders as Record<string, string>;
      const idempotencyKey = createUniqueIdempotencyKey();

      const healthRes = await server.fetch('/api/health');
      expect(healthRes.status).toBeGreaterThanOrEqual(200);
      expect(healthRes.status).toBeLessThan(300);

      const res1 = await upsertCourse(server, headers, idempotencyKey);
      expect([200, 201]).toContain(res1.status);
      const json1 = await res1.json();
      expect(json1).toHaveProperty('data');

      const res2 = await upsertCourse(server, headers, idempotencyKey);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2).toHaveProperty('idempotent', true);
      expect(json2).toHaveProperty('data');

      // The idempotency row must exist in DB for persistence mode
      const client = getSupabaseAdminClient();
      expect(client).not.toBeNull();
      const { data: keys, error } = await client.from('idempotency_keys').select('*').eq('id', idempotencyKey).maybeSingle();
      expect(error).toBeNull();
      expect(keys).toBeTruthy();
    } finally {
      await stopTestServer(server);
    }
  }, 30000);

  it('should use in-memory fallback mode when explicitly requested', async () => {
    const server = await startTestServer({ idempotencyFallback: true });
    try {
      const adminHeaders = await createAdminAuthHeaders();
      const headers = adminHeaders as Record<string, string>;
      const idempotencyKey = createUniqueIdempotencyKey();

      const res1 = await upsertCourse(server, headers, idempotencyKey);
      expect([200, 201]).toContain(res1.status);
      const json1 = await res1.json();
      expect(json1).toHaveProperty('data');

      const res2 = await upsertCourse(server, headers, idempotencyKey);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2).toHaveProperty('idempotent', true);
      expect(json2).toHaveProperty('data');
    } finally {
      await stopTestServer(server);
    }
  }, 30000);
});
