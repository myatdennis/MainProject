import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import ClientDashboard from '../ClientDashboard';

const mockNavigate = vi.fn();
const {
  secureAuthState,
  getCourseMock,
  getAllCoursesMock,
  getLearnerCatalogStateMock,
  getAssignmentsForUserMock,
  buildLearnerProgressSnapshotMock,
  loadStoredCourseProgressMock,
} = vi.hoisted(() => ({
  secureAuthState: {
    value: {
      sessionStatus: 'authenticated',
      membershipStatus: 'ready',
      membershipCount: 0,
      activeOrgId: 'org-1',
    },
  },
  getCourseMock: vi.fn(),
  getAllCoursesMock: vi.fn(() => []),
  getLearnerCatalogStateMock: vi.fn(() => ({
    status: 'ok',
    lastUpdatedAt: null,
    lastError: null,
    detail: null,
  })),
  getAssignmentsForUserMock: vi.fn(async (_userId?: string | null) => [] as any[]),
  buildLearnerProgressSnapshotMock: vi.fn(() => ({ overallProgress: 0 })),
  loadStoredCourseProgressMock: vi.fn(() => ({
    completedLessonIds: [],
    lessonProgress: {},
    lessonPositions: {},
  })),
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
    getCourse: (courseId: string) => getCourseMock(courseId),
    getAllCourses: () => getAllCoursesMock(),
    getLearnerCatalogState: () => getLearnerCatalogStateMock(),
  },
}));

vi.mock('../../../utils/courseProgress', () => ({
  PROGRESS_STORAGE_KEY: 'lms_course_progress_v1',
  syncCourseProgressWithRemote: vi.fn(async () => null),
  loadStoredCourseProgress: loadStoredCourseProgressMock,
  buildLearnerProgressSnapshot: buildLearnerProgressSnapshotMock,
}));

vi.mock('../../../utils/courseNormalization', () => ({
  normalizeCourse: <T,>(course: T) => course,
}));

vi.mock('../../../dal/sync', () => ({
  syncService: {
    subscribe: () => () => {},
    logSyncEvent: vi.fn(),
  },
}));

vi.mock('../../../state/runtimeStatus', () => ({
  isSupabaseOperational: () => true,
  subscribeRuntimeStatus: () => () => {},
}));

describe('ClientDashboard', () => {
  const renderDashboard = (initialEntry = '/client/dashboard') =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/client/dashboard" element={<ClientDashboard />} />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    mockNavigate.mockReset();
    secureAuthState.value = {
      sessionStatus: 'authenticated',
      membershipStatus: 'ready',
      membershipCount: 0,
      activeOrgId: 'org-1',
    };
    getAssignmentsForUserMock.mockClear();
    getCourseMock.mockReset();
    getAllCoursesMock.mockReset();
    getAllCoursesMock.mockReturnValue([]);
    getLearnerCatalogStateMock.mockReset();
    getLearnerCatalogStateMock.mockReturnValue({
      status: 'ok',
      lastUpdatedAt: null,
      lastError: null,
      detail: null,
    });
    buildLearnerProgressSnapshotMock.mockReset();
    buildLearnerProgressSnapshotMock.mockReturnValue({ overallProgress: 0 });
    loadStoredCourseProgressMock.mockReset();
    loadStoredCourseProgressMock.mockReturnValue({
      completedLessonIds: [],
      lessonProgress: {},
      lessonPositions: {},
    });
  });

  it('renders no assignments state without redirecting', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: /No assignments yet/i })).toBeInTheDocument();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getAssignmentsForUserMock).toHaveBeenCalledWith('user-123');
  });

  it('keeps the dashboard shell mounted after auth and membership have already resolved once', async () => {
    const view = renderDashboard();

    expect(await screen.findByRole('button', { name: /Go to full learning hub/i })).toBeInTheDocument();

    secureAuthState.value = {
      ...secureAuthState.value,
      sessionStatus: 'loading',
      membershipStatus: 'loading',
    };

    view.rerender(
      <MemoryRouter initialEntries={['/client/dashboard']}>
        <Routes>
          <Route path="/client/dashboard" element={<ClientDashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Go to full learning hub/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Preparing your portal/i)).not.toBeInTheDocument();
  });

  it('treats a 100% snapshot as completed even if assignment status is still in-progress', async () => {
    getAssignmentsForUserMock.mockResolvedValueOnce([
      {
        id: 'assignment-1',
        courseId: 'course-1',
        userId: 'user-123',
        status: 'in-progress',
        progress: 99,
      },
    ] as any);

    getCourseMock.mockReturnValue({
      id: 'course-1',
      slug: 'course-1',
      title: 'Course 1',
      description: 'Course description',
      duration: '1 hour',
      chapters: [
        {
          id: 'chapter-1',
          lessons: [{ id: 'lesson-1' }],
        },
      ],
    });

    buildLearnerProgressSnapshotMock.mockReturnValue({ overallProgress: 1 });

    renderDashboard();

    const assignedCoursesRegion = await screen.findByRole('region', { name: 'Assigned courses' });
    expect(within(assignedCoursesRegion).getByText('Course 1')).toBeInTheDocument();
    expect(within(assignedCoursesRegion).getByRole('button', { name: 'Continue' })).toBeInTheDocument();

    const completedLabel = screen.getByText(/^Completed$/);
    const completedCard = completedLabel.closest('.text-center');
    expect(completedCard).not.toBeNull();
    expect(within(completedCard as HTMLElement).getByText('1')).toBeInTheDocument();

    const inProgressLabel = screen.getByText(/^In progress$/);
    const inProgressCard = inProgressLabel.closest('.text-center');
    expect(inProgressCard).not.toBeNull();
    expect(within(inProgressCard as HTMLElement).getByText('0')).toBeInTheDocument();
  });

  it('uses snapshot progress on course cards when assignment progress is stale or zero', async () => {
    getAssignmentsForUserMock.mockResolvedValueOnce([
      {
        id: 'assignment-2',
        courseId: 'course-2',
        userId: 'user-123',
        status: 'in-progress',
        progress: 0,
      },
    ] as any);

    getCourseMock.mockReturnValue({
      id: 'course-2',
      slug: 'course-2',
      title: 'Course 2',
      description: 'Course description',
      duration: '1 hour',
      chapters: [
        {
          id: 'chapter-1',
          lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }, { id: 'lesson-4' }],
        },
      ],
    });

    buildLearnerProgressSnapshotMock.mockReturnValue({ overallProgress: 0.75 });

    renderDashboard();

    const assignedCoursesRegion = await screen.findByRole('region', { name: 'Assigned courses' });
    expect(within(assignedCoursesRegion).getByText('Course 2')).toBeInTheDocument();

    const progressBar = within(assignedCoursesRegion).getByRole('progressbar', {
      name: 'Course 2 completion',
    });
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
  });
});
