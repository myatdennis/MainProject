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

import { courseStore } from '../courseStore';

/** Re-apply all stub implementations after vi.clearAllMocks() resets counts. */
const resetMockImpls = () => {
  fetchPublishedCoursesMock.mockResolvedValue([]);
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
    fetchPublishedCoursesMock.mockClear();
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
