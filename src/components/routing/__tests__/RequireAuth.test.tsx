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
  authInitialized: true,
  session: { access_token: 'test-access-token' },
  ...overrides,
});

const renderGuard = (
  authOverrides: Record<string, unknown> = {},
  options: { mode?: 'admin' | 'lms' | 'client'; initialEntries?: string[]; loginPathOverride?: string } = {},
) => {
  mockUseSecureAuth.mockReturnValue(createAuthState(authOverrides));
  render(
    <MemoryRouter initialEntries={options.initialEntries ?? ['/client-portal']}>
      <RequireAuth mode={options.mode ?? 'lms'} loginPathOverride={options.loginPathOverride}>
        <div data-testid="protected-content">allowed</div>
      </RequireAuth>
    </MemoryRouter>,
  );
};

describe('RequireAuth guard', () => {
  beforeEach(() => {
    mockUseSecureAuth.mockReset();
  });

  it('shows loading until auth initialization completes', () => {
    renderGuard({ authInitialized: false, session: null });

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('renders children whenever a Supabase access token exists', () => {
    renderGuard({
      authInitialized: true,
      session: { access_token: 'live-token' },
      user: null,
      authStatus: 'unauthenticated',
      activeOrgId: null,
      isAuthenticated: { admin: false, lms: false, client: false },
    });

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects logged-out protected routes after auth initialization instead of spinning', () => {
    renderGuard({
      authInitialized: true,
      session: null,
    });

    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('uses the admin login path for logged-out admin routes', () => {
    renderGuard(
      {
        authInitialized: true,
        session: null,
      },
      { mode: 'admin', initialEntries: ['/admin'] },
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
