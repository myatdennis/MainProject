import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressReadRouter } from '../routes/progressRead.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const e2eStore = {
    lessonProgress: new Map([['learner-1:lesson-1', { lesson_id: 'lesson-1', percent: 75, status: 'in_progress' }]]),
    courseProgress: new Map([['learner-1:course-1', { course_id: 'course-1', percent: 100, status: 'completed', time_spent_s: 120 }]]),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'progress-read-req-1';
    req.user = { userId: 'learner-1', role: 'learner' };
    next();
  });
  app.use('/api', createProgressReadRouter({
    logger,
    supabase: null,
    e2eStore,
    isDemoMode: true,
    isDemoOrTestMode: true,
    ensureSupabase: () => true,
    requireUserContext: vi.fn(() => ({ userId: 'learner-1', organizationIds: ['org-1'] })),
    resolveOrgIdFromRequest: vi.fn(() => 'org-1'),
    parseLessonIdsParam: (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean),
    coerceString: (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '',
    buildLessonRow: (lessonId, row) => ({ lessonId, percent: row?.percent ?? 0, status: row?.status ?? 'not_started' }),
    isMissingRelationError: () => false,
    isMissingColumnError: () => false,
    getLessonProgressOrgColumn: () => 'organization_id',
    writeErrorDiagnostics: vi.fn(),
    pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
    isUuid: () => true,
  }));
  return { app };
};

describe('progress read router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('returns learner lesson progress through extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/learner/progress?lessonIds=lesson-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.lessons[0].percent).toBe(75);
  });

  it('returns client progress summary through extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/progress/summary`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.modulesCompleted).toBe(1);
    expect(payload.data.overallPercent).toBe(100);
  });
});
