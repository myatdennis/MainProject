import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  bootstrapComplete: true,
  authSettled: true,
  authStatus: 'authenticated',
  sessionStatus: 'authenticated',
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

  it('renders protected content while membership status is loading (session already authenticated)', () => {
    // Once sessionStatus === 'authenticated', hasResolvedAuthRef is set to true.
    // From that point on RequireAuth never blocks the render for membership loading —
    // the layout must stay mounted so navigation commits instantly without a spinner flash.
    renderGuard({
      membershipStatus: 'loading',
      hasActiveMembership: false,
      user: { id: 'user-1', role: 'learner', email: 'learner@example.com' },
    });

    // Children are rendered immediately; no full-screen spinner blocks the UI.
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
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

  it('renders membership error state and retries session load', async () => {
    const user = userEvent.setup();
    const reloadSession = vi.fn().mockResolvedValue(true);
    renderGuard({
      membershipStatus: 'error',
      hasActiveMembership: false,
      memberships: [],
      reloadSession,
    });
    expect(screen.getByText(/Trouble loading your account/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry now/i }));
    expect(reloadSession).toHaveBeenCalledWith({ surface: 'lms', force: true });
  });
});
