import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressWriteRouter } from '../routes/progressWrite.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const e2eStore = {
    lessonProgress: new Map(),
    courseProgress: new Map(),
    progressEvents: new Set(),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'progress-write-req-1';
    req.user = { userId: 'learner-1', id: 'learner-1', role: 'learner' };
    next();
  });
  app.use('/api', createProgressWriteRouter({
    logger,
    supabase: null,
    sql: { begin: vi.fn(async (fn) => fn({})) },
    e2eStore,
    isDemoMode: true,
    isDemoOrTestMode: true,
    isTestMode: false,
    ensureSupabase: () => true,
    requireUserContext: vi.fn(() => ({ userId: 'learner-1', organizationIds: ['org-1'], activeOrgId: 'org-1' })),
    resolveOrgScopeFromRequest: vi.fn(() => ({ orgId: 'org-1', requiresExplicitSelection: false })),
    normalizeSnapshotPayload: (body) => body,
    getPayloadSize: () => 0,
    writeErrorDiagnostics: vi.fn(),
    clampPercent: (value) => Math.max(0, Math.min(100, Number(value ?? 0))),
    persistE2EStore: vi.fn(),
    broadcastToTopic: vi.fn(),
    buildProgressSnapshotSeedKey: () => 'seed',
    shouldAttemptProgressSnapshotSeed: () => false,
    markProgressSnapshotSeedAttempt: vi.fn(),
    attachLessonOrgScope: vi.fn(),
    buildLessonProgressConflictTargets: () => ['user_id', 'lesson_id'],
    getLessonProgressOrgColumn: () => 'organization_id',
    upsertWithConflictFallback: vi.fn(),
    normalizeColumnIdentifier: (value) => value,
    extractMissingColumnName: () => null,
    handleLessonOrgColumnMissing: () => false,
    schemaSupportFlags: { lessonProgress: 'modern', courseProgress: 'modern', courseProgressPercentColumn: 'present', courseProgressTimeColumn: 'present' },
    getCachedUserCourseProgressUuidSupport: () => false,
    buildCourseProgressConflictTargets: () => ['user_id', 'course_id'],
    firstRow: (result) => Array.isArray(result?.data) ? result.data[0] ?? null : result?.data?.[0] ?? result?.data ?? result ?? null,
    isMissingColumnError: () => false,
    isUserCourseProgressUuidColumnMissing: () => false,
    isConflictConstraintMissing: () => false,
    createCertificateIfNotExists: vi.fn(),
    recordCourseProgress: vi.fn(),
    recordLessonProgress: vi.fn(),
    recordProgressBatch: vi.fn(),
    checkProgressLimit: () => true,
    randomUUID: () => 'evt-1',
    processGamificationEvent: vi.fn(),
    upsertOrgEngagementMetrics: vi.fn(),
    isUuid: () => true,
    normalizeOrgIdValue: (value) => value,
  }));
  return { app, e2eStore };
};

describe('progress write router', () => {
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

  it('saves learner snapshot through extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/learner/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'learner-1',
        courseId: 'course-1',
        lessons: [{ lessonId: 'lesson-1', progressPercent: 50, completed: false, positionSeconds: 30 }],
        course: { percent: 50, totalTimeSeconds: 30 },
      }),
    });
    const payload = await response.json();
    expect(response.status).toBe(202);
    expect(payload.data.updatedLessons).toBe(1);
    expect(context.e2eStore.lessonProgress.get('learner-1:lesson-1')).toBeTruthy();
  });

  it('saves client course progress through extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/progress/course`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course_id: 'course-1', percent: 100, status: 'completed', time_spent_s: 120 }),
    });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.percent).toBe(100);
    expect(context.e2eStore.courseProgress.get('learner-1:course-1')).toBeTruthy();
  });
});
