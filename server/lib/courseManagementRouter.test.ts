import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCourseManagementRouter } from '../routes/courseManagement.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const e2eStore = {
    courses: new Map([
      ['course-1', { id: 'course-1', title: 'Existing Course', organization_id: 'org-1' }],
    ]),
  };
  const handleAdminCourseUpsert = vi.fn(async (_req, res) => {
    res.status(201).json({ data: { id: 'course-1', title: 'Saved Course' } });
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'course-mgmt-req-1';
    next();
  });

  app.use(
    '/api',
    createCourseManagementRouter({
      authenticate: (_req, _res, next) => next(),
      requireOrgAdmin: (_req, _res, next) => next(),
      logger,
      supabase: null,
      ensureSupabase: () => true,
      isDemoOrTestMode: true,
      e2eStore,
      persistE2EStore: vi.fn(),
      requireUserContext: vi.fn(() => ({ userId: 'admin-1', isPlatformAdmin: true })),
      resolveCourseIdentifierToUuid: vi.fn(async (id) => (id === 'course-1' ? 'course-1' : null)),
      isUuid: (value) => typeof value === 'string' && value.length > 0,
      handleAdminCourseUpsert,
      getCourseOrgId: vi.fn(async () => 'org-1'),
      pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
      requireOrgAccess: vi.fn(async () => true),
    }),
  );

  return { app, handleAdminCourseUpsert };
};

describe('course management router', () => {
  let server = null;
  let baseUrl = '';
  let context = null;

  beforeEach(async () => {
    context = createApp();
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('creates a course through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Saved Course' }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.data.title).toBe('Saved Course');
    expect(context.handleAdminCourseUpsert).toHaveBeenCalledTimes(1);
  });

  it('updates a course through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Course' }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.data.id).toBe('course-1');
  });

  it('deletes a course through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/courses/course-1`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(204);
  });
});
