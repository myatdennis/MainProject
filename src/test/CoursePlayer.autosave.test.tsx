import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Hoist mocks and follow project conventions
const mockLoadCourse = vi.hoisted(() => vi.fn());
const mockLoadStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockSaveStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockSyncCourseProgressWithRemote = vi.hoisted(() => vi.fn());

vi.mock('../dal/courseData', () => ({
  loadCourse: (...args: any[]) => mockLoadCourse(...args),
  clearCourseCache: vi.fn(),
}));

vi.mock('../utils/courseProgress', () => ({
  loadStoredCourseProgress: mockLoadStoredCourseProgress as any,
  saveStoredCourseProgress: mockSaveStoredCourseProgress as any,
  syncCourseProgressWithRemote: mockSyncCourseProgressWithRemote as any,
  buildLearnerProgressSnapshot: vi.fn(),
}));

// Mock sync and toast
vi.mock('../services/syncService', () => ({ useSyncService: () => ({ logEvent: vi.fn(), subscribe: vi.fn(() => ({ unsubscribe: () => {} })) }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

// Mock assignment progress util
vi.mock('../utils/assignmentStorage', () => ({ updateAssignmentProgress: vi.fn() }));

// Mock batchService and keep a spy for enqueueProgress
const enqueueProgressMock = vi.hoisted(() => vi.fn());
vi.mock('../services/batchService', () => ({
  batchService: {
    enqueueProgress: (...args: any[]) => enqueueProgressMock(...args),
    enqueueAnalytics: vi.fn(),
    flushProgress: vi.fn(),
    flushAnalytics: vi.fn(),
  },
}));

import CoursePlayer from '../components/CoursePlayer/CoursePlayer';

const mockCourse = {
  id: 'course-auto',
  slug: 'course-auto',
  title: 'AutoSave Course',
  status: 'published',
  modules: [],
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter',
      order: 1,
      lessons: [
        {
          id: 'lesson-auto',
          title: 'Lesson Auto',
          type: 'video',
          order: 1,
          duration: '5 min',
          content: { videoUrl: 'https://example.com/vid.mp4' },
        },
      ],
    },
  ],
};

const mockLessons = mockCourse.chapters[0].lessons;
const mockLoadCourseResult = { course: mockCourse, modules: [], lessons: mockLessons, source: 'local' as const };

const renderCoursePlayer = () => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/lms/course/${mockCourse.slug}/lesson/${mockLessons[0].id}`]}>
        <Routes>
          <Route path="/lms/course/:courseId/lesson/:lessonId" element={<CoursePlayer namespace="admin" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CoursePlayer autosave', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLoadCourse.mockResolvedValue(mockLoadCourseResult);
    mockLoadStoredCourseProgress.mockReturnValue({ completedLessonIds: [], lessonProgress: {}, lessonPositions: {} });
    mockSyncCourseProgressWithRemote.mockResolvedValue(null);
  });

  afterEach(() => {
    // ensure timers restored if any other tests used them
    vi.clearAllMocks();
  });

  it('enqueues progress and persists locally on autosave interval', async () => {
    renderCoursePlayer();

    // Wait for video element to render
    const video = await waitFor(() => {
      const el = document.querySelector('video') as HTMLVideoElement | null;
      if (!el) throw new Error('video not available');
      return el;
    });

    // Set duration and currentTime and trigger a timeupdate to simulate playback
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    video.currentTime = 30;
    // fire the timeupdate event which will cause the player logic to log progress and enqueue
    video.dispatchEvent(new Event('timeupdate'));

    await waitFor(() => {
      expect(enqueueProgressMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'lesson_progress', lessonId: 'lesson-auto', position: 30 }));
      expect(mockSaveStoredCourseProgress).toHaveBeenCalledWith('course-auto', expect.any(Object), expect.any(Object));
    });
  });
});
