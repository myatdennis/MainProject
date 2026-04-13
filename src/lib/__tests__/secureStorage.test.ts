import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  secureSet,
  secureGet,
  secureRemove,
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  setUserSession,
  getUserSession,
  setSessionMetadata,
  getSessionMetadata,
  clearAuth,
  __dangerouslyResetSecureStorageStateForTests,
  __dangerouslyClearInMemoryUserSessionForTests,
} from '../secureStorage';

const originalSessionStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined;

const restoreSessionStorage = () => {
  if (typeof window === 'undefined' || originalSessionStorage === undefined) {
    return;
  }
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: originalSessionStorage,
  });
};

describe('secureStorage', () => {
  beforeEach(() => {
    __dangerouslyResetSecureStorageStateForTests();
  });

  afterEach(() => {
    restoreSessionStorage();
    __dangerouslyResetSecureStorageStateForTests();
  });

  it('encrypts and retrieves structured values', () => {
    const payload = { foo: 'bar', count: 42 };
    secureSet('payload', payload);
    const restored = secureGet<typeof payload>('payload');
    expect(restored).toEqual(payload);
  });

  it('removes individual keys without affecting others', () => {
    secureSet('one', { id: 1 });
    secureSet('two', { id: 2 });
    secureRemove('one');
    expect(secureGet('one')).toBeNull();
    expect(secureGet('two')).toEqual({ id: 2 });
  });

  it('persists auth tokens and metadata helpers', () => {
    setAccessToken('access-123');
    setRefreshToken('refresh-456');
    setSessionMetadata({ accessExpiresAt: 100, refreshExpiresAt: 200 });

    expect(getAccessToken()).toBe('access-123');
    expect(getRefreshToken()).toBe('refresh-456');
    expect(getSessionMetadata()).toMatchObject({ accessExpiresAt: 100, refreshExpiresAt: 200 });
  });

  it('clearAuth wipes all secure credentials and session info', () => {
    setUserSession({ id: 'user-1', email: 'user@example.com', role: 'admin' });
    setAccessToken('to-clear');
    setRefreshToken('to-clear-refresh');
    setSessionMetadata({ accessExpiresAt: Date.now() + 1000 });

    clearAuth();

    expect(getUserSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getSessionMetadata()).toBeNull();
  });

  it('rehydrates the persisted user session when in-memory state is cleared', () => {
    setUserSession({ id: 'user-1', email: 'user@example.com', role: 'admin' });
    __dangerouslyClearInMemoryUserSessionForTests();

    expect(getUserSession()).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      role: 'admin',
    });
  });

  it('builds a synthetic session during non-production e2e bypass', () => {
    clearAuth();
    __dangerouslyClearInMemoryUserSessionForTests();
    (window as any).__E2E_BYPASS = true;
    (window as any).__E2E_USER_ID = '00000000-0000-0000-0000-000000000002';
    (window as any).__E2E_USER_EMAIL = 'user@pacificcoast.edu';
    (window as any).__E2E_USER_ROLE = 'learner';
    window.localStorage.setItem('huddle_lms_auth', 'true');

    expect(getUserSession()).toMatchObject({
      id: '00000000-0000-0000-0000-000000000002',
      email: 'user@pacificcoast.edu',
      role: 'learner',
      activeOrgId: 'demo-sandbox-org',
    });

    delete (window as any).__E2E_BYPASS;
    delete (window as any).__E2E_USER_ID;
    delete (window as any).__E2E_USER_EMAIL;
    delete (window as any).__E2E_USER_ROLE;
    window.localStorage.removeItem('huddle_lms_auth');
  });

  it('falls back to in-memory storage when sessionStorage is unavailable', () => {
    if (typeof window === 'undefined') {
      return;
    }

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: undefined,
    });

    __dangerouslyResetSecureStorageStateForTests();

    setAccessToken('memory-only-token');
    expect(getAccessToken()).toBe('memory-only-token');
  });
});
