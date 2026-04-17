import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  isAuthenticated: { lms: true, admin: false, client: true },
  authInitializing: false,
  authStatus: 'authenticated',
  sessionStatus: 'authenticated',
  membershipStatus: 'ready',
  hasActiveMembership: true,
  surfaceAuthStatus: { admin: 'ready', lms: 'ready', client: 'ready' },
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

const renderGuard = (
  authOverrides: Record<string, unknown> = {},
  options: { mode?: 'admin' | 'lms' | 'client'; initialEntries?: string[] } = {},
) => {
  mockUseSecureAuth.mockReturnValue(createAuthState(authOverrides));
  render(
    <MemoryRouter initialEntries={options.initialEntries ?? ['/client-portal']}>
      <RequireAuth mode={options.mode ?? 'lms'}>
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

  it('does not reload session when auth and org resolution are already ready for the surface', async () => {
    const loadSession = vi.fn().mockResolvedValue(true);
    renderGuard(
      {
      authStatus: 'authenticated',
      sessionStatus: 'authenticated',
      isAuthenticated: { admin: false, lms: false, client: true },
      surfaceAuthStatus: { admin: 'ready', lms: 'ready', client: 'idle' },
      loadSession,
      user: { id: 'user-1', role: 'learner', email: 'learner@example.com' },
      memberships: [{ orgId: 'org-1', status: 'active' }],
      activeOrgId: 'org-1',
      hasActiveMembership: true,
    },
      { mode: 'client', initialEntries: ['/client/dashboard'] },
    );

    await waitFor(() => expect(screen.getByTestId('protected-content')).toBeInTheDocument());
    expect(loadSession).not.toHaveBeenCalled();
  });

  it('does not request session load while auth bootstrap is still in progress', async () => {
    const loadSession = vi.fn().mockResolvedValue(true);
    renderGuard({
      authInitializing: true,
      authStatus: 'booting',
      sessionStatus: 'loading',
      loadSession,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadSession).not.toHaveBeenCalled();
  });
});
