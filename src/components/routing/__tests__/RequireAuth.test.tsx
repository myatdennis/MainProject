import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequireAuth from '../RequireAuth';

const authHookMocks = vi.hoisted(() => ({
  useSecureAuth: vi.fn(),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  __esModule: true,
  useSecureAuth: authHookMocks.useSecureAuth,
}));

const mockUseSecureAuth = authHookMocks.useSecureAuth as Mock;

const createAuthState = (overrides: Record<string, unknown> = {}) => ({
  isAuthenticated: { lms: true, admin: false },
  authInitializing: false,
  authStatus: 'authenticated',
  sessionStatus: 'ready',
  membershipStatus: 'ready',
  hasActiveMembership: true,
  surfaceAuthStatus: { admin: 'ready', lms: 'ready' },
  orgResolutionStatus: 'ready',
  user: { id: 'user-1', role: 'learner', email: 'learner@example.com' },
  memberships: [],
  organizationIds: [],
  activeOrgId: null,
  lastActiveOrgId: null,
  requestedOrgId: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  forgotPassword: vi.fn(),
  sendMfaChallenge: vi.fn(),
  verifyMfa: vi.fn(),
  setActiveOrganization: vi.fn().mockResolvedValue(undefined),
  setRequestedOrgHint: vi.fn(),
  reloadSession: vi.fn().mockResolvedValue(true),
  loadSession: vi.fn().mockResolvedValue(true),
  retryBootstrap: vi.fn(),
  ...overrides,
});

const renderGuard = (authOverrides: Record<string, unknown> = {}) => {
  mockUseSecureAuth.mockReturnValue(createAuthState(authOverrides));
  render(
    <MemoryRouter initialEntries={['/client-portal']}>
      <RequireAuth mode="lms">
        <div data-testid="protected-content">allowed</div>
      </RequireAuth>
    </MemoryRouter>,
  );
};

describe('RequireAuth guard', () => {
  beforeEach(() => {
    mockUseSecureAuth.mockReset();
  });

  it('renders loading spinner while membership status is loading', () => {
    renderGuard({
      membershipStatus: 'loading',
      hasActiveMembership: false,
      user: { id: 'user-1', role: 'learner', email: 'learner@example.com' },
    });

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('does not redirect when active membership exists after resolution', () => {
    renderGuard({
      membershipStatus: 'ready',
      hasActiveMembership: true,
      memberships: [{ orgId: 'org-1', status: 'active' }],
      activeOrgId: 'org-1',
    });

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
