import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import ClientDashboard from '../ClientDashboard';

const mockNavigate = vi.fn();
const {
  getCourseMock,
  getAllCoursesMock,
  getLearnerCatalogStateMock,
  getAssignmentsForUserMock,
  buildLearnerProgressSnapshotMock,
  loadStoredCourseProgressMock,
} = vi.hoisted(() => ({
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
  useSecureAuth: () => ({
    sessionStatus: 'authenticated',
    membershipStatus: 'ready',
    membershipCount: 0,
  }),
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
  beforeEach(() => {
    mockNavigate.mockReset();
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
    render(
      <MemoryRouter initialEntries={['/client/dashboard']}>
        <ClientDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No assignments yet/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getAssignmentsForUserMock).toHaveBeenCalledWith('user-123');
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

    render(
      <MemoryRouter initialEntries={['/client/dashboard']}>
        <ClientDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Course 1')).toBeInTheDocument();
    });

    const completedLabel = screen.getByText(/^Completed$/);
    const completedCard = completedLabel.closest('.text-center');
    expect(completedCard).not.toBeNull();
    expect(within(completedCard as HTMLElement).getByText('1')).toBeInTheDocument();

    const inProgressLabel = screen.getByText(/^In progress$/);
    const inProgressCard = inProgressLabel.closest('.text-center');
    expect(inProgressCard).not.toBeNull();
    expect(within(inProgressCard as HTMLElement).getByText('0')).toBeInTheDocument();
  });
});
