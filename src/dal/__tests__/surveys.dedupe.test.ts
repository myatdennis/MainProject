import { afterEach, describe, expect, it, vi } from 'vitest';

describe('survey assignment request dedupe', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('collapses concurrent learner assigned-survey reads into one request', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      data: [
        {
          assignment: {
            id: 'assignment-1',
            survey_id: 'survey-1',
            user_id: 'user-123',
            assignment_type: 'survey',
            status: 'assigned',
          },
          survey: {
            id: 'survey-1',
            title: 'Pulse survey',
            status: 'published',
          },
        },
      ],
      meta: { hydrationPending: false },
    });

    vi.doMock('../http', () => ({
      request: requestMock,
    }));
    vi.doMock('../../utils/assignmentStorage', () => ({
      mapAssignmentsFromApiRows: (rows: any[]) =>
        rows.map((row) => ({
          id: row.id,
          surveyId: row.survey_id,
          userId: row.user_id,
          assignmentType: row.assignment_type,
          status: row.status,
          progress: row.progress ?? 0,
        })),
    }));
    vi.doMock('../../utils/orgHeaders', () => ({
      buildOrgHeaders: () => ({ 'X-Org-Id': 'org-1' }),
    }));

    const { fetchAssignedSurveysForLearner } = await import('../surveys');

    const [first, second] = await Promise.all([
      fetchAssignedSurveysForLearner(),
      fetchAssignedSurveysForLearner(),
    ]);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]?.survey?.title).toBe('Pulse survey');
  });
});
