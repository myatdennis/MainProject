import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchAssignedSurveysForLearner } from '../surveys';

const requestMock = vi.fn();

vi.mock('../http', () => ({
  request: (...args: any[]) => requestMock(...args),
}));

vi.mock('../../utils/orgHeaders', () => ({
  buildOrgHeaders: () => ({ 'X-Org-Id': 'org-1' }),
}));

vi.mock('../../utils/assignmentStorage', () => ({
  mapAssignmentsFromApiRows: (rows: any[]) => rows,
}));

describe('surveys DAL', () => {
  beforeEach(() => {
    requestMock.mockReset();
    vi.useFakeTimers();
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
});

