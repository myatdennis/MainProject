import { afterEach, describe, expect, it, vi } from 'vitest';

describe('assignmentStorage no-session sync gating', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not start Supabase sync on import when no authenticated session exists', async () => {
    const getSupabaseSpy = vi.fn(async () => ({
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    }));

    vi.doMock('../../lib/supabaseClient', () => ({
      getSupabase: getSupabaseSpy,
      hasSupabaseConfig: () => true,
    }));
    vi.doMock('../../lib/secureStorage', () => ({
      getUserSession: () => null,
      secureGet: vi.fn(() => null),
      secureSet: vi.fn(),
      secureRemove: vi.fn(),
    }));
    vi.doMock('../../dal/sync', () => ({
      syncService: {
        subscribe: () => () => {},
        logSyncEvent: vi.fn(),
      },
    }));
    vi.doMock('../../state/runtimeStatus', () => ({
      isSupabaseOperational: () => true,
      subscribeRuntimeStatus: () => () => {},
    }));
    vi.doMock('../apiClient', () => ({
      __esModule: true,
      default: vi.fn(),
      ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
          super(message);
          this.status = status;
        }
      },
    }));

    await import('../assignmentStorage');

    expect(getSupabaseSpy).not.toHaveBeenCalled();
  });
});
