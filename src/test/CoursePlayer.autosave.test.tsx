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
const mockSyncLogEvent = vi.hoisted(() => vi.fn());
vi.mock('../dal/sync', () => ({ useSyncService: () => ({ logEvent: mockSyncLogEvent, subscribe: vi.fn(() => ({ unsubscribe: () => {} })) }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const handleApiCallMock = vi.hoisted(() => vi.fn(async (call: () => Promise<any>) => (typeof call === 'function' ? call() : undefined)));
const isOnlineMock = vi.hoisted(() => vi.fn(() => true));
vi.mock('../utils/NetworkErrorHandler', () => {
  const mockHandler = {
    handleApiCall: (...args: any[]) => handleApiCallMock(...args),
    isOnline: (...args: any[]) => isOnlineMock(...args),
  };
  return {
    NetworkErrorHandler: mockHandler,
    default: mockHandler,
  };
});

const apiRequestMock = vi.hoisted(() =>
  vi.fn((path: string, options?: any) => {
    if (typeof path === 'string' && path.includes('/api/learner/progress')) {
      return Promise.resolve({ data: { lessons: [] } });
    }
    return Promise.resolve({});
  })
);
vi.mock('../utils/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../utils/apiClient')>('../utils/apiClient');
  const proxyApiRequest = vi.fn((path: string, options?: any) => {
    if (typeof path === 'string' && path.includes('/api/learner/progress')) {
      return Promise.resolve({ data: { lessons: [] } });
    }
    return actual.apiRequest(path as any, options as any);
  });
  apiRequestMock.mockImplementation((path: string, options?: any) => proxyApiRequest(path, options));
  return {
    ...actual,
    apiRequest: proxyApiRequest,
    default: proxyApiRequest,
  };
});

// Mock assignment progress util
vi.mock('../utils/assignmentStorage', () => ({ updateAssignmentProgress: vi.fn() }));

// Silence analytics DAL to avoid network fetches during tests
vi.mock('../dal/analytics', () => {
  const analyticsInstance = {
    trackEvent: vi.fn(),
    trackCourseCompletion: vi.fn(),
    getCourseAnalytics: vi.fn(() => ({
      courseId: 'course-auto',
      totalLearners: 0,
      activeLastWeek: 0,
      averageTimeSpent: 0,
      completionRate: 0,
      dropOffRate: 0,
      engagementScore: 0,
      hottestContent: [],
      strugglingLearners: [],
      peakUsageHours: [],
    })),
    getEvents: vi.fn(() => []),
    getLearnerJourney: vi.fn(() => null),
    clearOldData: vi.fn(),
  };

  return {
    ...analyticsInstance,
    default: analyticsInstance,
  };
});

// Mock batchService and keep a spy for enqueueProgress
const enqueueProgressMock = vi.hoisted(() => vi.fn());
const batchServiceInstance = vi.hoisted(() => ({
  enqueueProgress: (...args: any[]) => enqueueProgressMock(...args),
  enqueueAnalytics: vi.fn(),
  flushProgress: vi.fn(),
  flushAnalytics: vi.fn(),
}));

vi.mock('../dal/batchService', () => ({ batchService: batchServiceInstance, default: batchServiceInstance }));
vi.mock('../services/batchService', () => ({ batchService: batchServiceInstance, default: batchServiceInstance }));

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
  let fetchMock: ReturnType<typeof vi.fn> | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    mockLoadCourse.mockResolvedValue(mockLoadCourseResult);
    mockLoadStoredCourseProgress.mockReturnValue({ completedLessonIds: [], lessonProgress: {}, lessonPositions: {} });
    mockSyncCourseProgressWithRemote.mockResolvedValue(null);

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      const headers = { 'Content-Type': 'application/json' };

      if (url.includes('/api/auth/refresh')) {
        const body = JSON.stringify({
          user: { id: 'test-user', email: 'test@example.com', role: 'admin' },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          memberships: [],
          organizationIds: [],
        });
        return new Response(body, { status: 200, headers });
      }

      if (init?.method === 'POST' || init?.method === 'PATCH') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    // ensure timers restored if any other tests used them
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock = null;
  });

  it('enqueues progress and persists locally on autosave interval', async () => {
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(window, 'setInterval').mockImplementation((cb: TimerHandler) => {
      if (typeof cb === 'function') {
        intervalCallbacks.push(cb as () => void);
      }
      return intervalCallbacks.length as unknown as ReturnType<typeof window.setInterval>;
    });

    (window as any).__COURSE_PLAYER_TEST_DURATION = 120;

    renderCoursePlayer();

    // Wait for video element to render
    const video = await waitFor(() => {
      const el = document.querySelector('video') as HTMLVideoElement | null;
      if (!el) throw new Error('video not available');
      return el;
    });

    // Provide duration/currentTime so the autosave interval has meaningful data
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 120 });
    (video as any).__testDuration = 120;
    video.dataset.testDuration = '120';
    (video as any).__testPosition = 30;
    video.dataset.testPosition = '30';
    let currentTimeValue = 0;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTimeValue,
      set: (val: number) => {
        currentTimeValue = val;
      },
    });

    (window as any).__COURSE_PLAYER_TEST_POSITION = 30;

    expect(video.duration).toBe(120);

    const initialSaveCount = mockSaveStoredCourseProgress.mock.calls.length;

    // Simulate playback progress before the autosave interval fires
    video.currentTime = 30;
    expect(video.currentTime).toBe(30);

    intervalCallbacks.forEach((cb) => cb());

    expect(enqueueProgressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lesson_progress',
        courseId: 'course-auto',
        lessonId: 'lesson-auto',
        position: 30,
        percent: 25,
      })
    );

    expect(mockSaveStoredCourseProgress.mock.calls.length).toBeGreaterThan(initialSaveCount);
    const lastCall = mockSaveStoredCourseProgress.mock.calls[mockSaveStoredCourseProgress.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe('course-auto');
  });
});
