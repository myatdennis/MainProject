import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReflectionsRouter } from '../routes/reflections.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const e2eStore = {
    courses: new Map([
      ['course-1', {
        id: 'course-1',
        organization_id: 'org-1',
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [{ id: 'lesson-1', title: 'Reflection Lesson', module_id: 'module-1' }],
          },
        ],
      }],
    ]),
    lessonReflections: new Map(),
    users: [{ id: 'learner-1', email: 'learner@example.com', full_name: 'Learner One' }],
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'reflections-req-1';
    next();
  });
  app.use('/api', createReflectionsRouter({
    logger,
    supabase: null,
    e2eStore,
    isDemoOrTestMode: true,
    ensureSupabase: () => true,
    requireUserContext: vi.fn((_req, _res) => ({ userId: 'learner-1', organizationIds: ['org-1'], isPlatformAdmin: false })),
    resolveOrgScopeFromRequest: vi.fn(() => ({ orgId: 'org-1', requiresExplicitSelection: false })),
    resolveOrgIdFromRequest: vi.fn(() => 'org-1'),
    defaultSandboxOrgId: 'org-1',
    pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
    coerceString: (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '',
    isMissingRelationError: () => false,
    isMissingColumnError: () => false,
    requireOrgAccess: vi.fn(async () => true),
    persistE2EStore: vi.fn(),
    sql: { begin: vi.fn(async (fn) => fn({})) },
    processGamificationEvent: vi.fn(),
    upsertOrgEngagementMetrics: vi.fn(),
    isUuid: () => true,
  }));

  return { app, e2eStore };
};

describe('reflections router', () => {
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
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('saves and reloads a learner reflection through extracted routes', async () => {
    const saveResponse = await fetch(`${baseUrl}/api/learner/lessons/lesson-1/reflection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ courseId: 'course-1', responseText: 'Team retrospective', status: 'submitted' }),
    });
    const savePayload = await saveResponse.json();
    expect(saveResponse.status).toBe(202);
    expect(savePayload.data.responseText).toContain('Team retrospective');

    const fetchResponse = await fetch(`${baseUrl}/api/learner/lessons/lesson-1/reflection?courseId=course-1`);
    const fetchPayload = await fetchResponse.json();
    expect(fetchResponse.status).toBe(200);
    expect(fetchPayload.data.responseText).toContain('Team retrospective');
  });

  it('lists lesson reflections for admins through extracted routes', async () => {
    context.e2eStore.lessonReflections.set('org-1:course-1:lesson-1:learner-1', {
      id: 'reflection-1',
      organization_id: 'org-1',
      course_id: 'course-1',
      module_id: 'module-1',
      lesson_id: 'lesson-1',
      user_id: 'learner-1',
      response_text: 'Saved reflection',
      response_data: { prompt_response: 'Saved reflection', answers: { promptResponse: 'Saved reflection' } },
      status: 'submitted',
      updated_at: new Date().toISOString(),
    });
    const response = await fetch(`${baseUrl}/api/admin/lessons/lesson-1/reflections?orgId=org-1&courseId=course-1&limit=5`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.total).toBe(1);
    expect(payload.data.rows[0].learnerEmail).toBe('learner@example.com');
  });
});
