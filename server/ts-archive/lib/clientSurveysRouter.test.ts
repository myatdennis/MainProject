import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientSurveysRouter } from '../routes/clientSurveys.js';

const createApp = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const e2eStore = {
    surveys: new Map([
      [
        'survey-1',
        {
          id: 'survey-1',
          title: 'Pulse Survey',
          status: 'published',
          assignedTo: { organizationIds: ['org-1'] },
        },
      ],
    ]),
    assignments: [
      {
        id: 'assignment-1',
        survey_id: 'survey-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        assignment_type: 'survey',
        active: true,
        status: 'assigned',
      },
    ],
    surveyResponses: [],
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'client-survey-req-1';
    next();
  });
  app.use(
    '/api/client/surveys',
    createClientSurveysRouter({
      logger,
      supabase: null,
      e2eStore,
      isDemoMode: true,
      isDemoOrTestMode: true,
      ensureSupabase: () => true,
      requireUserContext: vi.fn(() => ({
        userId: 'user-1',
        organizationIds: ['org-1'],
        isPlatformAdmin: false,
        activeOrganizationId: 'org-1',
      })),
      loadSurveyWithAssignments: vi.fn(async (id) => e2eStore.surveys.get(id) ?? null),
      fetchSurveyAssignmentsMap: vi.fn(async () => new Map()),
      applyAssignmentToSurvey: (survey) => survey,
      listDemoSurveys: () => Array.from(e2eStore.surveys.values()),
      loadSurveyAssignmentForUser: vi.fn(async () => e2eStore.assignments[0]),
      createEmptyAssignedTo: () => ({ organizationIds: [], userIds: [], cohortIds: [], departmentIds: [] }),
      updateDemoSurveyAssignments: vi.fn(),
      persistE2EStore: vi.fn(),
      logSurveyAssignmentEvent: vi.fn(),
      refreshSurveyAssignmentAggregates: vi.fn(),
      surveyAssignmentType: 'survey',
      isHdiAssessment: () => false,
      normalizeHdiAdministrationType: (value) => value,
      normalizeHdiLinkedAssessmentId: (value) => value,
      buildParticipantIdentity: vi.fn(),
      validateHdiSubmissionContract: vi.fn(() => ({ ok: true })),
      scoreHdiSubmission: vi.fn(),
      buildHdiProfile: vi.fn(),
      buildHdiReport: vi.fn(),
      compareHdiReports: vi.fn(),
      buildHdiComparison: vi.fn(),
      findLatestHdiPreRecord: vi.fn(() => null),
      toHdiRecord: (row) => row,
      createHdiResponseEnvelope: (_shape, data) => ({ data }),
      hdiResponseShapes: { LEARNER_RESULTS: 'learner-results' },
      hdiMetadataContractVersion: 'v1',
      firstRow: (result) => result?.data?.[0] ?? null,
    }),
  );
  return app;
};

describe('client surveys router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('lists learner-visible surveys through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/surveys`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('submits a learner survey through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/surveys/survey-1/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'assignment-1', responses: { q1: 'answer' } }),
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.survey_id).toBe('survey-1');
  });

  it('returns learner results through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/client/surveys/survey-1/results?assignmentId=assignment-1`);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.assignmentId).toBe('assignment-1');
  });

  it('returns a valid empty learner results payload instead of 500 for invalid uuid filter contexts', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.requestId = 'client-survey-req-invalid-uuid';
      next();
    });
    app.use(
      '/api/client/surveys',
      createClientSurveysRouter({
        logger,
        supabase: {
          from() {
            const builder: any = {
              select() {
                return builder;
              },
              eq() {
                return builder;
              },
              order() {
                return builder;
              },
              limit() {
                return builder;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: null,
                  error: {
                    code: '22P02',
                    message: 'invalid input syntax for type uuid: "platform-admin"',
                  },
                });
              },
              then(resolve: (value: any) => any) {
                return Promise.resolve(resolve({ data: [], error: null }));
              },
            };
            return builder;
          },
        },
        e2eStore: { surveys: new Map(), assignments: [], surveyResponses: [] },
        isDemoMode: false,
        isDemoOrTestMode: false,
        ensureSupabase: () => true,
        requireUserContext: vi.fn(() => ({
          userId: 'platform-admin',
          organizationIds: ['org-1'],
          isPlatformAdmin: true,
          activeOrganizationId: 'org-1',
          userRole: 'admin',
          platformRole: 'platform_admin',
        })),
        loadSurveyWithAssignments: vi.fn(async () => ({ id: 'survey-1', title: 'Pulse Survey' })),
        fetchSurveyAssignmentsMap: vi.fn(async () => new Map()),
        applyAssignmentToSurvey: (survey) => survey,
        listDemoSurveys: () => [],
        loadSurveyAssignmentForUser: vi.fn(async () => {
          const err: any = new Error('invalid input syntax for type uuid: "platform-admin"');
          err.code = '22P02';
          throw err;
        }),
        createEmptyAssignedTo: () => ({ organizationIds: [], userIds: [], cohortIds: [], departmentIds: [] }),
        updateDemoSurveyAssignments: vi.fn(),
        persistE2EStore: vi.fn(),
        logSurveyAssignmentEvent: vi.fn(),
        refreshSurveyAssignmentAggregates: vi.fn(),
        surveyAssignmentType: 'survey',
        isHdiAssessment: () => false,
        normalizeHdiAdministrationType: (value) => value,
        normalizeHdiLinkedAssessmentId: (value) => value,
        buildParticipantIdentity: vi.fn(),
        validateHdiSubmissionContract: vi.fn(() => ({ ok: true })),
        scoreHdiSubmission: vi.fn(),
        buildHdiProfile: vi.fn(),
        buildHdiReport: vi.fn(),
        compareHdiReports: vi.fn(),
        buildHdiComparison: vi.fn(() => null),
        findLatestHdiPreRecord: vi.fn(() => null),
        toHdiRecord: (row) => row,
        createHdiResponseEnvelope: (_shape, data) => ({ data }),
        hdiResponseShapes: { LEARNER_RESULTS: 'learner-results' },
        hdiMetadataContractVersion: 'v1',
        firstRow: (result) => result?.data?.[0] ?? null,
      }),
    );

    const localServer = app.listen(0);
    await new Promise((resolve) => localServer.once('listening', resolve));
    const localBaseUrl = `http://127.0.0.1:${localServer.address().port}`;

    try {
      const response = await fetch(`${localBaseUrl}/api/client/surveys/survey-1/results`);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.data.latest).toBeNull();
      expect(payload.data.assignmentId).toBeNull();
    } finally {
      await new Promise((resolve, reject) => localServer.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
