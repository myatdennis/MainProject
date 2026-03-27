import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockResolveCourse = vi.fn();
const mockGetCourse = vi.fn();
const mockGetAllCourses = vi.fn();
const mockGetAdminCatalogState = vi.fn();
const mockGetLearnerCatalogState = vi.fn();
const mockLoadStoredCourseProgress = vi.fn();
const mockSubscribe = vi.fn(() => () => {});
const mockInit = vi.fn(() => Promise.resolve());

vi.mock('../../../components/CourseCompletion', () => ({
  __esModule: true,
  default: ({ course }: { course: { title: string } }) => (
    <div data-testid="course-completion">Completion view for {course.title}</div>
  ),
}));

vi.mock('../../../store/courseStore', () => ({
  courseStore: {
    resolveCourse: (...args: unknown[]) => mockResolveCourse(...args),
    getCourse: (...args: unknown[]) => mockGetCourse(...args),
    getAllCourses: (...args: unknown[]) => mockGetAllCourses(...args),
    getAdminCatalogState: (...args: unknown[]) => mockGetAdminCatalogState(...args),
    getLearnerCatalogState: (...args: unknown[]) => mockGetLearnerCatalogState(...args),
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    init: (...args: unknown[]) => mockInit(...args),
  },
}));

vi.mock('../../../utils/courseProgress', () => ({
  loadStoredCourseProgress: (...args: unknown[]) => mockLoadStoredCourseProgress(...args),
}));

import LMSCourseCompletion from '../LMSCourseCompletion';

const baseCourse = {
  id: 'foundations',
  slug: 'foundations',
  title: 'Foundations of Inclusive Leadership',
  description: 'Build inclusive habits',
  status: 'published',
  thumbnail: 'https://example.com/thumbnail.jpg',
  duration: '45 min',
  difficulty: 'Beginner',
  createdBy: 'Coach',
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      description: 'Overview',
      duration: '15 min',
      order: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          type: 'video',
          duration: '10 min',
          order: 1,
          content: {
            videoUrl: 'https://example.com/video.mp4',
          },
        },
      ],
    },
  ],
};

const renderWithRouter = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/lms/courses/${baseCourse.id}/completion`]}>
        <Routes>
          <Route path="/lms/courses/:courseId/completion" element={<LMSCourseCompletion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  mockResolveCourse.mockReturnValue(baseCourse);
  mockGetCourse.mockReturnValue(baseCourse);
  mockGetAllCourses.mockReturnValue([baseCourse]);
  mockGetAdminCatalogState.mockReturnValue({ phase: 'ready' });
  mockGetLearnerCatalogState.mockReturnValue({ status: 'ok' });
  mockLoadStoredCourseProgress.mockReturnValue({
    completedLessonIds: baseCourse.modules.flatMap((module) => module.lessons?.map((lesson) => lesson.id) ?? []),
    lessonProgress: {},
    lessonPositions: {},
    lastLessonId: 'lesson-1',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LMSCourseCompletion', () => {
  it('renders celebration view when entire course is complete', async () => {
    renderWithRouter();
    const completionNode = await screen.findByTestId('course-completion');
    expect(completionNode).toHaveTextContent('Completion view for Foundations of Inclusive Leadership');
  });

  it('shows encouragement state when lessons remain', async () => {
    mockLoadStoredCourseProgress.mockReturnValueOnce({
      completedLessonIds: [],
      lessonProgress: {},
      lessonPositions: {},
    });

    renderWithRouter();
    const message = await screen.findByText(/Almost there!/i);
    expect(message).toBeInTheDocument();
  });

  it('keeps the deep link in a loading state while the learner catalog is still booting', async () => {
    mockResolveCourse.mockReturnValue(null);
    mockGetCourse.mockReturnValue(null);
    mockGetAllCourses.mockReturnValue([]);
    mockGetAdminCatalogState.mockReturnValue({ phase: 'loading' });
    mockGetLearnerCatalogState.mockReturnValue({ status: 'idle' });

    renderWithRouter();

    expect(await screen.findByLabelText(/Loading/i)).toBeInTheDocument();
    expect(screen.queryByText(/Course not found/i)).not.toBeInTheDocument();
  });
});
