import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSurveysRouter } from '../routes/adminSurveys.js';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'survey-req-1';
    next();
  });

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const surveys = new Map();
  const assignments = new Map();
  const e2eStore = {
    surveyResponses: [
      {
        id: 'response-1',
        survey_id: 'survey-1',
        user_id: 'learner-1',
        organization_id: 'org-1',
        completed_at: '2026-04-10T10:00:00.000Z',
        administrationType: 'pre',
        participantKeys: ['participant-1'],
        participantIdentifier: 'participant-1',
      },
      {
        id: 'response-2',
        survey_id: 'survey-1',
        user_id: 'learner-1',
        organization_id: 'org-1',
        completed_at: '2026-04-11T10:00:00.000Z',
        administrationType: 'post',
        participantKeys: ['participant-1'],
        participantIdentifier: 'participant-1',
      },
    ],
  };
  const requireUserContext = vi.fn(() => ({
    userId: 'admin-1',
    isPlatformAdmin: true,
    organizationIds: ['org-1'],
    memberships: [{ orgId: 'org-1', role: 'admin' }],
  }));

  const listDemoSurveys = () => Array.from(surveys.values());
  const getDemoSurveyById = (id) => surveys.get(id) ?? null;
  const upsertDemoSurvey = (payload) => {
    const record = {
      id: payload.id || 'survey-1',
      title: payload.title ?? 'Untitled Survey',
      status: payload.status ?? 'draft',
      assignedTo: payload.assignedTo ?? { organizationIds: [], userIds: [], cohortIds: [], departmentIds: [] },
      updated_at: new Date().toISOString(),
    };
    surveys.set(record.id, record);
    return record;
  };
  const removeDemoSurvey = (id) => surveys.delete(id);

  app.use(
    '/api/admin/surveys',
    createAdminSurveysRouter({
      logger,
      supabase: null,
      e2eStore,
      isDemoOrTestMode: true,
      ensureSupabase: () => true,
      ensureAdminSurveySchemaOrRespond: vi.fn(async () => true),
      requireUserContext,
      requireOrgAccess: vi.fn(async () => true),
      runSupabaseReadQueryWithRetry: vi.fn(),
      runSupabaseQueryWithRetry: vi.fn(),
      runTimedQuery: vi.fn(),
      fetchSurveyAssignmentsMap: vi.fn(async () => assignments),
      applyAssignmentToSurvey: (survey, assignment) => ({
        ...survey,
        assignedTo: assignment?.assignedTo ?? survey.assignedTo ?? { organizationIds: [], userIds: [], cohortIds: [], departmentIds: [] },
      }),
      listDemoSurveys,
      getDemoSurveyById,
      upsertDemoSurvey,
      removeDemoSurvey,
      normalizeAssignedTargets: (payload) => ({
        assignedTo: payload.assignedTo ?? { organizationIds: payload.organizationIds ?? [], userIds: [], cohortIds: [], departmentIds: [] },
      }),
      buildSurveyPersistencePayload: (payload) => payload,
      isMissingColumnError: () => false,
      maybeHandleSurveyColumnError: () => false,
      firstRow: (result) => result?.data?.[0] ?? null,
      syncSurveyAssignments: vi.fn(async () => undefined),
      loadSurveyWithAssignments: vi.fn(async (id) => surveys.get(id) ?? null),
      rememberSurveyIdentifierAlias: vi.fn(),
      resolveSurveyIdentifierToCanonicalId: vi.fn(async (id) => id),
      coerceIdArray: (raw) => (Array.isArray(raw) ? raw : []),
      buildHdiSurveyTemplate: () => ({ id: 'hdi-template', title: 'HDI' }),
      pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
      clampNumber: (value, min, max) => Math.max(min, Math.min(max, value)),
      buildHdiParticipantRows: (rows) => rows.map((row) => ({ participantIdentifier: row.participantIdentifier, responseId: row.id })),
      buildHdiCohortAnalytics: (rows) => ({ totalResponses: rows.length }),
      buildHdiComparison: ({ pre, post }) => ({ pre: pre?.id ?? null, post: post?.id ?? null }),
      createHdiResponseEnvelope: (_shape, data, meta) => ({ data, meta }),
      hdiResponseShapes: {
        PARTICIPANT_REPORT: 'hdi.participant-report.v1',
        COHORT_ANALYTICS: 'hdi.cohort-analytics.v1',
        PRE_POST_COMPARISON: 'hdi.pre-post-comparison.v1',
      },
      toHdiRecord: (row) => row,
    }),
  );

  return { app, surveys };
};

describe('admin surveys router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    context.surveys.set('survey-1', { id: 'survey-1', title: 'Existing Survey', status: 'draft', assignedTo: { organizationIds: ['org-1'] } });
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('lists surveys through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('creates a survey through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'survey-2', title: 'New Survey', status: 'published', organizationIds: ['org-1'] }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.title).toBe('New Survey');
  });

  it('returns the hdi template through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys/templates/hdi`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.id).toBe('hdi-template');
  });

  it('returns admin survey results through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys/survey-1/results?orgId=org-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.meta.count).toBe(2);
  });

  it('returns the hdi participant report through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys/survey-1/hdi/participant-report?orgId=org-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data[0].participantIdentifier).toBe('participant-1');
    expect(payload.meta.surveyId).toBe('survey-1');
  });
});
