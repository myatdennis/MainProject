import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, type TestServerHandle } from './utils/server';

const SCHEMA_ERROR_CODES = new Set(['PGRST204', 'PGRST205']);

const assertNoSchemaCacheWarning = (payload: Record<string, any> | null | undefined) => {
  if (!payload) return;
  const reason = typeof payload.reason === 'string' ? payload.reason : null;
  const code = typeof payload.errorCode === 'string' ? payload.errorCode : null;
  if (reason && SCHEMA_ERROR_CODES.has(reason)) {
    throw new Error(`Schema cache failure detected (reason=${reason})`);
  }
  if (code && SCHEMA_ERROR_CODES.has(code)) {
    throw new Error(`Schema cache failure detected (errorCode=${code})`);
  }
  const diagnosticsCode =
    typeof payload?.diagnostics?.membership?.code === 'string' ? payload.diagnostics.membership.code : null;
  if (diagnosticsCode && SCHEMA_ERROR_CODES.has(diagnosticsCode)) {
    throw new Error(`Membership diagnostics indicate schema cache failure (${diagnosticsCode})`);
  }
};

describe('schema resilience guards', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('keeps /api/audit-log free of schema cache errors', async () => {
    const res = await server!.fetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'integration-test', details: { ok: true } }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    assertNoSchemaCacheWarning(json);
  });

  it('keeps /api/analytics/events free of schema cache errors', async () => {
    const payload = {
      id: `evt-schema-${Date.now()}`,
      event_type: 'page_view',
      session_id: 'schema-check',
      user_agent: 'integration-tests',
      payload: { visibility: 'private' },
    };
    const res = await server!.fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    assertNoSchemaCacheWarning(json);
  });

  it('exposes membership diagnostics without schema cache errors on /api/admin/me', async () => {
    const res = await server!.fetch('/api/admin/me');
    expect(res.status).toBe(200);
    const json = await res.json();
    assertNoSchemaCacheWarning(json);
  });
});
