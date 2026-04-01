import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getUserTransferToastMessage } from '../AdminUsers';

let apiRequestMock = vi.fn();
const showToastMock = vi.fn();

let currentAuthContext = {
  activeOrgId: 'org-1',
  user: { id: 'admin', role: 'admin', isPlatformAdmin: true },
};

vi.mock('../../../utils/apiClient', () => ({
  default: (...args: any[]) => apiRequestMock(...args),
}));

vi.mock('../../../dal/orgs', () => ({
  listOrgs: vi.fn(async () => [
    { id: 'org-1', name: 'Org 1' },
    { id: 'org-2', name: 'Org 2' },
  ]),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => currentAuthContext,
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock('../../../components/AddUserModal', () => ({
  default: () => <div data-testid="AddUserModal" />,
}));

vi.mock('../../../components/UserCsvImportModal', () => ({
  default: () => <div data-testid="UserCsvImportModal" />,
}));

vi.mock('../../../components/CourseAssignmentModal', () => ({
  default: () => <div data-testid="CourseAssignmentModal" />,
}));

vi.mock('../../../components/LoadingButton', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('../../../components/PageWrapper', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/Breadcrumbs', () => ({
  default: () => <div data-testid="Breadcrumbs" />,
}));

vi.mock('../../../components/ui/EmptyState', () => ({
  default: () => <div data-testid="EmptyState" />,
}));

vi.mock('../../../components/ui/ActionsMenu', () => ({
  default: () => <div data-testid="ActionsMenu" />,
}));

vi.mock('../../../hooks/useRouteChangeReset', () => ({
  useRouteChangeReset: () => ({ routeKey: 'fake' }),
}));

vi.mock('../../../hooks/useNavTrace', () => ({
  useNavTrace: () => undefined,
}));

vi.mock('../../../components/LoadingComponents', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));

describe('AdminUsers page', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    showToastMock.mockReset();
    currentAuthContext = {
      activeOrgId: 'org-1',
      user: { id: 'admin', role: 'admin', isPlatformAdmin: true },
    };
  });

  const userResponse = (organizationId: string) => ({
    data: [
      {
        user_id: 'user-1',
        organization_id: organizationId,
        email: 'user@example.com',
        first_name: 'User',
        last_name: 'One',
        role: 'member',
        status: 'active',
      },
    ],
  });

  const renderPage = async () => {
    const AdminUsers = (await import('../AdminUsers')).default;
    const queryClient = new QueryClient();

    return render(
      <MemoryRouter initialEntries={[{ pathname: '/admin/users' }]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/admin/users" element={<AdminUsers />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('platform admin fetches global user list by default', async () => {
    apiRequestMock.mockResolvedValueOnce(userResponse('org-1'));

    await renderPage();

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/api/admin/users', { noTransform: true });
    });
  });

  it('platform admin fetches org-scoped list when org filter is selected', async () => {
    apiRequestMock.mockResolvedValueOnce(userResponse('org-1'));
    apiRequestMock.mockResolvedValueOnce(userResponse('org-2'));

    await renderPage();

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/api/admin/users', { noTransform: true });
    });

    const orgSelect = document.querySelector('select[aria-label="Filter by organization"]');
    if (!orgSelect) throw new Error('Organization filter not found');

    fireEvent.change(orgSelect, { target: { value: 'org-2' } });

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/api/admin/users?orgId=org-2', { noTransform: true });
    });
  });

  it('org admin fetches only active org users even when filter is all', async () => {
    currentAuthContext = {
      activeOrgId: 'org-1',
      user: { id: 'org-admin', role: 'owner', isPlatformAdmin: false },
    };

    apiRequestMock.mockResolvedValueOnce(userResponse('org-1'));

    await renderPage();

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/api/admin/users?orgId=org-1', { noTransform: true });
    });
  });

  it('produces transfer toast message when user is moved out of current org filter context', () => {
    const message = getUserTransferToastMessage('org-1', { fromOrganizationId: 'org-1', toOrganizationId: 'org-2' }, [
      { id: 'org-2', name: 'Org 2' },
    ]);
    expect(message).toBe('User moved to Org 2 and removed from this list.');
  });

  it('returns null when transfer does not move out of current context', () => {
    const message = getUserTransferToastMessage('org-1', { fromOrganizationId: 'org-1', toOrganizationId: 'org-1' }, [
      { id: 'org-2', name: 'Org 2' },
    ]);
    expect(message).toBeNull();
  });

  it('returns null when no transfer data available', () => {
    const message = getUserTransferToastMessage('org-1', undefined, []);
    expect(message).toBeNull();
  });
});
