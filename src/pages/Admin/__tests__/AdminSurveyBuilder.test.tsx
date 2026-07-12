import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSurveyBuilder from '../AdminSurveyBuilder';
import type { Survey } from '../../../types/survey';

const getSurveyByIdMock = vi.fn();
const queueSaveSurveyMock = vi.fn();

vi.mock('../../../dal/surveys', () => ({
  getSurveyById: (...args: any[]) => getSurveyByIdMock(...args),
  queueSaveSurvey: (...args: any[]) => queueSaveSurveyMock(...args),
  surveyQueueEvents: new EventTarget(),
  getQueueLength: () => 0,
  getLastFlushTime: () => null,
  flushNow: async () => {},
}));

vi.mock('../../../dal/profile', () => ({
  listOrganizationProfiles: async () => [],
  getOrganizationProfileContext: async () => null,
}));

const buildSurveyWithBrokenMatrix = (): Survey =>
  ({
    id: 'a1b2c3d4-1111-4111-8111-111111111111',
    title: 'Team Survey',
    description: '',
    status: 'draft',
    createdBy: 'tester',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'section-1',
        title: 'Section 1',
        order: 1,
        questions: [
          {
            id: 'q1',
            type: 'matrix',
            title: 'Rate these items',
            required: true,
            order: 1,
            matrixRows: [],
            matrixColumns: ['Good', 'Bad'],
          },
        ],
      },
    ],
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
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    completionSettings: { thankYouMessage: 'Thanks!', showResources: false, recommendedCourses: [] },
    reflectionPrompts: [],
  }) as unknown as Survey;

describe('AdminSurveyBuilder matrix validation', () => {
  beforeEach(() => {
    getSurveyByIdMock.mockReset();
    queueSaveSurveyMock.mockReset();
  });

  it('blocks saving a required matrix question with zero rows and shows a clear error', async () => {
    const survey = buildSurveyWithBrokenMatrix();
    getSurveyByIdMock.mockResolvedValue(survey);

    render(
      <MemoryRouter initialEntries={[`/admin/surveys/builder/${survey.id}`]}>
        <Routes>
          <Route path="/admin/surveys/builder/:surveyId" element={<AdminSurveyBuilder />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Team Survey')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(
      await screen.findByText(/required matrix question with no rows/i),
    ).toBeInTheDocument();
    expect(queueSaveSurveyMock).not.toHaveBeenCalled();
  });

  it('allows saving once the matrix question has at least one row', async () => {
    const survey = buildSurveyWithBrokenMatrix();
    survey.sections[0].questions[0].matrixRows = ['Row 1'];
    getSurveyByIdMock.mockResolvedValue(survey);
    queueSaveSurveyMock.mockResolvedValue({ ...survey });

    render(
      <MemoryRouter initialEntries={[`/admin/surveys/builder/${survey.id}`]}>
        <Routes>
          <Route path="/admin/surveys/builder/:surveyId" element={<AdminSurveyBuilder />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Team Survey')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(queueSaveSurveyMock).toHaveBeenCalled();
    });
    expect(screen.queryByText(/required matrix question with no rows/i)).not.toBeInTheDocument();
  });
});
