import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listOrgPageMock = vi.fn();
const onOrgListInvalidatedMock = vi.fn(() => () => {});
const getOrgProfileDetailsMock = vi.fn();
const getCrmSummaryMock = vi.fn();
const sendBroadcastNotificationMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('../../../dal/orgs', () => ({
  __esModule: true,
  default: {
    listOrgPage: (...args: any[]) => listOrgPageMock(...args),
    onOrgListInvalidated: (...args: any[]) => onOrgListInvalidatedMock(...args),
    getOrgProfileDetails: (...args: any[]) => getOrgProfileDetailsMock(...args),
    updateOrg: vi.fn(),
    deleteOrg: vi.fn(),
    resendOrgInvite: vi.fn(),
  },
}));

vi.mock('../../../dal/crm', () => ({
  getCrmSummary: (...args: any[]) => getCrmSummaryMock(...args),
  sendBroadcastNotification: (...args: any[]) => sendBroadcastNotificationMock(...args),
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => ({ activeOrgId: 'org-1' }),
}));

vi.mock('../../../components/PerformanceComponents', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('../../../hooks/useRouteChangeReset', () => ({
  useRouteChangeReset: () => ({ routeKey: 'org-route-key' }),
}));

vi.mock('../../../hooks/useNavTrace', () => ({
  default: () => undefined,
}));

vi.mock('../../../components/ui/Breadcrumbs', () => ({
  default: () => <div data-testid="breadcrumbs" />,
}));

vi.mock('../../../components/ui/EmptyState', () => ({
  default: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
}));

vi.mock('../../../components/LoadingButton', () => ({
  default: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../../../components/ui/ActionsMenu', () => ({
  default: () => <div data-testid="actions-menu" />,
}));

vi.mock('../../../components/ConfirmationModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/AddOrganizationModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/EditOrganizationModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/Admin/OrgCommunicationPanel', () => ({
  default: () => <div data-testid="org-communication-panel" />,
}));

vi.mock('../../../components/CourseAssignmentModal', () => ({
  default: () => null,
}));

describe('AdminOrganizations page', () => {
  beforeEach(() => {
    listOrgPageMock.mockReset();
    onOrgListInvalidatedMock.mockClear();
    getOrgProfileDetailsMock.mockReset();
    getCrmSummaryMock.mockReset();
    sendBroadcastNotificationMock.mockReset();
    showToastMock.mockReset();

    getCrmSummaryMock.mockResolvedValue({
      organizations: { total: 1, active: 1, onboarding: 0, newThisMonth: 0 },
      users: { total: 2, active: 2, invited: 0, recentActive: 2 },
      assignments: { coursesLast30d: 0, surveysLast30d: 0, overdue: 0 },
      communication: { messagesLast30d: 0, notificationsLast30d: 0, unreadNotifications: 0 },
      invites: { pending: 0, accepted: 0, expired: 0 },
    });
    getOrgProfileDetailsMock.mockResolvedValue(null);
  });

  const renderPage = async () => {
    const AdminOrganizations = (await import('../AdminOrganizations')).default;
    const queryClient = new QueryClient();

    return render(
      <MemoryRouter initialEntries={[{ pathname: '/admin/organizations' }]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/admin/organizations" element={<AdminOrganizations />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  };

  it('shows an error state instead of a false empty state when organizations fail to load', async () => {
    listOrgPageMock.mockRejectedValueOnce(new Error('org_id_required'));

    const screen = await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Unable to load organizations')).toBeTruthy();
    });
    expect(screen.queryByText('No organizations found')).toBeNull();
  });

  it('shows the true empty state when organizations load with zero rows', async () => {
    listOrgPageMock.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 24, total: 0, hasMore: false },
      progress: {},
    });

    const screen = await renderPage();

    await waitFor(() => {
      expect(screen.getByText('No organizations found')).toBeTruthy();
    });
  });
});
