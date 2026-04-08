import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import ClientSurveyTake from '../ClientSurveyTake';

const fetchAssignedSurveysForLearnerMock = vi.fn();

vi.mock('../../../dal/surveys', () => ({
  fetchAssignedSurveysForLearner: () => fetchAssignedSurveysForLearnerMock(),
  saveLearnerSurveyProgress: vi.fn(),
  submitLearnerSurveyResponse: vi.fn(),
}));

describe('ClientSurveyTake', () => {
  beforeEach(() => {
    fetchAssignedSurveysForLearnerMock.mockReset();
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
});
