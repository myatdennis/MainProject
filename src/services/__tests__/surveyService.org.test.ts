import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchAssignedSurveys } from '../surveyService';

const apiClientMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiClientMock(...args),
}));

describe('surveyService.fetchAssignedSurveys', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    apiClientMock.mockReset();
    errorSpy.mockClear();
  });

  it('requests surveys with status filter', async () => {
    apiClientMock.mockResolvedValueOnce({
      data: [
        {
          id: 'survey-1',
          title: 'Pulse',
          assignedTo: { organizationIds: ['org-3'] },
        },
      ],
    });

  const surveys = await fetchAssignedSurveys({ status: 'published' });

  expect(apiClientMock).toHaveBeenCalledWith('/api/client/surveys?status=published', { noTransform: true });
    expect(surveys).toHaveLength(1);
    expect(surveys[0]).toMatchObject({ id: 'survey-1', title: 'Pulse' });
  });

  it('filters out surveys assigned to other orgs or users', async () => {
    apiClientMock.mockResolvedValueOnce({
      data: [
        { id: 's1', title: 'Org 1', assignedTo: { organizationIds: ['org-1'] } },
        { id: 's2', title: 'Org 2', assignedTo: { organizationIds: ['org-2'] } },
        { id: 's3', title: 'Target user', assignedTo: { organizationIds: ['org-3'], userIds: ['user-7'] } },
      ],
    });

  const surveys = await fetchAssignedSurveys({ userId: 'user-7' });

    expect(surveys.map((s) => s.id)).toEqual(['s3']);
  });

  it('returns empty array and logs when API call fails', async () => {
    const err = new Error('network');
    apiClientMock.mockRejectedValueOnce(err);

  const surveys = await fetchAssignedSurveys();
    expect(surveys).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[surveyService.fetchAssignedSurveys] Failed to load surveys for org:', err);
  });
});
