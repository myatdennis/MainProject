import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SecureAuthProvider, useSecureAuth } from '../SecureAuthContext';
import * as secureStorage from '../../lib/secureStorage';
import type { SessionMetadata, UserSession } from '../../lib/secureStorage';

vi.mock('../../services/auditLogService', () => ({
  logAuditAction: vi.fn(),
}));

const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockUse = vi.hoisted(() => vi.fn());

vi.mock('axios', () => {
  const create = vi.fn(() => ({
    post: mockPost,
    get: mockGet,
    interceptors: { request: { use: mockUse } },
  }));
  return {
    default: {
      create,
      isAxiosError: (error: any) => Boolean(error?.isAxiosError),
    },
  };
});

const storedState = {
  user: null as UserSession | null,
  metadata: null as SessionMetadata | null,
};

const spies = {
  setUserSession: vi.spyOn(secureStorage, 'setUserSession'),
  getUserSession: vi.spyOn(secureStorage, 'getUserSession'),
  setSessionMetadata: vi.spyOn(secureStorage, 'setSessionMetadata'),
  getSessionMetadata: vi.spyOn(secureStorage, 'getSessionMetadata'),
  clearAuth: vi.spyOn(secureStorage, 'clearAuth'),
  migrateFromLocalStorage: vi.spyOn(secureStorage, 'migrateFromLocalStorage'),
};

const resetSecureState = () => {
  storedState.user = null;
  storedState.metadata = null;
};

const setupSecureStorageSpies = () => {
  spies.setUserSession.mockImplementation((user) => {
    storedState.user = user;
  });
  spies.getUserSession.mockImplementation(() => storedState.user);
  spies.setSessionMetadata.mockImplementation((metadata) => {
    storedState.metadata = { ...(storedState.metadata ?? {}), ...metadata };
  });
  spies.getSessionMetadata.mockImplementation(() => storedState.metadata);
  spies.clearAuth.mockImplementation(() => {
    resetSecureState();
  });
  spies.migrateFromLocalStorage.mockImplementation(() => {});
};

const renderAuth = () =>
  renderHook(() => useSecureAuth(), {
    wrapper: ({ children }) => <SecureAuthProvider>{children}</SecureAuthProvider>,
  });

describe('SecureAuthContext', () => {
    beforeEach(() => {
      resetSecureState();
      Object.values(spies).forEach((spy) => spy.mockClear());
      setupSecureStorageSpies();
      mockPost.mockReset();
      mockGet.mockReset();
      mockUse.mockClear();
    });

  it('stores session tokens and exposes authenticated user after login', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    mockPost.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'admin@thehuddle.co',
          role: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          organizationId: 'org-1',
        },
        expiresAt: Date.now() + 60_000,
        refreshExpiresAt: Date.now() + 120_000,
      },
    });

    let loginResult: Awaited<ReturnType<typeof result.current.login>>;
    await act(async () => {
      loginResult = await result.current.login('admin@thehuddle.co', 'securePass123', 'admin');
    });

    expect(loginResult!.success).toBe(true);
    await waitFor(() => expect(result.current.user?.email).toBe('admin@thehuddle.co'));
    expect(result.current.isAuthenticated.admin).toBe(true);
    expect(spies.setUserSession).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@thehuddle.co', organizationId: 'org-1' }),
    );
  });

  it('refreshToken replaces stored tokens and metadata when server responds', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    mockPost.mockImplementation((url: string) => {
      if (url === '/auth/refresh') {
        return Promise.resolve({
          data: {
            expiresAt: 111,
            refreshExpiresAt: 222,
          },
        });
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    let refreshResult: boolean | undefined;
    await act(async () => {
      refreshResult = await result.current.refreshToken();
    });

    expect(refreshResult).toBe(true);
    expect(storedState.metadata).toMatchObject({ accessExpiresAt: 111, refreshExpiresAt: 222 });
    expect(mockPost).toHaveBeenCalledWith('/auth/refresh', {}, { withCredentials: true });
  });

  it('logout clears secure storage and resets auth booleans', async () => {
    storedState.user = {
      id: 'admin-user',
      email: 'admin@thehuddle.co',
      role: 'admin',
      organizationId: 'org-1',
    } as UserSession;
    mockGet.mockResolvedValueOnce({ data: { valid: true } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.email).toBe('admin@thehuddle.co'));

    mockPost.mockResolvedValueOnce({ data: { success: true } });
    await act(async () => {
      await result.current.logout();
    });

    expect(spies.clearAuth).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toEqual({ lms: false, admin: false });
  });

  it('returns friendly errors on invalid credentials', async () => {
    const axiosError = { isAxiosError: true, response: { status: 401 } };
    mockPost.mockRejectedValueOnce(axiosError);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('admin@thehuddle.co', 'bad-pass', 'admin');
    });

    expect(loginResult).toMatchObject({ success: false, errorType: 'invalid_credentials' });
    expect(storedState.user).toBeNull();
  });
});
