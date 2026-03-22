import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Course } from '../../types/courseTypes';
import type { AdminCatalogState } from '../courseStore';
import type { OrgContextSnapshot } from '../courseStoreOrgBridge';

const adminCoursesMock = vi.hoisted(() => ({
  CourseValidationError: class extends Error {},
  deleteCourseFromDatabase: vi.fn(),
  getAllCoursesFromDatabase: vi.fn(),
  syncCourseToDatabase: vi.fn(),
}));
vi.mock('../../dal/adminCourses', () => adminCoursesMock);

const clientCoursesMock = vi.hoisted(() => ({
  fetchPublishedCourses: vi.fn(),
  fetchCourse: vi.fn(),
}));
vi.mock('../../dal/clientCourses', () => clientCoursesMock);

const secureStorageMock = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  getActiveOrgPreference: vi.fn(),
}));
vi.mock('../../lib/secureStorage', () => secureStorageMock);

const runtimeStatusMock = vi.hoisted(() => ({
  getRuntimeStatus: vi.fn(),
  refreshRuntimeStatus: vi.fn(),
}));
vi.mock('../../state/runtimeStatus', () => runtimeStatusMock);

const apiClientMock = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code?: string;
    body?: unknown;

    constructor(status: number, message?: string, body?: unknown, code?: string) {
      super(message ?? 'ApiError');
      this.status = status;
      this.body = body;
      this.code = code;
    }
  }
  return { ApiError };
});
vi.mock('../../utils/apiClient', () => apiClientMock);

const courseNormalizationMock = vi.hoisted(() => ({
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
  normalizeCourse: <T>(course: T) => course,
}));
vi.mock('../../utils/courseNormalization', () => courseNormalizationMock);

const assignmentStorageMock = vi.hoisted(() => ({
  getAssignmentsForUser: vi.fn(),
}));
vi.mock('../../utils/assignmentStorage', () => assignmentStorageMock);

const courseProgressMock = vi.hoisted(() => ({
  loadStoredCourseProgress: vi.fn(),
}));
vi.mock('../../utils/courseProgress', () => courseProgressMock);

const courseAvailabilityMock = vi.hoisted(() => ({
  hasStoredProgressHistory: vi.fn(),
}));
vi.mock('../../utils/courseAvailability', () => courseAvailabilityMock);

const courseDraftsMock = vi.hoisted(() => ({
  saveDraftSnapshot: vi.fn(),
  markDraftSynced: vi.fn(),
  deleteDraftSnapshot: vi.fn(),
}));
vi.mock('../../dal/courseDrafts', () => courseDraftsMock);

const orgBridgeMock = vi.hoisted(() => {
  let snapshot: OrgContextSnapshot | null = {
    status: 'ready',
    orgId: 'org-1',
    role: 'admin',
    userId: 'admin-1',
  };
  return {
    resolveOrgContextFromBridge: vi.fn(() => snapshot),
    registerCourseStoreOrgResolver: vi.fn(),
    setSnapshot: (next: OrgContextSnapshot | null) => {
      snapshot = next;
    },
  };
});
vi.mock('../courseStoreOrgBridge', () => ({
  resolveOrgContextFromBridge: orgBridgeMock.resolveOrgContextFromBridge,
  registerCourseStoreOrgResolver: orgBridgeMock.registerCourseStoreOrgResolver,
}));

const setOrgContextSnapshot = (next: OrgContextSnapshot | null) => {
  orgBridgeMock.setSnapshot(next);
};

const defaultRuntimeStatus = {
  supabaseConfigured: true,
  supabaseHealthy: true,
  apiReachable: true,
  apiHealthy: true,
  apiAuthRequired: false,
  demoModeEnabled: false,
  lastError: null as string | null,
};

const setRuntimeStatusSnapshot = (overrides: Partial<typeof defaultRuntimeStatus> = {}) => {
  const snapshot = { ...defaultRuntimeStatus, ...overrides };
  runtimeStatusMock.getRuntimeStatus.mockReturnValue(snapshot);
  runtimeStatusMock.refreshRuntimeStatus.mockResolvedValue(snapshot);
};

const adminSession = {
  id: 'admin-1',
  role: 'admin',
  activeOrgId: 'org-1',
  memberships: [{ orgId: 'org-1', status: 'active' }],
};

