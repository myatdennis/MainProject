import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecureAuthProvider, useSecureAuth } from '../SecureAuthContext';
import { ApiError } from '../../utils/apiClient';

const apiRequestMock = vi.hoisted(() => vi.fn());
const apiRequestRawMock = vi.hoisted(() => vi.fn());

const supabaseAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => {
  const supabaseClient = { auth: supabaseAuthMock };
  return {
    __esModule: true,
    getSupabase: () => supabaseClient,
    supabase: supabaseClient,
    hasSupabaseConfig: () => true,
  };
});

vi.mock('../../utils/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../utils/apiClient')>('../../utils/apiClient');
  return {
    ...actual,
    default: apiRequestMock,
    apiRequest: apiRequestMock,
    apiRequestRaw: apiRequestRawMock,
    ApiError: actual.ApiError,
  };
});

const buildJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const buildUser = () => ({
  id: 'user-123',
  email: 'admin@the-huddle.co',
  role: 'admin',
  organizationId: 'org-1',
});

const networkError = (url: string) =>
  new ApiError('Network error', 0, url, { code: 'network_error', message: 'Network error—please try again.' });

const AuthProbe = () => {
  const auth = useSecureAuth();
  return (
    <div>
      <span data-testid="auth-status">{auth.authInitializing ? 'loading' : 'ready'}</span>
      <span data-testid="user-email">{auth.user?.email ?? 'anonymous'}</span>
    </div>
  );
};

describe('SecureAuthContext bootstrap', () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-test-token', refresh_token: 'supabase-refresh-token' } },
      error: null,
    });
    supabaseAuthMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-test-token', refresh_token: 'supabase-refresh-token' } },
      error: null,
    });
    supabaseAuthMock.signOut.mockResolvedValue({ error: null });
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: {} });
    apiRequestRawMock.mockReset();
  });

  it('surfaces bootstrap error when refresh fails and spinner stops', async () => {
    apiRequestRawMock.mockImplementation((path: string) => {
      if (path.includes('/auth/session')) {
        throw networkError(path);
      }
      if (path.includes('/api/auth/refresh')) {
        throw networkError(path);
      }
      return Promise.resolve(buildJsonResponse({}));
    });

    render(
      <SecureAuthProvider>
        <AuthProbe />
      </SecureAuthProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Network issue');
  });

  it('allows retryBootstrap to clear error and restore session', async () => {
    let sessionCalls = 0;
    apiRequestRawMock.mockImplementation((path: string) => {
      if (path.includes('/auth/session')) {
        sessionCalls += 1;
        if (sessionCalls === 1) {
          throw networkError(path);
        }
        return Promise.resolve(buildJsonResponse({ user: buildUser() }));
      }
      if (path.includes('/api/auth/refresh')) {
        throw networkError(path);
      }
      return Promise.resolve(buildJsonResponse({}));
    });

    render(
      <SecureAuthProvider>
        <AuthProbe />
      </SecureAuthProvider>,
    );

    const user = userEvent.setup();
    const retryButton = await screen.findByRole('button', { name: /retry/i });
    await user.click(retryButton);
    await waitFor(() => expect(screen.getByTestId('user-email').textContent).toBe('admin@the-huddle.co'));
  });

  it('updates session state when refresh succeeds after bootstrap failure', async () => {
    let sessionAttempts = 0;
    apiRequestRawMock.mockImplementation((path: string) => {
      if (path.includes('/auth/session')) {
        sessionAttempts += 1;
        if (sessionAttempts === 1) {
          throw new ApiError('Unauthorized', 401, path, { message: 'expired' });
        }
        return Promise.resolve(buildJsonResponse({ user: buildUser() }));
      }
      if (path.includes('/api/auth/refresh')) {
        return Promise.resolve(buildJsonResponse({ user: buildUser() }));
      }
      return Promise.resolve(buildJsonResponse({}));
    });

    render(
      <SecureAuthProvider>
        <AuthProbe />
      </SecureAuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user-email').textContent).toBe('admin@the-huddle.co'));
    expect(apiRequestRawMock).toHaveBeenCalledWith('/auth/session', expect.any(Object));
    expect(apiRequestMock).toHaveBeenCalledWith('/api/auth/refresh', expect.any(Object));
  });
});
