import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getAllCoursesFromDatabase } from '../../dal/adminCourses';
import { courseStore } from '../courseStore';

vi.mock('../../dal/adminCourses', () => ({
  getAllCoursesFromDatabase: vi.fn().mockResolvedValue([]),
  deleteCourseFromDatabase: vi.fn(),
  syncCourseToDatabase: vi.fn(),
}));

const fetchPublishedCoursesMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const fetchCourseMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('../../dal/clientCourses', () => ({
  fetchPublishedCourses: fetchPublishedCoursesMock,
  fetchCourse: fetchCourseMock,
}));

const getAssignmentsForUserMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const getAssignmentsForUserWithOutcomeMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ outcome: 'empty', assignments: [], error: null }),
);
vi.mock('../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: getAssignmentsForUserMock,
  getAssignmentsForUserWithOutcome: getAssignmentsForUserWithOutcomeMock,
}));

// Use vi.hoisted so the mock refs are available at module evaluation time.
// vi.clearAllMocks() resets call counts but does NOT strip implementations
// set on hoisted fns — this keeps getRuntimeStatus/refreshRuntimeStatus stable
// across tests without needing to re-mock in afterEach.
const runtimeStatusMock = vi.hoisted(() => ({
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
vi.mock('../../state/runtimeStatus', () => ({
  refreshRuntimeStatus: runtimeStatusMock.refreshRuntimeStatus,
  getRuntimeStatus: runtimeStatusMock.getRuntimeStatus,
}));

const secureStorageState = vi.hoisted(() => ({
  session: { id: 'user-123', email: 'user@example.com' } as { id?: string; email?: string } | null,
  accessToken: 'token-123' as string | null,
}));

vi.mock('../../lib/secureStorage', async () => {
  const actual = await vi.importActual<typeof import('../../lib/secureStorage')>('../../lib/secureStorage');
  return {
    ...actual,
    getUserSession: vi.fn(() => secureStorageState.session),
    getAccessToken: vi.fn(() => secureStorageState.accessToken),
  };
});

const apiAccessTokenMock = vi.hoisted(() => vi.fn(async () => secureStorageState.accessToken));
vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return {
    ...actual,
    getAccessToken: apiAccessTokenMock,
  };
});

let resolverSnapshot = {
  status: 'loading' as 'loading' | 'ready' | 'error',
  membershipStatus: 'loading' as 'idle' | 'loading' | 'ready' | 'degraded' | 'error',
  activeOrgId: null as string | null,
  orgId: null as string | null,
  role: 'member',
  userId: 'user-123',
};

vi.mock('../courseStoreOrgBridge', () => ({
  resolveOrgContextFromBridge: vi.fn(() => resolverSnapshot),
  readBridgeSnapshot: vi.fn(() => resolverSnapshot),
  registerCourseStoreOrgResolver: vi.fn(),
  writeBridgeSnapshot: vi.fn(),
  clearBridgeSnapshot: vi.fn(),
  isOrgResolverRegistered: vi.fn(() => true),
}));

/** Re-apply all stub implementations after vi.clearAllMocks() resets counts. */
const resetMockImpls = () => {
  fetchPublishedCoursesMock.mockResolvedValue([]);
  fetchCourseMock.mockResolvedValue(null);
  getAssignmentsForUserMock.mockResolvedValue([]);
  getAssignmentsForUserWithOutcomeMock.mockResolvedValue({ outcome: 'empty', assignments: [], error: null });
  apiAccessTokenMock.mockImplementation(async () => secureStorageState.accessToken);
  runtimeStatusMock.getRuntimeStatus.mockReturnValue({
    supabaseConfigured: true,
    supabaseHealthy: true,
    apiReachable: true,
    apiAuthRequired: false,
  });
  runtimeStatusMock.refreshRuntimeStatus.mockResolvedValue({
    supabaseConfigured: true,
    supabaseHealthy: true,
    apiReachable: true,
    apiAuthRequired: false,
  });
};

describe('courseStore bridge snapshot synchronization', () => {
  beforeEach(() => {
    resolverSnapshot = {
      status: 'loading',
      membershipStatus: 'loading',
      activeOrgId: null,
      orgId: null,
      role: 'member',
      userId: 'user-123',
    };
    secureStorageState.session = { id: 'user-123', email: 'user@example.com' };
    secureStorageState.accessToken = 'token-123';
    fetchPublishedCoursesMock.mockClear();
    fetchCourseMock.mockClear();
    getAssignmentsForUserWithOutcomeMock.mockClear();
  });

  afterEach(() => {
    // clearAllMocks resets call counts but preserves mock implementations set
    // via vi.hoisted() factory fns — safe to use here.
    // restoreAllMocks would permanently strip those implementations.
    vi.clearAllMocks();
    // Explicitly re-apply stub implementations so every test starts clean.
    resetMockImpls();
  });

  it('waits inline until the bridge snapshot reports ready', async () => {
    const initPromise = courseStore.init({ reason: 'test_wait' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();

    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-999',
      orgId: 'org-999',
      role: 'member',
      userId: 'user-123',
    };

    await initPromise;

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    });
  });

  it('surfaces an error when the bridge reports an unrecoverable status', async () => {
    resolverSnapshot = {
      status: 'error',
      membershipStatus: 'error',
      activeOrgId: null,
      orgId: null,
      role: 'member',
      userId: 'user-error',
    };

    await courseStore.init({ reason: 'test_error' }).catch(() => {/* swallow */});

    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();
  });

  it('does not fetch published courses when org context is ready but no active org is selected', async () => {
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: null,
      orgId: null,
      role: 'member',
      userId: 'user-123',
    };

    await courseStore.init({ reason: 'test_no_org_selected' });

    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();
    const learnerState = courseStore.getLearnerCatalogState();
    expect(learnerState.status).toBe('error');
    expect(learnerState.detail).toBe('org_selection_required');
  });

  it('resumes published learner catalog loading once active org selection is restored', async () => {
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: null,
      orgId: null,
      role: 'member',
      userId: 'user-123',
    };

    await courseStore.init({ reason: 'test_restore_org_selection' });
    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();
    expect(courseStore.getLearnerCatalogState().status).toBe('error');

    fetchPublishedCoursesMock.mockResolvedValueOnce([
      {
        id: 'course-1',
        title: 'Restored Course',
        status: 'published',
        modules: [{ id: 'module-1', lessons: [{ id: 'lesson-1' }] }],
      },
    ]);
    getAssignmentsForUserWithOutcomeMock.mockResolvedValueOnce({
      outcome: 'success',
      assignments: [
        {
          id: 'assignment-1',
          courseId: 'course-1',
          userId: 'user-123',
          status: 'assigned',
          progress: 0,
        },
      ] as any,
      error: null,
    });

    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-restored',
      orgId: 'org-restored',
      role: 'member',
      userId: 'user-123',
    };

    await courseStore.forceInit({ newOrgId: 'org-restored', flushCache: true });

    expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    expect(courseStore.getLearnerCatalogState().status).toBe('ok');
    expect(courseStore.getAllCourses()).toHaveLength(1);
  });

  it('blocks learner catalog loading until a usable bearer session exists', async () => {
    secureStorageState.accessToken = null;
    apiAccessTokenMock.mockResolvedValue(null);
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
      orgId: 'org-1',
      role: 'member',
      userId: 'user-123',
    };

    await courseStore.init({ reason: 'test_missing_learner_token' });

    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();
    expect(courseStore.getLearnerCatalogState()).toMatchObject({
      status: 'error',
      detail: 'auth_session_unavailable',
    });
  });

  it('does not block learner catalog fetches on a slow runtime status probe', async () => {
    let deferredResolve: ((value: any) => void) | undefined;
    const deferredPromise = new Promise((resolve) => {
      deferredResolve = resolve;
    });
    runtimeStatusMock.refreshRuntimeStatus.mockImplementation(() => deferredPromise as any);
    fetchPublishedCoursesMock.mockResolvedValueOnce([
      {
        id: 'course-slow-health',
        title: 'Published Course',
        status: 'published',
        modules: [{ id: 'module-1', lessons: [{ id: 'lesson-1' }] }],
      },
    ]);
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
      orgId: 'org-1',
      role: 'member',
      userId: 'user-123',
    };

    const initPromise = courseStore.forceInit({ flushCache: true, reason: 'test_slow_runtime_probe' });

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalledWith({ orgId: 'org-1' });
    });

    if (deferredResolve) {
      deferredResolve({
        supabaseConfigured: true,
        supabaseHealthy: true,
        apiReachable: true,
        apiAuthRequired: false,
      });
    }
    await initPromise;

    expect(courseStore.getLearnerCatalogState().status).toBe('empty');
  });

  it('hydrates missing learner-assigned courses without includeDrafts', async () => {
    fetchPublishedCoursesMock.mockResolvedValueOnce([]);
    getAssignmentsForUserWithOutcomeMock.mockResolvedValueOnce({
      outcome: 'success',
      assignments: [
        {
          id: 'assignment-1',
          courseId: 'course-42',
          userId: 'user-123',
          status: 'assigned',
          progress: 0,
        },
      ] as any,
      error: null,
    });
    fetchCourseMock.mockResolvedValueOnce({
      id: 'course-42',
      title: 'Assigned Course',
      slug: 'assigned-course',
      modules: [{ id: 'module-1', lessons: [{ id: 'lesson-1' }] }],
      lessonCount: 1,
      structureLoaded: true,
    } as any);
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
      orgId: 'org-1',
      role: 'member',
      userId: 'user-123',
    };

    await courseStore.init({ reason: 'test_assignment_hydration_without_drafts' });

    expect(fetchCourseMock).toHaveBeenCalledWith('course-42', { includeDrafts: false });
    expect(courseStore.getLearnerCatalogState().status).toBe('ok');
    expect(courseStore.getAllCourses()).toHaveLength(1);
  });

  it('loads all courses for admin-capable users', async () => {
    window.history.replaceState(null, '', '/admin/dashboard');
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-admin',
      orgId: 'org-admin',
      role: 'admin',
      userId: 'user-admin',
    };

    await courseStore.init({ reason: 'test_admin_load' });

    expect(getAllCoursesFromDatabase).toHaveBeenCalled();
    expect(courseStore.getAllCourses()).toHaveLength(0);
  });

  it('admin capability on LMS surface', async () => {
    window.history.replaceState(null, '', '/lms/dashboard');
    secureStorageState.session = { id: 'user-admin', email: 'admin@example.com' };
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-admin',
      orgId: 'org-admin',
      role: 'admin',
      userId: 'user-admin',
    };

    getAssignmentsForUserWithOutcomeMock.mockResolvedValueOnce({
      outcome: 'success',
      assignments: [
        {
          id: 'assignment-1',
          courseId: 'course-1',
          userId: 'user-admin',
          status: 'assigned',
          progress: 0,
        } as any,
      ],
      error: null,
    });
    fetchPublishedCoursesMock.mockResolvedValueOnce([
      {
        id: 'course-1',
        title: 'LMS Course',
        status: 'published',
        modules: [{ id: 'module-1', lessons: [{ id: 'lesson-1' }] }],
      },
    ]);

    await courseStore.init({ reason: 'test_admin_lms_surface' });

    expect(getAllCoursesFromDatabase).not.toHaveBeenCalled();
    expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    expect(courseStore.getAllCourses()).toHaveLength(1);
  });

  it('admin role regression test', async () => {
    secureStorageState.session = { id: 'user-admin', email: 'admin@example.com' };
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-admin',
      orgId: 'org-admin',
      role: 'admin',
      userId: 'user-admin',
    };

    await courseStore.init({ reason: 'test_admin_role_regression' });

    expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    expect(courseStore.getAllCourses()).toHaveLength(0);
  });
});

