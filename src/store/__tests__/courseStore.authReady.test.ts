import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../dal/adminCourses', () => ({
  getAllCoursesFromDatabase: vi.fn().mockResolvedValue([]),
  deleteCourseFromDatabase: vi.fn(),
  syncCourseToDatabase: vi.fn(),
}));

const fetchPublishedCoursesMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../dal/clientCourses', () => ({
  fetchPublishedCourses: fetchPublishedCoursesMock,
  fetchCourse: vi.fn(),
}));

vi.mock('../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../state/runtimeStatus', () => ({
  refreshRuntimeStatus: vi.fn().mockResolvedValue({
    supabaseConfigured: true,
    supabaseHealthy: true,
    apiReachable: true,
    apiAuthRequired: false,
  }),
  getRuntimeStatus: vi.fn().mockReturnValue({
    supabaseConfigured: true,
    supabaseHealthy: true,
    apiReachable: true,
    apiAuthRequired: false,
  }),
}));

let resolverSnapshot = {
  status: 'loading' as 'loading' | 'ready',
  orgId: null as string | null,
  role: 'member',
  userId: 'user-123',
};

vi.mock('../courseStoreOrgBridge', () => ({
  resolveOrgContextFromBridge: vi.fn(() => resolverSnapshot),
  registerCourseStoreOrgResolver: vi.fn(),
}));

// eslint-disable-next-line import/first
import { courseStore } from '../courseStore';

describe('courseStore auth_ready bridge', () => {
  beforeEach(() => {
    resolverSnapshot = {
      status: 'loading',
      orgId: null,
      role: 'member',
      userId: 'user-123',
    };
    fetchPublishedCoursesMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defers initialization until huddle:auth_ready fires', async () => {
    await courseStore.init();
    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();

    resolverSnapshot = {
      status: 'ready',
      orgId: 'org-999',
      role: 'member',
      userId: 'user-123',
    };

    window.dispatchEvent(
      new CustomEvent('huddle:auth_ready', {
        detail: {
          activeOrgId: 'org-999',
          membershipCount: 1,
          userId: 'user-123',
        },
      }),
    );

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    });
  });
});
