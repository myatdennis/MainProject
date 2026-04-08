import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import ClientSurveyTake from '../ClientSurveyTake';

const fetchAssignedSurveysForLearnerMock = vi.fn();
const saveLearnerSurveyProgressMock = vi.fn();
const submitLearnerSurveyResponseMock = vi.fn();

vi.mock('../../../dal/surveys', () => ({
  fetchAssignedSurveysForLearner: () => fetchAssignedSurveysForLearnerMock(),
  saveLearnerSurveyProgress: (...args: any[]) => saveLearnerSurveyProgressMock(...args),
  submitLearnerSurveyResponse: (...args: any[]) => submitLearnerSurveyResponseMock(...args),
}));

describe('ClientSurveyTake', () => {
  beforeEach(() => {
    fetchAssignedSurveysForLearnerMock.mockReset();
    saveLearnerSurveyProgressMock.mockReset();
    submitLearnerSurveyResponseMock.mockReset();
  });

  it('opens a survey when the assignment provides the matching survey id', async () => {
    fetchAssignedSurveysForLearnerMock.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          userId: 'user-1',
          status: 'assigned',
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        survey: {
          id: 'survey-1',
          title: 'Leadership Pulse',
          description: 'Quarterly check-in',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'text',
                  title: 'How are you feeling about the team right now?',
                  required: true,
                },
              ],
            },
          ],
        },
      },
    ]);

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys/survey-1/take?assignmentId=assignment-1']}>
          <Routes>
            <Route path="/client/surveys/:surveyId/take" element={<ClientSurveyTake />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText('Leadership Pulse')).toBeInTheDocument();
    expect(screen.getByText(/How are you feeling about the team right now\?/i)).toBeInTheDocument();
  });

  it('shows the submitted state when the assignment is already completed on reload', async () => {
    fetchAssignedSurveysForLearnerMock.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          userId: 'user-1',
          status: 'completed',
          progress: 100,
          metadata: {
            last_response_status: 'completed',
            draft_response: {
              q1: 'Strongly agree',
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        survey: {
          id: 'survey-1',
          title: 'Leadership Pulse',
          description: 'Quarterly check-in',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'open-ended',
                  title: 'How are you feeling about the team right now?',
                  required: true,
                },
              ],
            },
          ],
        },
      },
    ]);

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys/survey-1/take?assignmentId=assignment-1']}>
          <Routes>
            <Route path="/client/surveys/:surveyId/take" element={<ClientSurveyTake />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText(/Thanks! Your survey has been submitted./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view results/i })).toBeInTheDocument();
  });

  it('submits a learner survey and shows the confirmed submitted state', async () => {
    fetchAssignedSurveysForLearnerMock.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          userId: 'user-1',
          status: 'assigned',
          progress: 0,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        survey: {
          id: 'survey-1',
          title: 'Leadership Pulse',
          description: 'Quarterly check-in',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'text',
                  title: 'How are you feeling about the team right now?',
                  required: true,
                },
              ],
            },
          ],
        },
      },
    ]);
    submitLearnerSurveyResponseMock.mockResolvedValue({ id: 'response-1' });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys/survey-1/take?assignmentId=assignment-1']}>
          <Routes>
            <Route path="/client/surveys/:surveyId/take" element={<ClientSurveyTake />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type your answer…'), 'Clear and supported.');
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(submitLearnerSurveyResponseMock).toHaveBeenCalledWith(
        'survey-1',
        expect.objectContaining({
          assignmentId: 'assignment-1',
          responses: { q1: 'Clear and supported.' },
        }),
      );
    });
    expect(await screen.findByText(/Thanks! Your survey has been submitted./i)).toBeInTheDocument();
  });

  it('shows a real error state when submit fails instead of implying success', async () => {
    fetchAssignedSurveysForLearnerMock.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          userId: 'user-1',
          status: 'assigned',
          progress: 0,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        survey: {
          id: 'survey-1',
          title: 'Leadership Pulse',
          description: 'Quarterly check-in',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'text',
                  title: 'How are you feeling about the team right now?',
                  required: true,
                },
              ],
            },
          ],
        },
      },
    ]);
    submitLearnerSurveyResponseMock.mockRejectedValue(new Error('submit failed'));

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys/survey-1/take?assignmentId=assignment-1']}>
          <Routes>
            <Route path="/client/surveys/:surveyId/take" element={<ClientSurveyTake />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type your answer…'), 'Clear and supported.');
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    expect(await screen.findByText(/Unable to submit your survey right now\. Please try again\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Thanks! Your survey has been submitted./i)).not.toBeInTheDocument();
  });
});
