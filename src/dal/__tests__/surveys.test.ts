import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchAssignedSurveysForLearner, getAnalytics, invalidateAssignedSurveysForLearnerCache, listSurveys } from '../surveys';

const requestMock = vi.fn();

vi.mock('../http', () => ({
  request: (...args: any[]) => requestMock(...args),
}));

vi.mock('../../utils/orgHeaders', () => ({
  buildOrgHeaders: () => ({ 'X-Org-Id': 'org-1' }),
}));

vi.mock('../../utils/adminOrgScope', () => ({
  appendAdminOrgIdQuery: (path: string) => `${path}?orgId=org-1`,
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
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/api/client/surveys/assigned',
      expect.objectContaining({ headers: { 'X-Org-Id': 'org-1' } }),
    );
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

    expect(requestMock).toHaveBeenCalledWith('/api/admin/surveys?orgId=org-1');
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
});
