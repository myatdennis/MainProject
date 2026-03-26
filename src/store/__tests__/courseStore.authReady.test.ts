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
  status: 'loading' as 'loading' | 'ready',
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
    // clearAllMocks resets call counts but preserves mock implementations set
    // via vi.hoisted() factory fns — safe to use here.
    // restoreAllMocks would permanently strip those implementations.
    vi.clearAllMocks();
    // Explicitly re-apply stub implementations so every test starts clean.
    resetMockImpls();
  });

  it('waits inline until huddle:auth_ready fires or the bridge reports ready', async () => {
    const initPromise = courseStore.init();
    // Allow the async init flow to hit the waiting branch.
    await new Promise((resolve) => setTimeout(resolve, 0));
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

    await initPromise;

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    });
  });

  it('polling fallback triggers init when auth_ready was missed', async () => {
    // Reset resolver to loading and flush the store back to idle.
    // We set resolverSnapshot BEFORE forceInit so the internal init() call
    // inside forceInit sees status='loading' and queues the polling fallback.
    resolverSnapshot = { status: 'loading', orgId: null, role: 'member', userId: 'user-456' };
    fetchPublishedCoursesMock.mockClear();

    // forceInit resets initPromise/phase/attempts then calls init() internally.
    // With resolver='loading', that internal init() call queues the polling fallback.
    courseStore.forceInit({ flushCache: true }).catch(() => {/* ignore */});
    // Yield to let the internal init() microtasks complete so the setInterval is set up.
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();

    // Now simulate Effect 2 catching up: resolver transitions to 'ready'.
    // auth_ready event was already missed — the polling fallback must fire init.
    // Use role='member' (non-admin) so the store uses fetchPublishedCourses,
    // which is what we're asserting on (admin path uses getAllCoursesFromDatabase).
    resolverSnapshot = {
      status: 'ready',
      orgId: 'org-polling',
      role: 'member',
      userId: 'user-456',
    };

    // The polling interval is 150ms; wait up to 2s for it to fire with real timers.
    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    }, { timeout: 2000, interval: 50 });
  });

  it('fireOnce guard prevents double initialization when both event and poll fire', async () => {
    // Reset resolver to loading.
    resolverSnapshot = { status: 'loading', orgId: null, role: 'member', userId: 'user-789' };
    fetchPublishedCoursesMock.mockClear();

    // Queue the bootstrap listener/poll via forceInit+init.
    courseStore.forceInit({ flushCache: true }).catch(() => {/* ignore */});
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchPublishedCoursesMock).not.toHaveBeenCalled();

    // Transition resolver to ready, then fire the event.
    resolverSnapshot = {
      status: 'ready',
      orgId: 'org-double',
      role: 'member',
      userId: 'user-789',
    };

    // Dispatch the auth_ready event — this should trigger fireOnce once.
    window.dispatchEvent(
      new CustomEvent('huddle:auth_ready', {
        detail: { activeOrgId: 'org-double', membershipCount: 1, userId: 'user-789' },
      }),
    );

    // Wait for the event handler to complete.
    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    }, { timeout: 2000 });

    const callsAfterEvent = fetchPublishedCoursesMock.mock.calls.length;

    // Wait one full poll cycle (200ms > 150ms interval) to confirm the
    // polling fallback does NOT fire a second init (fireOnce guard).
    await new Promise((r) => setTimeout(r, 200));

    // Call count must not have increased (fireOnce cleared the interval).
    expect(fetchPublishedCoursesMock.mock.calls.length).toBe(callsAfterEvent);
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
    resolverSnapshot = { status: 'ready', orgId: 'org-safe', role: 'member', userId: 'user-safe' };

    await vi.waitFor(() => {
      expect(fetchPublishedCoursesMock).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('does not crash when both getRuntimeStatus and refreshRuntimeStatus return undefined', async () => {
    resolverSnapshot = {
      status: 'ready',
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