const createCourse = (overrides: Partial<Course> = {}): Course => ({
  id: 'course-1',
  slug: 'course-1',
  title: 'Sample Course',
  description: 'Test course',
  thumbnail: '/thumb.png',
  difficulty: 'Beginner',
  duration: '15 min',
  status: 'draft',
  tags: [],
  learningObjectives: [],
  prerequisites: [],
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      description: 'First module',
      duration: '5 min',
      order: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          type: 'text',
          order: 0,
          content: {},
        } as any,
      ],
    },
  ],
  lessons: 1,
  progress: 0,
  ...overrides,
});

const captureTransitions = (store: typeof import('../courseStore')['courseStore']) => {
  const seen: AdminCatalogState[] = [];
  const unsubscribe = store.subscribe(() => {
    seen.push(store.getAdminCatalogState());
  });
  return { seen, unsubscribe };
};

const importCourseStore = async () => {
  const module = await import('../courseStore');
  return module.courseStore;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([]);
  adminCoursesMock.syncCourseToDatabase.mockResolvedValue(null);
  adminCoursesMock.deleteCourseFromDatabase.mockResolvedValue?.(undefined);
  clientCoursesMock.fetchPublishedCourses.mockResolvedValue([]);
  clientCoursesMock.fetchCourse.mockResolvedValue(null);
  assignmentStorageMock.getAssignmentsForUser.mockResolvedValue([]);
  courseProgressMock.loadStoredCourseProgress.mockReturnValue(null);
  courseAvailabilityMock.hasStoredProgressHistory.mockReturnValue(false);
  courseDraftsMock.saveDraftSnapshot.mockResolvedValue(undefined);
  courseDraftsMock.markDraftSynced.mockResolvedValue(undefined);
  courseDraftsMock.deleteDraftSnapshot.mockResolvedValue(undefined);
  secureStorageMock.getUserSession.mockReturnValue(adminSession);
  secureStorageMock.getActiveOrgPreference.mockReturnValue(null);
  setRuntimeStatusSnapshot();
  setOrgContextSnapshot({
    status: 'ready',
    orgId: adminSession.activeOrgId,
    role: adminSession.role,
    userId: adminSession.id,
  });
});

describe('courseStore admin catalog phase transitions', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/courses');
  });

  it('reports success when admin catalog returns courses', async () => {
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([createCourse({ id: 'alpha' })]);
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    expect(finalState.adminLoadStatus).toBe('success');
    expect(finalState.phase).toBe('ready');
  });

  it('reports empty when admin API returns no courses', async () => {
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([]);
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    expect(finalState.adminLoadStatus).toBe('empty');
    expect(finalState.phase).toBe('ready');
  });

  it('treats admin API auth failures as errors without marking unauthorized', async () => {
    const { ApiError } = await import('../../utils/apiClient');
    adminCoursesMock.getAllCoursesFromDatabase.mockRejectedValue(new ApiError('unauthorized', 401, '/api/admin/courses', null));
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    expect(finalState.adminLoadStatus).toBe('error');
    expect(finalState.phase).toBe('ready');
  });

  it('reports api_unreachable when the admin API cannot be contacted', async () => {
    setRuntimeStatusSnapshot({ apiReachable: false, apiHealthy: false, lastError: 'offline' });
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    expect(finalState.adminLoadStatus).toBe('api_unreachable');
    expect(finalState.phase).toBe('ready');
  });

  it('still resolves to ready when the admin API throws an unexpected error', async () => {
    adminCoursesMock.getAllCoursesFromDatabase.mockRejectedValue(new Error('boom'));
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    expect(finalState.adminLoadStatus).toBe('error');
    expect(finalState.phase).toBe('ready');
  });
});

describe('courseStore learner catalog fallbacks', () => {
  it('uses default catalog when assignments return 200 with empty payload', async () => {
    window.history.pushState({}, '', '/lms/courses');
    secureStorageMock.getUserSession.mockReturnValue({
      id: 'learner-101',
      role: 'learner',
      activeOrgId: 'org-learner',
      memberships: [{ orgId: 'org-learner', status: 'active' }],
    });
    setOrgContextSnapshot({
      status: 'ready',
      orgId: 'org-learner',
      role: 'learner',
      userId: 'learner-101',
    });
    assignmentStorageMock.getAssignmentsForUser.mockResolvedValue([]);
    clientCoursesMock.fetchPublishedCourses.mockResolvedValue([]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    const learnerState = courseStore.getLearnerCatalogState();
    expect(learnerState.status).toBe('empty');
    expect(learnerState.detail).toBe('no_assignments');
    expect(courseStore.getAllCourses().length).toBe(0);
  });
});
