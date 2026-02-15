import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockResolveCourse = vi.fn();
const mockGetCourse = vi.fn();
const mockGetAllCourses = vi.fn();
const mockLoadStoredCourseProgress = vi.fn();

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
});
