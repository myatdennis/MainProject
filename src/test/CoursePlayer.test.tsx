import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const mockLogEvent = vi.fn();

type MockSubscription = {
  unsubscribe: () => void;
};

vi.mock('../services/syncService', () => ({
  useSyncService: () => ({
    logEvent: mockLogEvent,
    subscribe: vi.fn(() => ({ unsubscribe: () => {} } as MockSubscription)),
  }),
}));

const mockUpdateAssignmentProgress = vi.fn().mockResolvedValue(undefined);
vi.mock('../utils/assignmentStorage', () => ({
  updateAssignmentProgress: (...args: unknown[]) => mockUpdateAssignmentProgress(...args),
}));

const mockSaveStoredCourseProgress = vi.fn();
const mockLoadStoredCourseProgress = vi.fn(() => ({
  completedLessonIds: [],
  lessonProgress: {},
  lessonPositions: {},
}));
const mockSyncCourseProgressWithRemote = vi.fn().mockResolvedValue(null);

vi.mock('../utils/courseProgress', () => ({
  loadStoredCourseProgress: (...args: unknown[]) => mockLoadStoredCourseProgress(...args),
  saveStoredCourseProgress: (...args: unknown[]) => mockSaveStoredCourseProgress(...args),
  syncCourseProgressWithRemote: (...args: unknown[]) => mockSyncCourseProgressWithRemote(...args),
  buildLearnerProgressSnapshot: vi.fn(),
}));

const mockLoadCourse = vi.fn();
vi.mock('../services/courseDataLoader', () => ({
  loadCourse: (...args: unknown[]) => mockLoadCourse(...args),
  clearCourseCache: vi.fn(),
}));

import CoursePlayer from '../components/CoursePlayer/CoursePlayer';

const mockCourse = {
  id: 'course-1',
  slug: 'course-1',
  title: 'Test Course',
  status: 'published',
  modules: [],
  chapters: [
    {
      id: 'chapter-1',
      title: 'Chapter 1',
      order: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          type: 'video',
          order: 1,
          duration: '5 min',
          content: {
            videoUrl: 'https://example.com/video.mp4',
            transcript: 'Sample transcript',
          },
        },
        {
          id: 'lesson-2',
          title: 'Lesson 2',
          type: 'text',
          order: 2,
          duration: '7 min',
          content: {
            textContent: '<p>Lesson content</p>',
          },
        },
      ],
    },
  ],
};

const mockLessons = mockCourse.chapters[0].lessons;

const mockLoadCourseResult = {
  course: mockCourse,
  modules: [],
  lessons: mockLessons,
  source: 'supabase' as const,
};

const renderCoursePlayer = () => {
  return render(
    <MemoryRouter initialEntries={['/lms/course/course-1/lesson/lesson-1']}>
      <Routes>
        <Route path="/lms/course/:courseId/lesson/:lessonId" element={<CoursePlayer namespace="lms" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('CoursePlayer progress integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLoadCourse.mockResolvedValue(mockLoadCourseResult);
    mockLoadStoredCourseProgress.mockReturnValue({
      completedLessonIds: [],
      lessonProgress: {},
      lessonPositions: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('syncs remote progress on mount and hydrates stored progress', async () => {
    renderCoursePlayer();

    await waitFor(() => {
      expect(mockLoadCourse).toHaveBeenCalledWith('course-1', { includeDrafts: false, preferRemote: true });
      expect(mockSyncCourseProgressWithRemote).toHaveBeenCalled();
    });

    const syncArgs = mockSyncCourseProgressWithRemote.mock.calls[0][0];
    expect(syncArgs).toEqual({
      courseSlug: 'course-1',
      courseId: 'course-1',
      userId: 'local-user',
      lessonIds: ['lesson-1', 'lesson-2'],
    });
    expect(mockLoadStoredCourseProgress).toHaveBeenCalledWith('course-1');
  });

  it('persists progress and updates assignment when marking lesson complete', async () => {
    renderCoursePlayer();

    const markButtons = await screen.findAllByRole('button', { name: /Mark as complete/i });
    await userEvent.click(markButtons[0]);

    await waitFor(() => {
      expect(mockSaveStoredCourseProgress).toHaveBeenCalled();
      expect(mockUpdateAssignmentProgress).toHaveBeenCalled();
    });

    const savedPayloads = mockSaveStoredCourseProgress.mock.calls
      .filter((call) => call[0] === 'course-1')
      .map((call) => call[1]);

    expect(savedPayloads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        completedLessonIds: expect.arrayContaining(['lesson-1']),
        lessonProgress: expect.objectContaining({ 'lesson-1': 100 }),
      }),
    ]));

    expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
    expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'user_completed' }));
  });

  it('records partial progress during video playback', async () => {
    renderCoursePlayer();

    const video = await waitFor(() => {
      const element = document.querySelector('video') as HTMLVideoElement | null;
      if (!element) {
        throw new Error('Video element not rendered yet');
      }
      return element;
    });
    expect(video).toBeTruthy();

    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    video.currentTime = 40;

    fireEvent.timeUpdate(video);

    await waitFor(() => {
      expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
      expect(mockSaveStoredCourseProgress).toHaveBeenCalled();
      expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'user_progress' }));
    });
  });
});
