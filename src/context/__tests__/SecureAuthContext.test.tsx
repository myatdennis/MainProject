import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SecureAuthProvider, useSecureAuth } from '../SecureAuthContext';
import { ApiError as MockApiError } from '../../utils/apiClient';
import * as secureStorage from '../../lib/secureStorage';
import type { SessionMetadata, UserSession } from '../../lib/secureStorage';

vi.mock('../../services/auditLogService', () => ({
  logAuditAction: vi.fn(),
}));

const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockUse = vi.hoisted(() => vi.fn());
const mockApiRequest = vi.hoisted(() => vi.fn());
const mockApiRequestRaw = vi.hoisted(() => vi.fn());

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

vi.mock('../../utils/apiClient', () => {
  class MockApiError extends Error {
    status?: number;
    url?: string;
    body?: unknown;
    constructor(message: string, status = 500, url = '', body: unknown = null) {
      super(message);
      this.status = status;
      this.url = url;
      this.body = body;
    }
  }
  return {
    __esModule: true,
    default: (...args: unknown[]) => mockApiRequest(...args),
    apiRequestRaw: (...args: unknown[]) => mockApiRequestRaw(...args),
    ApiError: MockApiError,
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

const jsonResponse = (payload: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: new Headers({ 'content-type': 'application/json', ...(init.headers || {}) }),
  });

const defaultRawHandler = (path: string) => {
  if (path === '/api/auth/session') {
    return jsonResponse({
      user: storedState.user,
      expiresAt: Date.now() + 60_000,
      refreshExpiresAt: Date.now() + 120_000,
    });
  }
  return jsonResponse({});
};

describe('SecureAuthContext', () => {
    beforeEach(() => {
      resetSecureState();
      Object.values(spies).forEach((spy) => spy.mockClear());
      setupSecureStorageSpies();
      mockPost.mockReset();
      mockGet.mockReset();
      mockUse.mockClear();
      mockApiRequest.mockReset();
      mockApiRequestRaw.mockReset();
      mockApiRequestRaw.mockImplementation((path: string) => defaultRawHandler(path));
      mockApiRequest.mockResolvedValue({ data: null });
    });

  it('stores session tokens and exposes authenticated user after login', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/api/auth/login') {
        return jsonResponse({
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
        });
      }
      return defaultRawHandler(path);
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
    storedState.user = {
      id: 'user-1',
      email: 'admin@thehuddle.co',
      role: 'admin',
      organizationId: 'org-1',
    } as UserSession;
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    mockApiRequest.mockImplementation((path: string) => {
      if (path === '/api/auth/refresh') {
        return Promise.resolve({ user: storedState.user, expiresAt: 111, refreshExpiresAt: 222 });
      }
      if (path === '/api/auth/session') {
        return Promise.resolve({ user: storedState.user });
      }
      return Promise.resolve({ user: null });
    });

    let refreshResult: boolean | undefined;
    await act(async () => {
      refreshResult = await result.current.refreshToken();
    });

    expect(refreshResult).toBe(true);
    expect(storedState.metadata).toMatchObject({ accessExpiresAt: 111, refreshExpiresAt: 222 });
    expect(mockApiRequest).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      allowAnonymous: true,
      headers: expect.any(Object),
      body: { reason: 'protected_401' },
    });
  });

  it('logout clears secure storage and resets auth booleans', async () => {
    storedState.user = {
      id: 'admin-user',
      email: 'admin@thehuddle.co',
      role: 'admin',
      organizationId: 'org-1',
    } as UserSession;
    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/api/auth/session') {
        return jsonResponse({
          user: storedState.user,
          expiresAt: Date.now() + 60_000,
          refreshExpiresAt: Date.now() + 120_000,
        });
      }
      return defaultRawHandler(path);
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.email).toBe('admin@thehuddle.co'));

    mockApiRequest.mockImplementation((path: string) => {
      if (path === '/api/auth/logout') {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.resolve({ data: null });
    });
    await act(async () => {
      await result.current.logout();
    });

    expect(spies.clearAuth).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toEqual({ lms: false, admin: false });
  });

  it('returns friendly errors on invalid credentials', async () => {
    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/api/auth/login') {
        return Promise.reject(new MockApiError('Please log in again.', 401, path, { message: 'invalid' }));
      }
      return defaultRawHandler(path);
    });

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
