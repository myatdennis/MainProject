import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminCrmRouter } from '../routes/adminCrm.js';

describe('admin crm router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = 'crm-req-1';
      next();
    });
    app.use(
      '/api/admin/crm',
      createAdminCrmRouter({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        loadCrmSummary: vi.fn(async () => ({ organizations: { total: 4 } })),
        loadCrmActivity: vi.fn(async () => ({ notifications: [{ id: 'note-1' }] })),
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

  it('returns crm summary through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/crm/summary`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.organizations.total).toBe(4);
  });

  it('returns crm activity through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/crm/activity`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.notifications[0].id).toBe('note-1');
  });
});
