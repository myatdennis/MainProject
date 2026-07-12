import { describe, it, expect, vi } from 'vitest';
import { createClientSurveysService } from './clientSurveysService.js';

const buildService = ({ surveyStatus }) => {
  const loadSurveyAssignmentForUser = vi.fn();
  const service = createClientSurveysService({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    supabase: {},
    ensureSupabase: () => true,
    requireUserContext: () => ({ userId: 'user-1', organizationIds: ['org-1'] }),
    loadSurveyWithAssignments: async () => ({ id: 'survey-1', status: surveyStatus }),
    loadSurveyAssignmentForUser,
    logSurveyAssignmentEvent: vi.fn(),
    surveyAssignmentType: 'survey',
  });
  return { service, loadSurveyAssignmentForUser };
};

describe('submitClientSurvey status enforcement', () => {
  it('rejects submission to a draft survey with a clear error, without looking up an assignment', async () => {
    const { service, loadSurveyAssignmentForUser } = buildService({ surveyStatus: 'draft' });

    const result = await service.submitClientSurvey({
      req: { params: { id: 'survey-1' }, body: { responses: { q1: 'answer' } } },
      res: {},
    });

    expect(result).toEqual({
      status: 409,
      error: {
        code: 'survey_not_published',
        message: 'This survey is no longer accepting responses.',
      },
    });
    expect(loadSurveyAssignmentForUser).not.toHaveBeenCalled();
  });

  it('rejects submission to an archived survey with a clear error', async () => {
    const { service, loadSurveyAssignmentForUser } = buildService({ surveyStatus: 'archived' });

    const result = await service.submitClientSurvey({
      req: { params: { id: 'survey-1' }, body: { responses: { q1: 'answer' } } },
      res: {},
    });

    expect(result.status).toBe(409);
    expect(result.error.code).toBe('survey_not_published');
    expect(loadSurveyAssignmentForUser).not.toHaveBeenCalled();
  });

  it('does not reject submission to a published survey', async () => {
    const { service } = buildService({ surveyStatus: 'published' });

    const result = await service.submitClientSurvey({
      req: { params: { id: 'survey-1' }, body: { responses: { q1: 'answer' } } },
      res: {},
    });

    expect(result?.error?.code).not.toBe('survey_not_published');
  });
});
