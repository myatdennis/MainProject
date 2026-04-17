import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import ClientCourses from '../ClientCourses';

const mockNavigate = vi.fn();
const {
  getAllCoursesMock,
  getAssignmentsForUserMock,
  buildLearnerProgressSnapshotMock,
  loadStoredCourseProgressMock,
  adminCatalogStateMock,
  learnerCatalogStateMock,
  courseStoreInitMock,
  secureAuthState,
} = vi.hoisted(() => ({
  getAllCoursesMock: vi.fn(() => []),
  getAssignmentsForUserMock: vi.fn(async (_userId?: string | null) => [] as any[]),
  buildLearnerProgressSnapshotMock: vi.fn(() => ({ overallProgress: 0 })),
  loadStoredCourseProgressMock: vi.fn(() => ({
    completedLessonIds: [],
    lessonProgress: {},
    lessonPositions: {},
  })),
  adminCatalogStateMock: { phase: 'ready' },
  // Local test-only type for the learner catalog state (courseStore's type is not exported)
  learnerCatalogStateMock: { status: 'ok', lastUpdatedAt: null, lastError: null as string | null, detail: null as string | null } as {
    status: 'idle' | 'loading' | 'ok' | 'empty' | 'error';
    lastUpdatedAt: number | null;
    lastError: string | null;
    detail: string | null;
  },
  courseStoreInitMock: vi.fn(async () => undefined),
  secureAuthState: {
    value: {
      authInitializing: false,
      authStatus: 'ready',
      sessionStatus: 'authenticated',
      membershipStatus: 'ready',
  activeOrgId: 'org-1' as string | null,
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useRoutePrefetch', () => ({
  useRoutePrefetch: () => {},
}));

vi.mock('../../../components/PerformanceComponents', () => ({
  LazyImage: (props: any) => <img {...props} />,
}));

vi.mock('../../../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    user: {
      id: 'user-123',
      email: 'user@example.com',
    },
  }),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => secureAuthState.value,
}));

vi.mock('../../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: (userId?: string | null) => getAssignmentsForUserMock(userId),
}));

vi.mock('../../../store/courseStore', () => ({
  courseStore: {
    subscribe: () => () => {},
    getAllCourses: () => getAllCoursesMock(),
    getAdminCatalogState: () => adminCatalogStateMock,
    getLearnerCatalogState: () => learnerCatalogStateMock,
    init: () => courseStoreInitMock(),
    resolveCourse: (identifier: string) => getAllCoursesMock().find((course: any) => course.id === identifier || course.slug === identifier) ?? null,
  },
}));

vi.mock('../../../utils/courseProgress', () => ({
  syncCourseProgressWithRemote: vi.fn(async () => null),
  loadStoredCourseProgress: loadStoredCourseProgressMock,
  buildLearnerProgressSnapshot: buildLearnerProgressSnapshotMock,
}));

vi.mock('../../../utils/courseNormalization', () => ({
  normalizeCourse: <T,>(course: T) => course,
}));

vi.mock('../clientCoursesUtils', () => ({
  shouldIncludeCourseForLearner: () => true,
}));

vi.mock('../../../dal/sync', () => ({
  syncService: {
    subscribe: () => () => {},
  },
}));

vi.mock('../../../lib/secureStorage', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/secureStorage')>('../../../lib/secureStorage');
  return {
    ...actual,
    getUserSession: () => ({ id: 'user-123' }),
  };
});

describe('ClientCourses', () => {
  const renderCourses = () =>
    render(
      <MemoryRouter initialEntries={['/client/courses']}>
        <Routes>
          <Route path="/client/courses" element={<ClientCourses />} />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    mockNavigate.mockReset();
    getAllCoursesMock.mockReset();
    getAssignmentsForUserMock.mockReset();
    buildLearnerProgressSnapshotMock.mockReset();
    loadStoredCourseProgressMock.mockReset();
    courseStoreInitMock.mockReset();
    secureAuthState.value = {
      authInitializing: false,
      authStatus: 'ready',
      sessionStatus: 'authenticated',
      membershipStatus: 'ready',
      activeOrgId: 'org-1',
    } as any;
    adminCatalogStateMock.phase = 'ready';
    learnerCatalogStateMock.status = 'ok';
    learnerCatalogStateMock.lastError = null;
    learnerCatalogStateMock.detail = null;

    getAllCoursesMock.mockReturnValue([
      {
        id: 'course-1',
        slug: 'course-1',
        title: 'Course 1',
        description: 'Course description',
        duration: '1 hour',
        chapters: [
          {
            id: 'chapter-1',
            lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }, { id: 'lesson-4' }],
          },
        ],
      },
    ] as any);

    getAssignmentsForUserMock.mockResolvedValue([
      {
        id: 'assignment-1',
        courseId: 'course-1',
        userId: 'user-123',
        status: 'in-progress',
        progress: 0,
      },
    ] as any);

    buildLearnerProgressSnapshotMock.mockReturnValue({ overallProgress: 0.75 });
    loadStoredCourseProgressMock.mockReturnValue({
      completedLessonIds: [],
      lessonProgress: { 'lesson-1': 100, 'lesson-2': 100, 'lesson-3': 100, 'lesson-4': 0 },
      lessonPositions: {},
    });
  });

  it('renders non-zero card percent from merged snapshot when assignment progress is stale', async () => {
    renderCourses();

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar', { name: 'Course 1 progress' });
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
  });

  it('shows completed status with a review CTA for completed learners', async () => {
    getAssignmentsForUserMock.mockResolvedValueOnce([
      {
        id: 'assignment-1',
        courseId: 'course-1',
        userId: 'user-123',
        status: 'completed',
        progress: 100,
      },
    ] as any);

    buildLearnerProgressSnapshotMock.mockReturnValue({ overallProgress: 1 });
    loadStoredCourseProgressMock.mockReturnValue({
      completedLessonIds: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'],
      lessonProgress: { 'lesson-1': 100, 'lesson-2': 100, 'lesson-3': 100, 'lesson-4': 100 },
      lessonPositions: {},
    } as any);

    renderCourses();

    const courseTitle = await screen.findByText('Course 1');
    const card = courseTitle.closest('[data-test="client-course-card"]') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review course' })).toBeInTheDocument();
  });

  it('resolves assigned courses by slug when courseId is a legacy slug', async () => {
    getAssignmentsForUserMock.mockResolvedValueOnce([
      {
        id: 'assignment-2',
        courseId: 'course-1',
        userId: 'user-123',
        status: 'assigned',
        progress: 0,
      },
    ] as any);

    renderCourses();

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
  });

  it('does not start learner catalog loading before auth is ready', async () => {
    adminCatalogStateMock.phase = 'idle';
    learnerCatalogStateMock.status = 'idle';
    secureAuthState.value = {
      authInitializing: true,
      authStatus: 'booting',
      sessionStatus: 'loading',
      membershipStatus: 'loading',
      activeOrgId: null,
    } as any;

    renderCourses();

    expect(await screen.findByText('Preparing your learner session...')).toBeInTheDocument();
    expect(courseStoreInitMock).not.toHaveBeenCalled();
    expect(getAssignmentsForUserMock).not.toHaveBeenCalled();
  });

  it('shows an auth-session error instead of hanging in skeletons', async () => {
    getAllCoursesMock.mockReturnValue([]);
    learnerCatalogStateMock.status = 'error';
    learnerCatalogStateMock.lastError = 'auth_session_unavailable';
    learnerCatalogStateMock.detail = 'auth_session_unavailable';

    renderCourses();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We found your assignments, but your authenticated course session was not ready in time. Retry to load your courses.',
    );
  });
});