describe('courseStore init() defensive runtime-status guard', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetMockImpls();
  });

  it('does not crash when getRuntimeStatus returns undefined (mock cleared mid-test)', async () => {
    // Simulate a test-environment edge-case where clearAllMocks runs between
    // the getRuntimeStatus() call and the refreshRuntimeStatus() await inside
    // init().  The defensive guard in courseStore.init() should catch this and
    // fall back to safe defaults instead of throwing.
    secureStorageState.session = { id: 'user-safe', email: 'user-safe@example.com' };
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-safe',
      orgId: 'org-safe',
      role: 'member',
      userId: 'user-safe',
    };

    // Make getRuntimeStatus return undefined (simulates wiped mock).
    runtimeStatusMock.getRuntimeStatus.mockReturnValue(undefined as any);
    // refreshRuntimeStatus still works — returns valid object.
    runtimeStatusMock.refreshRuntimeStatus.mockResolvedValue({
      supabaseConfigured: true,
      supabaseHealthy: true,
      apiReachable: true,
      apiAuthRequired: false,
    });

    // Should not throw even with undefined from getRuntimeStatus.
    courseStore.forceInit({ flushCache: true }).catch(() => {/* ignore */});
    await new Promise((r) => setTimeout(r, 0));
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-safe',
      orgId: 'org-safe',
      role: 'member',
      userId: 'user-safe',
    };

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('does not crash when both getRuntimeStatus and refreshRuntimeStatus return undefined', async () => {
    secureStorageState.session = { id: 'user-safe2', email: 'user-safe2@example.com' };
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-safe2',
      orgId: 'org-safe2',
      role: 'member',
      userId: 'user-safe2',
    };

    // Simulate complete mock wipeout.
    runtimeStatusMock.getRuntimeStatus.mockReturnValue(undefined as any);
    runtimeStatusMock.refreshRuntimeStatus.mockResolvedValue(undefined as any);

    // init() must use safe defaults and still call fetchPublishedCourses.
    courseStore.forceInit({ flushCache: true }).catch(() => {/* ignore */});
    await new Promise((r) => setTimeout(r, 0));

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
