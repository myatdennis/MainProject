import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuditLogRouter } from '../routes/auditLog.js';

describe('audit log router', () => {
  let server = null;
  let baseUrl = '';
  let e2eStore;

  beforeEach(async () => {
    e2eStore = { auditLogs: [] };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.requestId = 'audit-req-1';
      req.user = { id: 'user-1' };
      next();
    });
    app.use(
      '/api/audit-log',
      createAuditLogRouter({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        supabase: null,
        e2eStore,
        persistE2EStore: vi.fn(),
        isDemoOrTestMode: true,
        normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      }),
    );

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('records audit logs through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/audit-log`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'course_saved', details: { courseId: 'course-1' }, orgId: 'org-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.stored).toBe(true);
    expect(e2eStore.auditLogs).toHaveLength(1);
  });
});
