import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: () => ({ user: null }),
}));

const mockFetchLearnerReflection = vi.hoisted(() => vi.fn());
const mockSaveLearnerReflection = vi.hoisted(() => vi.fn());
const mockFetchAssignedSurveysForLearner = vi.hoisted(() => vi.fn());
const mockSaveLearnerSurveyProgress = vi.hoisted(() => vi.fn());
const mockSubmitLearnerSurveyResponse = vi.hoisted(() => vi.fn());

vi.mock('../dal/reflections', () => ({
  reflectionService: {
    fetchLearnerReflection: (...args: any[]) => mockFetchLearnerReflection(...args),
    saveLearnerReflection: (...args: any[]) => mockSaveLearnerReflection(...args),
  },
}));

vi.mock('../dal/surveys', () => ({
  fetchAssignedSurveysForLearner: (...args: any[]) => mockFetchAssignedSurveysForLearner(...args),
  saveLearnerSurveyProgress: (...args: any[]) => mockSaveLearnerSurveyProgress(...args),
  submitLearnerSurveyResponse: (...args: any[]) => mockSubmitLearnerSurveyResponse(...args),
}));

const mockLogEvent = vi.hoisted(() => vi.fn());

type MockSubscription = {
  unsubscribe: () => void;
};

vi.mock('../dal/sync', () => ({
  useSyncService: () => ({
    logEvent: mockLogEvent,
    subscribe: vi.fn(() => ({ unsubscribe: () => {} } as MockSubscription)),
  }),
}));

const mockUpdateAssignmentProgress = vi.hoisted(() => vi.fn());
vi.mock('../utils/assignmentStorage', () => ({
  updateAssignmentProgress: mockUpdateAssignmentProgress as any,
}));

const mockSaveStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockLoadStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockSyncCourseProgressWithRemote = vi.hoisted(() => vi.fn());

vi.mock('../utils/courseProgress', () => ({
  loadStoredCourseProgress: mockLoadStoredCourseProgress as any,
  saveStoredCourseProgress: mockSaveStoredCourseProgress as any,
  syncCourseProgressWithRemote: mockSyncCourseProgressWithRemote as any,
  buildLearnerProgressSnapshot: vi.fn(),
}));

// Hoistable mock for course loader so vi.mock factory can reference it safely
const mockLoadCourse = vi.hoisted(() => vi.fn());

type TestVideoElement = HTMLVideoElement & {
  __coursePlayerHandleTimeUpdate?: () => void;
  __testDuration?: number;
};

vi.mock('../dal/courseData', () => ({
  loadCourse: (...args: any[]) => mockLoadCourse(...args),
  clearCourseCache: vi.fn(),
}));

// Mock batching service to avoid network calls during tests
const createBatchServiceModule = vi.hoisted(() => () => {
  const batchServiceInstance = {
    enqueueProgress: vi.fn(),
    enqueueAnalytics: vi.fn(),
    flushProgress: vi.fn(),
    flushAnalytics: vi.fn(),
  };
  return { batchService: batchServiceInstance, default: batchServiceInstance };
});

vi.mock('../dal/batchService', () => createBatchServiceModule());
vi.mock('../services/batchService', () => createBatchServiceModule());

vi.mock('../dal/analytics', () => {
  const analyticsInstance = {
    trackEvent: vi.fn(),
    trackCourseCompletion: vi.fn(),
    getCourseAnalytics: vi.fn(() => ({
      courseId: 'course-1',
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

vi.mock('../utils/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../utils/apiClient')>('../utils/apiClient');
  const request = vi.fn(async () => ({ data: {} }));
  return {
    ...actual,
    apiRequest: request,
    default: request,
  };
});

// IMPORTANT: import tested component AFTER all mocks to avoid hoist issues
import CoursePlayer from '../components/CoursePlayer/CoursePlayer';

const mockCourse = {
  id: 'course-1',
  slug: 'course-1',
  title: 'Test Course',
  description: 'Course description',
  thumbnail: '',
  difficulty: 'Beginner',
  duration: '12 min',
  status: 'published',
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      description: 'Module description',
      duration: '12 min',
      order: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          type: 'video',
          order: 1,
          order_index: 1,
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
          order_index: 2,
          duration: '7 min',
          content: {
            textContent: '<p>Lesson content</p>',
          },
        },
      ],
    },
  ],
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
          order_index: 1,
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
          order_index: 2,
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
  modules: mockCourse.modules,
  lessons: mockLessons,
  source: 'supabase' as const,
};

