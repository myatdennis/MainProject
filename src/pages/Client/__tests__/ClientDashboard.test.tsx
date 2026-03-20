import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ClientDashboard from '../ClientDashboard';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useRoutePrefetch', () => ({
  useRoutePrefetch: () => {},
}));

vi.mock('../../../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    user: {
      id: 'user-123',
      email: 'user@example.com',
    },
  }),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => ({
    sessionStatus: 'authenticated',
    membershipStatus: 'ready',
    membershipCount: 0,
  }),
}));

const getAssignmentsForUserMock = vi.fn(async (_userId?: string | null) => []);

vi.mock('../../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: (userId?: string | null) => getAssignmentsForUserMock(userId),
}));

vi.mock('../../../store/courseStore', () => ({
  courseStore: {
    getCourse: vi.fn(),
    getLearnerCatalogState: vi.fn(() => ({
      status: 'ok',
      lastUpdatedAt: null,
      lastError: null,
      detail: null,
    })),
  },
}));

vi.mock('../../../dal/sync', () => ({
  syncService: {
    subscribe: () => () => {},
    logSyncEvent: vi.fn(),
  },
}));

vi.mock('../../../state/runtimeStatus', () => ({
  isSupabaseOperational: () => true,
  subscribeRuntimeStatus: () => () => {},
}));

describe('ClientDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    getAssignmentsForUserMock.mockClear();
  });

  it('renders no assignments state without redirecting', async () => {
    render(
      <MemoryRouter initialEntries={['/client/dashboard']}>
        <ClientDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No assignments yet/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getAssignmentsForUserMock).toHaveBeenCalledWith('user@example.com');
  });
});
