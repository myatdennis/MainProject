import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ClientCourses from '../ClientCourses';

const mockNavigate = vi.fn();
const {
  getAllCoursesMock,
  getAssignmentsForUserMock,
  buildLearnerProgressSnapshotMock,
  loadStoredCourseProgressMock,
  adminCatalogStateMock,
  learnerCatalogStateMock,
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
  learnerCatalogStateMock: { status: 'ok' },
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

vi.mock('../../../utils/assignmentStorage', () => ({
  getAssignmentsForUser: (userId?: string | null) => getAssignmentsForUserMock(userId),
}));

vi.mock('../../../store/courseStore', () => ({
  courseStore: {
    subscribe: () => () => {},
    getAllCourses: () => getAllCoursesMock(),
    getAdminCatalogState: () => adminCatalogStateMock,
    getLearnerCatalogState: () => learnerCatalogStateMock,
    init: vi.fn(async () => undefined),
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

vi.mock('../../../lib/secureStorage', () => ({
  getUserSession: () => ({ id: 'user-123' }),
}));

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
});
