import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SecureAuthProvider, useSecureAuth } from '../SecureAuthContext';
import * as secureStorage from '../../lib/secureStorage';
import type { SessionMetadata, UserSession } from '../../lib/secureStorage';

const auditMocks = vi.hoisted(() => ({
  enqueueAudit: vi.fn(),
  flushAuditQueue: vi.fn(),
}));

vi.mock('../../dal/auditLog', () => ({
  __esModule: true,
  enqueueAudit: auditMocks.enqueueAudit,
  flushAuditQueue: auditMocks.flushAuditQueue,
}));

const supabaseAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  })),
}));

vi.mock('../../lib/supabaseClient', () => {
  const supabaseClient = { auth: supabaseAuthMock };
  return {
    __esModule: true,
    AUTH_STORAGE_MODE: 'secure',
    supabase: supabaseClient,
    getSupabase: () => supabaseClient,
    hasSupabaseConfig: () => true,
    captureAuthDiagnostics: vi.fn(),
    debugAuthStorage: vi.fn(),
  };
});

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
    return {
      __esModule: true,
      default: (...args: unknown[]) => mockApiRequest(...args),
      apiRequestRaw: (...args: unknown[]) => mockApiRequestRaw(...args),
      // ApiError: MockApiError, // Removed unused declaration
  };
});

const storedState = {
  user: null as UserSession | null,
  metadata: null as SessionMetadata | null,
};

const adminUser = {
  id: 'user-1',
  email: 'admin@the-huddle.co',
  role: 'admin',
  organizationId: 'org-1',
} as UserSession;

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
  if (path === '/auth/session') {
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
    supabaseAuthMock.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-test-token',
          refresh_token: 'supabase-refresh-token',
          user: adminUser,
        },
      },
      error: null,
    });
    supabaseAuthMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-test-token', refresh_token: 'supabase-refresh-token' } },
      error: null,
    });
    supabaseAuthMock.signOut.mockResolvedValue({ error: null });
    supabaseAuthMock.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'supabase-test-token', refresh_token: 'supabase-refresh-token' } },
      error: null,
    });
  });

  it('signs in with Supabase and lets auth state bootstrap the user', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    const bootstrapUser = {
      id: 'user-1',
      email: 'admin@thehuddle.co',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      organizationId: 'org-1',
    };
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'supabase-login-token',
          refresh_token: 'supabase-login-refresh',
          user: bootstrapUser,
        },
        user: bootstrapUser,
      },
      error: null,
    });

    let loginResult: Awaited<ReturnType<typeof result.current.login>>;
    await act(async () => {
      loginResult = await result.current.login('admin@thehuddle.co', 'securePass123', 'admin');
    });

    expect(loginResult!.success).toBe(true);
    expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@thehuddle.co',
      password: 'securePass123',
    });
    const legacyLoginPath = ['', 'api', 'auth', 'login'].join('/');
    expect(mockApiRequest.mock.calls.some(([path]) => path === legacyLoginPath)).toBe(false);
  });

  it('refreshToken uses Supabase refreshSession and fetches the enriched server session', async () => {
    storedState.user = {
      id: 'user-1',
      email: 'admin@thehuddle.co',
      role: 'admin',
      organizationId: 'org-1',
    } as UserSession;
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/auth/session') {
        return jsonResponse({ user: storedState.user });
      }
      return defaultRawHandler(path);
    });

    let refreshResult: boolean | undefined;
    await act(async () => {
      refreshResult = await result.current.refreshToken();
    });

    expect(refreshResult).toBe(true);
    expect(supabaseAuthMock.refreshSession).toHaveBeenCalled();
    expect(mockApiRequest).not.toHaveBeenCalledWith('/api/auth/refresh', expect.anything());
  });

  it('logout clears secure storage and resets auth booleans', async () => {
    storedState.user = {
      id: 'admin-user',
      email: 'admin@thehuddle.co',
      role: 'admin',
      organizationId: 'org-1',
    } as UserSession;
    supabaseAuthMock.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-test-token',
          refresh_token: 'supabase-refresh-token',
          user: storedState.user,
        },
      },
      error: null,
    });
    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/auth/session') {
        return jsonResponse({
          user: storedState.user,
          expiresAt: Date.now() + 60_000,
          refreshExpiresAt: Date.now() + 120_000,
        });
      }
      return defaultRawHandler(path);
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.email).toBe(storedState.user?.email));

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
  expect(result.current.isAuthenticated).toEqual({ lms: false, admin: false, client: false });
  });

  it('returns friendly errors on invalid credentials', async () => {
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login', status: 400 },
    } as any);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('admin@thehuddle.co', 'bad-pass', 'admin');
    });

    expect(loginResult).toMatchObject({ success: false, errorType: 'invalid_credentials' });
    expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@thehuddle.co',
      password: 'bad-pass',
    });
  });

  it('updates active organization locally and persists it to the server', async () => {
    storedState.user = {
      id: 'user-1',
      email: 'multi@thehuddle.co',
      role: 'learner',
      organizationId: 'org-1',
      activeOrgId: 'org-1',
    } as UserSession;
    supabaseAuthMock.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-test-token',
          refresh_token: 'supabase-refresh-token',
          user: storedState.user,
        },
      },
      error: null,
    });
    mockApiRequestRaw.mockImplementation((path: string) => {
      if (path === '/auth/session') {
        return jsonResponse({
          user: storedState.user,
          memberships: [
            { organization_id: 'org-1', role: 'learner', status: 'active' },
            { organization_id: 'org-2', role: 'admin', status: 'active' },
          ],
          organizationIds: ['org-1', 'org-2'],
          membershipStatus: 'ready',
          accessToken: 'api-access',
          refreshToken: 'api-refresh',
          expiresAt: Date.now() + 60_000,
          refreshExpiresAt: Date.now() + 120_000,
        });
      }
      return defaultRawHandler(path);
    });
    mockApiRequest.mockImplementation((path: string) => {
      if (path === '/api/auth/active-org') {
        return Promise.resolve({ ok: true, data: { orgId: 'org-2' } });
      }
      return Promise.resolve({ ok: true, data: null });
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.authInitializing).toBe(false));

    await act(async () => {
      await result.current.setActiveOrganization('org-2');
    });

    expect(result.current.activeOrgId).toBe('org-2');
    expect(result.current.user?.activeOrgId).toBe('org-2');
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/auth/active-org',
      expect.objectContaining({
        method: 'PATCH',
        body: { orgId: 'org-2' },
      }),
    );
  });
});
