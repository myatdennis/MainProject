import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import ClientSurveys from '../ClientSurveys';

const mockNavigate = vi.fn();
const fetchAssignedSurveysForLearnerMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../dal/surveys', () => ({
  fetchAssignedSurveysForLearner: () => fetchAssignedSurveysForLearnerMock(),
}));

vi.mock('../../../utils/surveyAssignmentEvents', () => ({
  subscribeSurveyAssignmentsChanged: () => () => {},
}));

describe('ClientSurveys', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    fetchAssignedSurveysForLearnerMock.mockReset();
  });

  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/client/surveys']}>
          <Routes>
            <Route path="/client/surveys" element={<ClientSurveys />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

  it('renders assigned surveys and does not show the empty state when data exists', async () => {
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
        },
      },
    ]);

    renderPage();

    expect(await screen.findByText('Leadership Pulse')).toBeInTheDocument();
    expect(screen.queryByText('No surveys assigned')).not.toBeInTheDocument();
  });

  it('opens the learner survey flow using the assignment survey id fallback', async () => {
    fetchAssignedSurveysForLearnerMock.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-fallback',
          userId: 'user-1',
          status: 'assigned',
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            survey_title: 'Fallback Survey',
          },
        },
        survey: null,
      },
    ]);

    renderPage();

    expect(await screen.findByText('Fallback Survey')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open survey' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/client/surveys/survey-fallback/take?assignmentId=assignment-1');
    });
  });

  it('shows an error state when assigned surveys fail to load instead of a fake empty state', async () => {
    fetchAssignedSurveysForLearnerMock.mockRejectedValue(new Error('backend failed'));

    renderPage();

    expect(await screen.findByText('Unable to load surveys right now. Please retry soon.')).toBeInTheDocument();
    expect(screen.queryByText('No surveys assigned')).not.toBeInTheDocument();
  });
});
