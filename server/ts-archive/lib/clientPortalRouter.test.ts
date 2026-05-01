import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientPortalRouter } from '../routes/clientPortal.js';

const createApp = ({ isDemoOrTestMode = true, supabase = null } = {}) => {
  const app = express();
  app.use(express.json());

  const authenticate = vi.fn((_req, _res, next) => next());
  const requireUserContext = vi.fn(() => ({
    userId: 'user-1',
    userRole: 'learner',
    requestedOrgId: 'org-1',
  }));

  app.use((req, _res, next) => {
    req.user = {
      email: 'learner@example.com',
      memberships: [{ orgId: 'org-1', role: 'learner', status: 'active' }],
      role: 'learner',
    };
    next();
  });

  app.use(
    '/api',
    createClientPortalRouter({
      authenticate,
      logger: { warn: vi.fn() },
      supabase,
      e2eStore: {
        auditLogs: [
          { id: 'log-1', action: 'lesson_viewed', user_id: 'user-1', created_at: '2026-04-11T00:00:00.000Z' },
          { id: 'log-2', action: 'course_completed', user_id: 'user-2', created_at: '2026-04-10T00:00:00.000Z' },
        ],
      },
      isDemoOrTestMode,
      ensureSupabase: vi.fn(() => Boolean(supabase)),
      requireUserContext,
    }),
  );

  return app;
};

describe('client portal router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('returns normalized client me payload', async () => {
    const response = await fetch(`${baseUrl}/api/client/me`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toMatchObject({
      userId: 'user-1',
      email: 'learner@example.com',
      orgId: 'org-1',
    });
    expect(payload.data.portalAccess).toMatchObject({
      learner: true,
      client: true,
    });
  });

  it('returns demo activity records for the current learner', async () => {
    const response = await fetch(`${baseUrl}/api/client/activity?limit=5`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: 'log-1',
      action: 'lesson_viewed',
      userId: 'user-1',
    });
  });
});
