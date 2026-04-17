import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { courseStore } from '../courseStore';
import { clearAllCatalogCache } from '../../utils/catalogPersistence';

// Mock admin DAL
vi.mock('../../dal/adminCourses', () => ({
  getAllCoursesFromDatabase: vi.fn().mockResolvedValue([]),
  deleteCourseFromDatabase: vi.fn(),
  syncCourseToDatabase: vi.fn(),
}));
import { getAllCoursesFromDatabase } from '../../dal/adminCourses';

// Mock client DAL
const fetchPublishedCoursesMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../dal/clientCourses', () => ({
  fetchPublishedCourses: fetchPublishedCoursesMock,
  fetchCourse: vi.fn(),
}));

const secureStorageState = vi.hoisted(() => ({
  session: { id: 'user-1', email: 'user-1@example.com' } as { id?: string; email?: string } | null,
  accessToken: 'token-1' as string | null,
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

const getAssignmentsForUserMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: getAssignmentsForUserMock,
}));

// Runtime status stubbed
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
  status: 'ready' as 'loading' | 'ready' | 'error',
  membershipStatus: 'ready' as 'idle' | 'loading' | 'ready' | 'degraded' | 'error',
  activeOrgId: 'org-1' as string | null,
  orgId: 'org-1' as string | null,
  role: 'member' as string | null,
  userId: 'user-1' as string | null,
};

vi.mock('../courseStoreOrgBridge', () => ({
  resolveOrgContextFromBridge: vi.fn(() => resolverSnapshot),
  readBridgeSnapshot: vi.fn(() => resolverSnapshot),
  registerCourseStoreOrgResolver: vi.fn(),
  writeBridgeSnapshot: vi.fn(),
  clearBridgeSnapshot: vi.fn(),
  isOrgResolverRegistered: vi.fn(() => true),
}));

const resetMocks = () => {
  fetchPublishedCoursesMock.mockResolvedValue([]);
  getAssignmentsForUserMock.mockResolvedValue([]);
  secureStorageState.session = { id: 'user-1', email: 'user-1@example.com' };
  secureStorageState.accessToken = 'token-1';
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

describe('courseStore surface behaviour (focused tests)', () => {
  beforeEach(() => {
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
      orgId: 'org-1',
      role: 'member',
      userId: 'user-1',
    };
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('calls admin API when surface is explicitly admin', async () => {
    (getAllCoursesFromDatabase as any).mockClear();
    (getAllCoursesFromDatabase as any).mockResolvedValueOnce([{ id: 'c-1', modules: [{ id: 'm', lessons: [{ id: 'l' }] }] }]);

    // Ensure any persisted catalog cache is flushed so init runs a fresh fetch
    clearAllCatalogCache();
    await courseStore.init({ reason: 'test_admin', surface: 'admin' });

    expect(getAllCoursesFromDatabase).toHaveBeenCalled();
  });

  it('admin-capable user on LMS surface does not call admin API (uses published courses)', async () => {
    // Simulate admin-capable role
    resolverSnapshot.role = 'admin';
    // Ensure we are on LMS path
    window.history.replaceState(null, '', '/lms/dashboard');

    (fetchPublishedCoursesMock as any).mockClear();
    (getAllCoursesFromDatabase as any).mockClear();

    (fetchPublishedCoursesMock as any).mockResolvedValueOnce([
      { id: 'lp-1', title: 'LMS Course', modules: [{ id: 'm', lessons: [{ id: 'l' }] }] },
    ]);

  await courseStore.forceInit({ flushCache: true });

    expect(getAllCoursesFromDatabase).not.toHaveBeenCalled();
    expect(fetchPublishedCoursesMock).toHaveBeenCalled();
  });

  it('omitted surface hint relies on pathname and does not trigger admin fetch on LMS path', async () => {
    window.history.replaceState(null, '', '/lms/courses');
    resolverSnapshot.role = 'admin';

    (getAllCoursesFromDatabase as any).mockClear();
    (fetchPublishedCoursesMock as any).mockClear();

  await courseStore.forceInit({ flushCache: true });

    expect(getAllCoursesFromDatabase).not.toHaveBeenCalled();
    expect(fetchPublishedCoursesMock).toHaveBeenCalled();
  });

  it('when org is ready but no org selected, learner state becomes org_selection_required', async () => {
    resolverSnapshot = {
      status: 'ready',
      membershipStatus: 'ready',
      activeOrgId: null,
      orgId: null,
      role: 'member',
      userId: 'user-1',
    };

  await courseStore.forceInit({ flushCache: true });

    const learnerState = courseStore.getLearnerCatalogState();
    expect(learnerState.status).toBe('error');
    expect(learnerState.detail).toBe('org_selection_required');
  });
});
