import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import AdminSurveyAnalytics from '../AdminSurveyAnalytics';

const getSurveyByIdMock = vi.fn();
const fetchAdminSurveyResultsMock = vi.fn();
const fetchHdiCohortAnalyticsMock = vi.fn();
const fetchHdiParticipantReportMock = vi.fn();

let activeOrganizationState = {
  activeOrgId: 'org-1',
  organizations: [{ id: 'org-1', label: 'Org 1' }],
  isMultiOrg: false,
};

vi.mock('../../../dal/surveys', () => ({
  getSurveyById: (...args: any[]) => getSurveyByIdMock(...args),
  fetchAdminSurveyResults: (...args: any[]) => fetchAdminSurveyResultsMock(...args),
  fetchHdiCohortAnalytics: (...args: any[]) => fetchHdiCohortAnalyticsMock(...args),
  fetchHdiParticipantReport: (...args: any[]) => fetchHdiParticipantReportMock(...args),
}));

vi.mock('../../../hooks/useActiveOrganization', () => ({
  useActiveOrganization: () => activeOrganizationState,
}));

vi.mock('../../../hooks/useAnalyticsDashboard', () => ({
  useAnalyticsDashboard: () => ({
    data: {
      predictions: [],
      dropoffs: [],
      skillGaps: [],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    lastUpdated: null,
  }),
}));

vi.mock('../../../components/Survey/SurveyAnalyticsDashboard', () => ({
  SurveyAnalyticsDashboardView: () => <div>Analytics dashboard</div>,
  buildSurveySummary: () => ({
    totalResponses: 0,
    avgRating: 0,
    uniqueOrgs: 0,
    courseCoverage: 0,
  }),
}));

describe('AdminSurveyAnalytics', () => {
  beforeEach(() => {
    getSurveyByIdMock.mockReset();
    fetchAdminSurveyResultsMock.mockReset();
    fetchHdiCohortAnalyticsMock.mockReset();
    fetchHdiParticipantReportMock.mockReset();
    activeOrganizationState = {
      activeOrgId: 'org-1',
      organizations: [{ id: 'org-1', label: 'Org 1' }],
      isMultiOrg: false,
    };

    getSurveyByIdMock.mockResolvedValue({
      id: 'survey-1',
      title: 'Leadership Pulse',
      type: 'custom',
    });
    fetchAdminSurveyResultsMock.mockResolvedValue([]);
    fetchHdiCohortAnalyticsMock.mockResolvedValue(null);
    fetchHdiParticipantReportMock.mockResolvedValue([]);
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/admin/surveys/survey-1/analytics']}>
        <Routes>
          <Route path="/admin/surveys/:surveyId/analytics" element={<AdminSurveyAnalytics />} />
        </Routes>
      </MemoryRouter>,
    );

  it('requests admin survey results with the active organization scope', async () => {
    renderPage();

    await waitFor(() => {
      expect(fetchAdminSurveyResultsMock).toHaveBeenCalledWith('survey-1', {
        limit: 100,
        organizationId: 'org-1',
      });
    });
  });

  it('shows an explicit org-selection message instead of firing an unscoped results query for multi-org admins', async () => {
    activeOrganizationState = {
      activeOrgId: null,
      organizations: [
        { id: 'org-1', label: 'Org 1' },
        { id: 'org-2', label: 'Org 2' },
      ],
      isMultiOrg: true,
    };

    renderPage();

    expect(await screen.findByText('Select an organization to review survey results.')).toBeInTheDocument();
    expect(fetchAdminSurveyResultsMock).not.toHaveBeenCalled();
  });
});
