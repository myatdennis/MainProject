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

  it('reports error and preserves catalog when the admin API throws a network error', async () => {
    // Simulate a network failure on the actual API call (not just the health probe).
    // With the health-probe decoupling fix, admin surfaces always attempt the API
    // call regardless of apiReachable.  api_unreachable is now only set when the
    // API call itself throws; a degraded health probe no longer aborts the fetch.
    const networkErr = new Error('Failed to fetch');
    adminCoursesMock.getAllCoursesFromDatabase.mockRejectedValue(networkErr);
    setRuntimeStatusSnapshot({ apiReachable: false, apiHealthy: false, lastError: 'offline' });
    const courseStore = await importCourseStore();
    const { seen, unsubscribe } = captureTransitions(courseStore);

    await courseStore.init();
    unsubscribe();

    const finalState = courseStore.getAdminCatalogState();
    expect(seen[0]?.phase).toBe('loading');
    expect(seen[seen.length - 1]?.phase).toBe('ready');
    // No prior catalog snapshot → network error → adminLoadStatus stays 'error'
    expect(finalState.adminLoadStatus).toBe('error');
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


describe('courseStore graph validation — belt-and-suspenders', () => {
  // The server now pre-filters incomplete courses from the list endpoint.
  // These tests confirm the client-side guard still catches any that slip through
  // (e.g. a future API regression or a test mock that bypasses the server filter).
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/courses');
  });

  const createEmptyDraft = (overrides: Partial<Course> = {}): Course => ({
    id: 'draft-1',
    slug: 'draft-1',
    title: 'New Course',
    description: '',
    thumbnail: '',
    difficulty: 'Beginner',
    duration: '0 min',
    status: 'draft',
    tags: [],
    learningObjectives: [],
    prerequisites: [],
    modules: [],    // No modules — belt-and-suspenders guard rejects this
    lessons: 0,
    progress: 0,
    ...overrides,
  });

  it('excludes courses with no modules from getAllCourses()', async () => {
    const validCourse = createCourse({ id: 'valid-1' });
    const emptyDraft = createEmptyDraft({ id: 'empty-draft-1' });
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([validCourse, emptyDraft]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    const allCourses = courseStore.getAllCourses();
    expect(allCourses.length).toBe(1);
    expect(allCourses[0].id).toBe('valid-1');
  });

  it('excludes courses with modules but no lessons from getAllCourses()', async () => {
    const moduleWithoutLessons = {
      id: 'mod-1',
      title: 'Module 1',
      description: '',
      duration: '',
      order: 0,
      lessons: [],  // No lessons — rejected by belt-and-suspenders guard
    };
    const partialCourse = createCourse({ id: 'partial-1', modules: [moduleWithoutLessons] });
    const validCourse = createCourse({ id: 'valid-1' });
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([validCourse, partialCourse]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    expect(courseStore.getAllCourses().map((c) => c.id)).toEqual(['valid-1']);
  });

  it('reports success when only valid courses remain after guard', async () => {
    const validCourse = createCourse({ id: 'v1' });
    const emptyDraft1 = createEmptyDraft({ id: 'd1', title: 'New Course' });
    const emptyDraft2 = createEmptyDraft({ id: 'd2', title: 'Another Draft' });
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([validCourse, emptyDraft1, emptyDraft2]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    const state = courseStore.getAdminCatalogState();
    expect(state.adminLoadStatus).toBe('success');
    expect(courseStore.getAllCourses().length).toBe(1);
  });

  it('reports empty when ALL courses from server are invalid', async () => {
    const draft1 = createEmptyDraft({ id: 'd1' });
    const draft2 = createEmptyDraft({ id: 'd2' });
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([draft1, draft2]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    const state = courseStore.getAdminCatalogState();
    expect(state.adminLoadStatus).toBe('empty');
    expect(courseStore.getAllCourses().length).toBe(0);
  });

  it('emits a [COURSE GRAPH REJECTED] warning when an incomplete course slips through', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emptyDraft = createEmptyDraft({ id: 'slip-through' });
    adminCoursesMock.getAllCoursesFromDatabase.mockResolvedValue([emptyDraft]);

    const courseStore = await importCourseStore();
    await courseStore.init();

    const warnCalls = warnSpy.mock.calls.map((args) => args[0] as string);
    expect(warnCalls.some((msg) => msg.includes('[COURSE GRAPH REJECTED]'))).toBe(true);
    warnSpy.mockRestore();
  });
});
