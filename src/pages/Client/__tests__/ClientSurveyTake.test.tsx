import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import ClientSurveyTake from '../ClientSurveyTake';

const fetchAssignedSurveysForLearnerMock = vi.fn();
const saveLearnerSurveyProgressMock = vi.fn();
const submitLearnerSurveyResponseMock = vi.fn();
const secureAuthState = {
  value: {
    authInitializing: false,
    sessionStatus: 'authenticated',
    membershipStatus: 'ready',
    activeOrgId: 'org-1',
    isAuthenticated: { client: true, lms: true },
  },
};

vi.mock('../../../dal/surveys', () => ({
  fetchAssignedSurveysForLearner: () => fetchAssignedSurveysForLearnerMock(),
  saveLearnerSurveyProgress: (...args: any[]) => saveLearnerSurveyProgressMock(...args),
  submitLearnerSurveyResponse: (...args: any[]) => submitLearnerSurveyResponseMock(...args),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => secureAuthState.value,
}));

describe('ClientSurveyTake', () => {
  beforeEach(() => {
    fetchAssignedSurveysForLearnerMock.mockReset();
    saveLearnerSurveyProgressMock.mockReset();
    submitLearnerSurveyResponseMock.mockReset();
    secureAuthState.value = {
      authInitializing: false,
      sessionStatus: 'authenticated',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
      isAuthenticated: { client: true, lms: true },
    };
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

  it('renders scale endpoint labels and a visible value readout for likert-scale questions', async () => {
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
          title: 'HDI Assessment',
          description: 'Development inventory',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'likert-scale',
                  title: 'I seek out feedback from people who challenge my thinking.',
                  required: true,
                  scale: { min: 1, max: 5, minLabel: 'Strongly Disagree', maxLabel: 'Strongly Agree' },
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

    expect(await screen.findByText('Strongly Disagree')).toBeInTheDocument();
    expect(screen.getByText('Strongly Agree')).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('—')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '4' } });
    expect(await screen.findByText('4')).toBeInTheDocument();
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

  it('renders ranking items interactively and submits the reordered array', async () => {
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
          title: 'Priorities Survey',
          description: 'Rank what matters most',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'ranking',
                  title: 'Rank these in order of importance',
                  required: true,
                  rankingItems: ['Speed', 'Quality', 'Cost'],
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

    expect(await screen.findByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Move Quality up' }));
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(submitLearnerSurveyResponseMock).toHaveBeenCalledWith(
        'survey-1',
        expect.objectContaining({
          responses: { q1: ['Quality', 'Speed', 'Cost'] },
        }),
      );
    });
  });

  it('allows submitting when a required matrix question has no configured rows', async () => {
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
          title: 'Broken Matrix Survey',
          description: 'Has a misconfigured matrix question',
          sections: [
            {
              id: 'section-1',
              questions: [
                {
                  id: 'q1',
                  order: 1,
                  type: 'matrix',
                  title: 'Rate these items',
                  required: true,
                  matrixRows: [],
                  matrixColumns: ['Good', 'Bad'],
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

    expect(await screen.findByText(/isn.t configured yet and can be skipped/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(submitLearnerSurveyResponseMock).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Please answer all required questions/i)).not.toBeInTheDocument();
  });

  it('shows a distinct success message (not the error banner) when progress save succeeds', async () => {
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
    saveLearnerSurveyProgressMock.mockResolvedValue({ id: 'progress-1' });

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
    await user.click(await screen.findByRole('button', { name: /save progress/i }));

    const successMessage = await screen.findByText(/Progress saved\. You can safely return and finish later\./i);
    expect(successMessage).toHaveClass('text-emerald-700');
    expect(successMessage).not.toHaveClass('text-red-600');
    expect(screen.queryByText(/Please answer all required questions/i)).not.toBeInTheDocument();
  });

  it('waits for learner auth readiness before loading the assigned survey', async () => {
    secureAuthState.value = {
      authInitializing: true,
      sessionStatus: 'loading',
      membershipStatus: 'loading',
      activeOrgId: null,
      isAuthenticated: { client: false, lms: false },
    };

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys/survey-1/take?assignmentId=assignment-1']}>
          <Routes>
            <Route path="/client/surveys/:surveyId/take" element={<ClientSurveyTake />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText('Loading survey…')).toBeInTheDocument();
    expect(fetchAssignedSurveysForLearnerMock).not.toHaveBeenCalled();
  });
});
