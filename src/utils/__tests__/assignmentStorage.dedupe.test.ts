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

    vi.doMock('../../dal/sync', () => ({
      syncService: {
        subscribe: () => () => {},
        logSyncEvent: vi.fn(),
      },
    }));
    vi.doMock('../../lib/secureStorage', () => ({
      getUserSession: () => ({ id: 'user-123', email: 'user@example.com' }),
      getActiveOrgPreference: () => 'org-1',
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
      getAssignmentsForUser('user-123', 'org-1'),
      getAssignmentsForUser('user-123', 'org-1'),
    ]);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith('/api/learner/assignments?include_completed=true&orgId=org-1');
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
  });
});
