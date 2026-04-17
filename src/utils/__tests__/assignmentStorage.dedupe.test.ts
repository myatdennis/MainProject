import { afterEach, describe, expect, it, vi } from 'vitest';

describe('assignmentStorage request dedupe', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('collapses concurrent assignment reads into a single API request', async () => {
    const apiRequestMock = vi.fn().mockResolvedValue([
      {
        id: 'assignment-1',
        course_id: 'course-1',
        user_id: 'user-123',
        status: 'assigned',
        progress: 0,
      },
    ]);

    vi.doMock('../../lib/supabaseClient', () => ({
      getSupabase: vi.fn().mockResolvedValue(null),
      hasSupabaseConfig: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('../../dal/sync', () => ({
      syncService: {
        subscribe: () => () => {},
        logSyncEvent: vi.fn(),
      },
    }));
    vi.doMock('../../state/runtimeStatus', () => ({
      isSupabaseOperational: () => false,
      subscribeRuntimeStatus: () => () => {},
    }));
    vi.doMock('../../lib/secureStorage', () => ({
      getUserSession: () => ({ id: 'user-123', email: 'user@example.com' }),
      secureGet: vi.fn(() => null),
      secureSet: vi.fn(),
      secureRemove: vi.fn(),
    }));
    vi.doMock('../apiClient', () => ({
      __esModule: true,
      default: apiRequestMock,
      ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
          super(message);
          this.status = status;
        }
      },
    }));

    const { getAssignmentsForUser } = await import('../assignmentStorage');

    const [first, second] = await Promise.all([
      getAssignmentsForUser('user-123'),
      getAssignmentsForUser('user-123'),
    ]);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
  });
});
