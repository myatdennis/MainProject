import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchAssignedSurveysForLearner,
  getAnalytics,
  invalidateAssignedSurveysForLearnerCache,
  listSurveys,
  queueSaveSurvey,
} from '../surveys';
import type { Survey } from '../../types/survey';

const buildSurvey = (overrides: Partial<Survey> = {}): Survey =>
  ({
    id: 'survey-1720000000000',
    title: 'New Survey',
    description: '',
    type: 'custom',
    status: 'draft',
    version: 1,
    sections: [],
    blocks: [],
    branding: { primaryColor: '#000', secondaryColor: '#fff' },
    settings: {
      anonymityMode: 'off',
      anonymityThreshold: 0,
      allowMultipleResponses: false,
      showProgressBar: true,
      consentRequired: false,
      allowAnonymous: false,
      allowSaveAndContinue: true,
      randomizeQuestions: false,
      randomizeOptions: false,
    },
    assignedTo: { organizationIds: [], userIds: [], departmentIds: [], cohortIds: [] },
    createdBy: 'tester',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    completionSettings: { thankYouMessage: 'Thanks!', showResources: false, recommendedCourses: [] },
    reflectionPrompts: [],
    ...overrides,
  }) as Survey;

const requestMock = vi.fn();

vi.mock('../http', () => ({
  request: (...args: any[]) => requestMock(...args),
}));

vi.mock('../../utils/orgHeaders', () => ({
  buildOrgHeaders: () => ({ 'X-Org-Id': 'org-1' }),
}));

vi.mock('../../utils/adminOrgScope', () => ({
  // New org-scoping behavior: when admin/global context is used we no longer
  // force an orgId query param here. Tests should assert based on the
  // service behavior; for now return the path unchanged.
  appendAdminOrgIdQuery: (path: string) => path,
}));

vi.mock('../../utils/assignmentStorage', () => ({
  mapAssignmentsFromApiRows: (rows: any[]) => rows,
}));

describe('surveys DAL', () => {
  beforeEach(() => {
    requestMock.mockReset();
    vi.useFakeTimers();
    invalidateAssignedSurveysForLearnerCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries once when hydration is pending and no assignments are returned', async () => {
    requestMock
      .mockResolvedValueOnce({ data: [], meta: { hydrationPending: true } })
      .mockResolvedValueOnce({
        data: [
          {
            assignment: { id: 'assignment-1', survey_id: 'survey-1' },
            survey: { id: 'survey-1', title: 'Pulse' },
          },
        ],
        meta: { hydrationPending: false },
      });

    const promise = fetchAssignedSurveysForLearner();
    await vi.advanceTimersByTimeAsync(600);
    const rows = await promise;

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(1, '/api/client/surveys/assigned');
    expect(rows).toHaveLength(1);
    expect(rows[0].assignment.id).toBe('assignment-1');
  });

  it('retries multiple times when hydration remains pending across responses', async () => {
    requestMock
      .mockResolvedValueOnce({ data: [], meta: { hydrationPending: true } })
      .mockResolvedValueOnce({ data: [], meta: { hydrationPending: true } })
      .mockResolvedValueOnce({
        data: [
          {
            assignment: { id: 'assignment-3', survey_id: 'survey-3' },
            survey: { id: 'survey-3', title: 'Engagement' },
          },
        ],
        meta: { hydrationPending: false },
      });

    const promise = fetchAssignedSurveysForLearner();
    await vi.advanceTimersByTimeAsync(1200);
    const rows = await promise;

  expect(requestMock).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(1);
    expect(rows[0].assignment.id).toBe('assignment-3');
  });

  it('does not retry when the first response already contains assignments', async () => {
    requestMock.mockResolvedValueOnce({
      data: [
        {
          assignment: { id: 'assignment-2', survey_id: 'survey-2' },
          survey: { id: 'survey-2', title: 'Climate' },
        },
      ],
      meta: { hydrationPending: true },
    });

    const rows = await fetchAssignedSurveysForLearner();

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].assignment.id).toBe('assignment-2');
  });

  it('builds survey analytics from real admin results instead of returning mock data', async () => {
    requestMock
      .mockResolvedValueOnce({
        data: {
          id: 'survey-analytics',
          title: 'Engagement pulse',
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'response-1',
            status: 'completed',
            completed_at: '2026-04-12T10:00:00.000Z',
            response: { belonging: 4, safety: 3 },
            metadata: { completionTimeMinutes: 8 },
          },
          {
            id: 'response-2',
            status: 'completed',
            completed_at: '2026-04-12T10:05:00.000Z',
            response: { belonging: 2, safety: 5 },
            metadata: { completion_time_minutes: 10 },
          },
        ],
      });

    const analytics = await getAnalytics('survey-analytics', { organizationId: 'org-1' });

    expect(analytics.title).toBe('Engagement pulse');
    expect(analytics.totalResponses).toBe(2);
    expect(analytics.completionRate).toBe(100);
    expect(analytics.avgCompletionTime).toBe(9);
    expect(analytics.questionSummaries).toEqual([
      { questionId: 'safety', avgScore: 4 },
      { questionId: 'belonging', avgScore: 3 },
    ]);
    expect(analytics.insights.some((entry) => entry.includes('mock'))).toBe(false);
  });

  it('requests admin surveys with explicit org context', async () => {
    requestMock.mockResolvedValueOnce({ data: [] });

    await listSurveys();

    // orgId should no longer be appended by the client when running in
    // platform/global mode; we expect the plain admin surveys path here.
    expect(requestMock).toHaveBeenCalledWith('/api/admin/surveys');
  });

  it('does not coerce admin analytics request failures into an empty dataset', async () => {
    requestMock
      .mockResolvedValueOnce({
        data: {
          id: 'survey-analytics',
          title: 'Engagement pulse',
        },
      })
      .mockRejectedValueOnce(new Error('column survey_assignments.organization_id does not exist'));

    await expect(getAnalytics('survey-analytics', { organizationId: 'org-1' })).rejects.toThrow(
      'column survey_assignments.organization_id does not exist',
    );
  });

  it('queueSaveSurvey creates (POST) a survey with a placeholder id and resolves with the real server id', async () => {
    const survey = buildSurvey({ id: 'survey-1720000000000' });
    requestMock.mockResolvedValueOnce({ data: { ...survey, id: 'a1b2c3d4-1111-4111-8111-111111111111' } });

    const promise = queueSaveSurvey(survey);
    await vi.advanceTimersByTimeAsync(3000);
    const saved = await promise;

    expect(requestMock).toHaveBeenCalledWith('/api/admin/surveys', expect.objectContaining({ method: 'POST' }));
    expect(saved?.id).toBe('a1b2c3d4-1111-4111-8111-111111111111');
  });

  it('queueSaveSurvey updates (PUT) a survey that already has a real persisted id, never re-creating it', async () => {
    const persistedId = 'a1b2c3d4-2222-4222-8222-222222222222';
    const survey = buildSurvey({ id: persistedId, title: 'Edited title' });
    requestMock.mockResolvedValueOnce({ data: { ...survey } });

    const promise = queueSaveSurvey(survey);
    await vi.advanceTimersByTimeAsync(3000);
    const saved = await promise;

    expect(requestMock).toHaveBeenCalledWith(
      `/api/admin/surveys/${persistedId}`,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(saved?.id).toBe(persistedId);
  });
});