const renderCoursePlayer = (initialEntry = '/lms/courses/course-1/lesson/lesson-1') => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/lms/courses/:courseId/lesson/:lessonId" element={<CoursePlayer namespace="admin" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const renderClientCoursePlayer = (initialEntry = '/client/courses/course-1/lessons/lesson-1') => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/client/courses/:courseId/lessons/:lessonId" element={<CoursePlayer namespace="client" />} />
          <Route path="/client/courses/:courseId/completion" element={<div data-testid="client-completion-screen">Completion screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
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
    mockSyncCourseProgressWithRemote.mockResolvedValue(null);
    mockUpdateAssignmentProgress.mockResolvedValue(undefined);
    mockFetchLearnerReflection.mockResolvedValue(null);
    mockSaveLearnerReflection.mockImplementation(async ({ responseText, status, responseData }: { responseText: string; status?: 'draft' | 'submitted'; responseData?: any }) => ({
      id: 'reflection-1',
      organizationId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-reflection',
      userId: 'local-user',
      responseText,
      responseData,
      status: status ?? 'draft',
      createdAt: '2026-04-08T12:00:00.000Z',
      updatedAt: '2026-04-08T12:00:01.000Z',
    }));
    mockFetchAssignedSurveysForLearner.mockResolvedValue([]);
    mockSaveLearnerSurveyProgress.mockResolvedValue({});
    mockSubmitLearnerSurveyResponse.mockResolvedValue({});
    window.localStorage.clear();
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

    await screen.findByText('Test Course');
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
    await screen.findByText('Test Course');

    const getActiveVideo = () =>
      Array.from(document.querySelectorAll('video')).find(
        (node) => (node as TestVideoElement).__coursePlayerHandleTimeUpdate
      ) as TestVideoElement | undefined;

    const prepareVideo = () => {
      const element = getActiveVideo();
      if (!element) {
        throw new Error('Video element not rendered yet');
      }
      element.__testDuration = 100;
      let currentTimeValue = 0;
      Object.defineProperty(element, 'currentTime', {
        configurable: true,
        get: () => currentTimeValue,
        set: (val: number) => {
          currentTimeValue = val;
        },
      });
      element.currentTime = 40;
      return element;
    };

    await waitFor(() => prepareVideo());

    const triggerTimeUpdate = (await waitFor(() => {
      const handler = getActiveVideo()?.__coursePlayerHandleTimeUpdate;
      expect(typeof handler).toBe('function');
      return handler;
    })) as () => void;

    await act(async () => {
      prepareVideo();
      triggerTimeUpdate();
    });

    await waitFor(() => {
      expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
      expect(mockSaveStoredCourseProgress).toHaveBeenCalled();
      expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'user_progress' }));
    });
  });

  it('does not auto-redirect to completion when reopening an already completed course', async () => {
    mockLoadStoredCourseProgress.mockReturnValue({
      completedLessonIds: ['lesson-1', 'lesson-2'],
      lessonProgress: { 'lesson-1': 100, 'lesson-2': 100 },
      lessonPositions: {},
      lastLessonId: 'lesson-2',
    });

    renderClientCoursePlayer('/client/courses/course-1/lessons/lesson-2');

    await waitFor(() => {
      expect(mockLoadCourse).toHaveBeenCalledWith('course-1', { includeDrafts: false, preferRemote: true });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('client-completion-screen')).not.toBeInTheDocument();
    });
  });

  it('renders reflection prompts and download lessons as first-class learner content', async () => {
    const user = userEvent.setup();
    mockLoadCourse.mockResolvedValue({
      course: {
        ...mockCourse,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  reflectionPrompt: '<p>What stood out to you most?</p>',
                },
              },
              {
                id: 'lesson-download',
                title: 'Download Lesson',
                type: 'download',
                order: 2,
                order_index: 2,
                duration: '3 min',
                content: {
                  fileUrl: 'https://example.com/resource.pdf',
                  description: 'Take this worksheet with you.',
                },
              },
            ],
          },
        ],
        chapters: [
          {
            id: 'chapter-1',
            title: 'Chapter 1',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  reflectionPrompt: '<p>What stood out to you most?</p>',
                },
              },
              {
                id: 'lesson-download',
                title: 'Download Lesson',
                type: 'download',
                order: 2,
                order_index: 2,
                duration: '3 min',
                content: {
                  fileUrl: 'https://example.com/resource.pdf',
                  description: 'Take this worksheet with you.',
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection Lesson',
              type: 'reflection',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                reflectionPrompt: '<p>What stood out to you most?</p>',
              },
            },
            {
              id: 'lesson-download',
              title: 'Download Lesson',
              type: 'download',
              order: 2,
              order_index: 2,
              duration: '3 min',
              content: {
                fileUrl: 'https://example.com/resource.pdf',
                description: 'Take this worksheet with you.',
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-reflection',
          title: 'Reflection Lesson',
          type: 'reflection',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            reflectionPrompt: '<p>What stood out to you most?</p>',
          },
        },
        {
          id: 'lesson-download',
          title: 'Download Lesson',
          type: 'download',
          order: 2,
          order_index: 2,
          duration: '3 min',
          content: {
            fileUrl: 'https://example.com/resource.pdf',
            description: 'Take this worksheet with you.',
          },
        },
      ],
      source: 'supabase' as const,
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lms/courses/course-1/lesson/lesson-reflection']}>
          <Routes>
            <Route path="/lms/courses/:courseId/lesson/:lessonId" element={<CoursePlayer namespace="admin" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('button', { name: /begin reflection/i })).toBeInTheDocument();
    expect(screen.getByText('Guided Reflection')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /begin reflection/i }));
    expect((await screen.findAllByText('Reflection Prompt')).length).toBeGreaterThan(0);
    expect(await screen.findByText((content) => content.includes('What stood out to you most?'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Download Lesson/i }));

    expect(await screen.findByRole('link', { name: /download resource/i })).toHaveAttribute(
      'href',
      'https://example.com/resource.pdf',
    );
  });

  it('saves reflection responses and restores previously saved content on reload', async () => {
    mockFetchLearnerReflection
      .mockResolvedValueOnce({
        id: 'reflection-1',
        organizationId: 'org-1',
        courseId: 'course-1',
        lessonId: 'lesson-reflection',
        userId: 'local-user',
        responseText: '',
        status: 'draft',
        createdAt: '2026-04-08T12:00:00.000Z',
        updatedAt: '2026-04-08T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'reflection-1',
        organizationId: 'org-1',
        courseId: 'course-1',
        lessonId: 'lesson-reflection',
        userId: 'local-user',
        responseText: 'Saved reflection text',
        status: 'draft',
        createdAt: '2026-04-08T12:00:00.000Z',
        updatedAt: '2026-04-08T12:05:00.000Z',
      });

    mockLoadCourse.mockResolvedValue({
      ...mockLoadCourseResult,
      course: {
        ...mockLoadCourseResult.course,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  prompt: 'What stood out to you most?',
                  collectResponse: true,
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection Lesson',
              type: 'reflection',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                prompt: 'What stood out to you most?',
                collectResponse: true,
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-reflection',
          title: 'Reflection Lesson',
          type: 'reflection',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            prompt: 'What stood out to you most?',
            collectResponse: true,
          },
        },
      ],
    });

    const user = userEvent.setup();
    const view = renderCoursePlayer('/lms/courses/course-1/lesson/lesson-reflection');

    await screen.findByRole('button', { name: /begin reflection/i });
    await user.click(screen.getByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));
    const input = await screen.findByPlaceholderText('Take a moment to reflect and write your thoughts here...');
    await user.type(input, 'Saved reflection text');
    await waitFor(() => {
      expect(mockSaveLearnerReflection).toHaveBeenCalledWith({
        courseId: 'course-1',
        lessonId: 'lesson-reflection',
        responseText: 'Saved reflection text',
        responseData: expect.objectContaining({
          promptResponse: 'Saved reflection text',
        }),
        status: 'draft',
      });
    }, { timeout: 2500 });

    view.unmount();
    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-reflection');

    expect(await screen.findByDisplayValue('Saved reflection text')).toBeInTheDocument();
  }, 10000);

  it('recovers an unsaved local reflection draft after refresh', async () => {
    window.localStorage.setItem(
      'reflection-draft:course-1:lesson-reflection:local-user',
      JSON.stringify({
        data: {
          promptResponse: 'Draft that never reached the server',
          deeperReflection1: '',
          deeperReflection2: '',
          deeperReflection3: '',
          actionCommitment: '',
          currentStepId: 'initial',
          submittedAt: null,
        },
        currentStepId: 'initial',
        updatedAt: '2026-04-08T12:10:00.000Z',
      }),
    );

    mockFetchLearnerReflection.mockResolvedValue({
      id: 'reflection-1',
      organizationId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-reflection',
      userId: 'local-user',
      responseText: 'Older saved reflection',
      status: 'draft',
      createdAt: '2026-04-08T12:00:00.000Z',
      updatedAt: '2026-04-08T12:05:00.000Z',
    });

    mockLoadCourse.mockResolvedValue({
      ...mockLoadCourseResult,
      course: {
        ...mockLoadCourseResult.course,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  prompt: 'What stood out to you most?',
                  collectResponse: true,
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection Lesson',
              type: 'reflection',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                prompt: 'What stood out to you most?',
                collectResponse: true,
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-reflection',
          title: 'Reflection Lesson',
          type: 'reflection',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            prompt: 'What stood out to you most?',
            collectResponse: true,
          },
        },
      ],
    });

    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-reflection');

    await screen.findByRole('button', { name: /continue/i });
    expect(await screen.findByDisplayValue('Draft that never reached the server')).toBeInTheDocument();
    expect(screen.getByText('Recovered your latest draft from this device.')).toBeInTheDocument();
  }, 10000);

  it('submits reflection responses, marks the lesson complete, and advances to the next lesson', async () => {
    mockLoadCourse.mockResolvedValue({
      course: {
        ...mockCourse,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  prompt: 'What changed for you in this lesson?',
                  collectResponse: true,
                },
              },
              {
                id: 'lesson-next',
                title: 'Next Lesson',
                type: 'text',
                order: 2,
                order_index: 2,
                duration: '3 min',
                content: {
                  textContent: '<p>Next lesson content</p>',
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection Lesson',
              type: 'reflection',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                prompt: 'What changed for you in this lesson?',
                collectResponse: true,
              },
            },
            {
              id: 'lesson-next',
              title: 'Next Lesson',
              type: 'text',
              order: 2,
              order_index: 2,
              duration: '3 min',
              content: {
                textContent: '<p>Next lesson content</p>',
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-reflection',
          title: 'Reflection Lesson',
          type: 'reflection',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            prompt: 'What changed for you in this lesson?',
            collectResponse: true,
          },
        },
        {
          id: 'lesson-next',
          title: 'Next Lesson',
          type: 'text',
          order: 2,
          order_index: 2,
          duration: '3 min',
          content: {
            textContent: '<p>Next lesson content</p>',
          },
        },
      ],
      source: 'supabase' as const,
    });

    const user = userEvent.setup();
    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-reflection');

    await user.click(await screen.findByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));
    await user.type(
      await screen.findByPlaceholderText('Take a moment to reflect and write your thoughts here...'),
      'I need to slow down.',
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /submit reflection/i }));

    await waitFor(() => {
      expect(mockSaveLearnerReflection).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'course-1',
          lessonId: 'lesson-reflection',
          status: 'submitted',
          responseData: expect.objectContaining({
            promptResponse: 'I need to slow down.',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
      expect(screen.getByText('Next lesson content')).toBeInTheDocument();
    });
  }, 12000);

  it('loads a survey lesson, submits successfully, and advances to the next lesson', async () => {
    mockLoadCourse.mockResolvedValue({
      course: {
        ...mockCourse,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-survey',
                title: 'Survey Lesson',
                type: 'survey',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  surveyId: 'survey-1',
                  surveyDescription: 'Tell us how this landed for you.',
                },
              },
              {
                id: 'lesson-next',
                title: 'Next Lesson',
                type: 'text',
                order: 2,
                order_index: 2,
                duration: '3 min',
                content: {
                  textContent: '<p>Next lesson content</p>',
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-survey',
              title: 'Survey Lesson',
              type: 'survey',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                surveyId: 'survey-1',
                surveyDescription: 'Tell us how this landed for you.',
              },
            },
            {
              id: 'lesson-next',
              title: 'Next Lesson',
              type: 'text',
              order: 2,
              order_index: 2,
              duration: '3 min',
              content: {
                textContent: '<p>Next lesson content</p>',
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-survey',
          title: 'Survey Lesson',
          type: 'survey',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            surveyId: 'survey-1',
            surveyDescription: 'Tell us how this landed for you.',
          },
        },
        {
          id: 'lesson-next',
          title: 'Next Lesson',
          type: 'text',
          order: 2,
          order_index: 2,
          duration: '3 min',
          content: {
            textContent: '<p>Next lesson content</p>',
          },
        },
      ],
      source: 'supabase' as const,
    });

    mockFetchAssignedSurveysForLearner.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          survey_id: 'survey-1',
          status: 'assigned',
          metadata: {},
        },
        survey: {
          id: 'survey-1',
          title: 'Learner Survey',
          description: 'Tell us how this landed for you.',
          sections: [
            {
              id: 'section-1',
              title: 'Section 1',
              order: 1,
              questions: [
                {
                  id: 'question-1',
                  type: 'open-ended',
                  title: 'What stood out to you?',
                  required: true,
                  order: 1,
                },
              ],
            },
          ],
          blocks: [],
        },
      },
    ]);

    const user = userEvent.setup();
    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-survey');

    expect(await screen.findByText('Learner Survey')).toBeInTheDocument();
    await user.type(await screen.findByPlaceholderText('Type your answer…'), 'The pacing felt clear.');
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(mockSubmitLearnerSurveyResponse).toHaveBeenCalledWith(
        'survey-1',
        expect.objectContaining({
          assignmentId: 'assignment-1',
          responses: {
            'question-1': 'The pacing felt clear.',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
      expect(screen.getByText('Next lesson content')).toBeInTheDocument();
    });
  }, 12000);

  it('does not show survey success or advance when submission fails', async () => {
    mockLoadCourse.mockResolvedValue({
      course: {
        ...mockCourse,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-survey',
                title: 'Survey Lesson',
                type: 'survey',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  surveyId: 'survey-1',
                },
              },
              {
                id: 'lesson-next',
                title: 'Next Lesson',
                type: 'text',
                order: 2,
                order_index: 2,
                duration: '3 min',
                content: {
                  textContent: '<p>Next lesson content</p>',
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-survey',
              title: 'Survey Lesson',
              type: 'survey',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                surveyId: 'survey-1',
              },
            },
            {
              id: 'lesson-next',
              title: 'Next Lesson',
              type: 'text',
              order: 2,
              order_index: 2,
              duration: '3 min',
              content: {
                textContent: '<p>Next lesson content</p>',
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-survey',
          title: 'Survey Lesson',
          type: 'survey',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            surveyId: 'survey-1',
          },
        },
        {
          id: 'lesson-next',
          title: 'Next Lesson',
          type: 'text',
          order: 2,
          order_index: 2,
          duration: '3 min',
          content: {
            textContent: '<p>Next lesson content</p>',
          },
        },
      ],
      source: 'supabase' as const,
    });

    mockFetchAssignedSurveysForLearner.mockResolvedValue([
      {
        assignment: {
          id: 'assignment-1',
          surveyId: 'survey-1',
          survey_id: 'survey-1',
          status: 'assigned',
          metadata: {},
        },
        survey: {
          id: 'survey-1',
          title: 'Learner Survey',
          description: '',
          sections: [
            {
              id: 'section-1',
              title: 'Section 1',
              order: 1,
              questions: [
                {
                  id: 'question-1',
                  type: 'open-ended',
                  title: 'What stood out to you?',
                  required: true,
                  order: 1,
                },
              ],
            },
          ],
          blocks: [],
        },
      },
    ]);
    mockSubmitLearnerSurveyResponse.mockRejectedValueOnce(new Error('submit failed'));

    const user = userEvent.setup();
    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-survey');

    await user.type(await screen.findByPlaceholderText('Type your answer…'), 'The pacing felt clear.');
    await user.click(screen.getByRole('button', { name: /submit survey/i }));

    expect(await screen.findByText('Unable to submit your survey right now. Your answers are still on screen.')).toBeInTheDocument();
    expect(screen.getByText('Learner Survey')).toBeInTheDocument();
    expect(screen.queryByText('Next lesson content')).not.toBeInTheDocument();
    expect(mockUpdateAssignmentProgress).not.toHaveBeenCalledWith('course-1', 'local-user', 100);
  }, 12000);

  it('renders a wide reflection textarea and exposes a manual Save draft button', async () => {
    mockFetchLearnerReflection.mockResolvedValue(null);
    mockSaveLearnerReflection.mockResolvedValue({
      id: 'reflection-1',
      organizationId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-reflection',
      userId: 'local-user',
      responseText: 'Saved reflection text',
      responseData: {
        promptResponse: 'Saved reflection text',
        deeperReflection1: '',
        deeperReflection2: '',
        deeperReflection3: '',
        actionCommitment: '',
        currentStepId: 'initial',
        submittedAt: null,
      },
      status: 'draft',
      createdAt: '2026-04-08T12:00:00.000Z',
      updatedAt: '2026-04-08T12:00:00.000Z',
    });

    mockLoadCourse.mockResolvedValue({
      ...mockLoadCourseResult,
      course: {
        ...mockLoadCourseResult.course,
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            description: '',
            duration: '8 min',
            order: 1,
            lessons: [
              {
                id: 'lesson-reflection',
                title: 'Reflection Lesson',
                type: 'reflection',
                order: 1,
                order_index: 1,
                duration: '5 min',
                content: {
                  prompt: 'What stood out to you most?',
                  collectResponse: true,
                },
              },
            ],
          },
        ],
      },
      modules: [
        {
          id: 'module-1',
          title: 'Module 1',
          description: '',
          duration: '8 min',
          order: 1,
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection Lesson',
              type: 'reflection',
              order: 1,
              order_index: 1,
              duration: '5 min',
              content: {
                prompt: 'What stood out to you most?',
                collectResponse: true,
              },
            },
          ],
        },
      ],
      lessons: [
        {
          id: 'lesson-reflection',
          title: 'Reflection Lesson',
          type: 'reflection',
          order: 1,
          order_index: 1,
          duration: '5 min',
          content: {
            prompt: 'What stood out to you most?',
            collectResponse: true,
          },
        },
      ],
    });

    const user = userEvent.setup();
    renderCoursePlayer('/lms/courses/course-1/lesson/lesson-reflection');

    await screen.findByRole('button', { name: /begin reflection/i });
    await user.click(screen.getByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));

    const textarea = await screen.findByPlaceholderText('Take a moment to reflect and write your thoughts here...');
    expect(textarea).toHaveClass('w-full');
    expect(textarea).toHaveClass('min-h-[300px]');

    await user.type(textarea, 'Wide response text');
    await user.click(await screen.findByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(mockSaveLearnerReflection).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'course-1',
          lessonId: 'lesson-reflection',
          status: 'draft',
          responseData: expect.objectContaining({ promptResponse: 'Wide response text' }),
        }),
      );
    });
  });
});
