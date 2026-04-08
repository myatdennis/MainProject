import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiRequest = vi.fn();
const mockGetUserSession = vi.fn();
const mockEnqueueProgressSnapshot = vi.fn();
const mockHasPendingItems = vi.fn(() => false);
const mockProcessOfflineQueue = vi.fn();
const mockInitializeOfflineQueue = vi.fn();

class MockApiError extends Error {
  status?: number;
  constructor(status?: number) {
    super('api error');
    this.status = status;
  }
}

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: mockApiRequest,
  ApiError: MockApiError,
}));

vi.mock('../../lib/secureStorage', () => ({
  getUserSession: mockGetUserSession,
}));

vi.mock('../../utils/NetworkErrorHandler', () => ({
  NetworkErrorHandler: {
    handleApiCall: async (fn: () => Promise<unknown>) => fn(),
    isOnline: vi.fn(() => true),
  },
}));

vi.mock('../offlineQueue', () => ({
  enqueueProgressSnapshot: mockEnqueueProgressSnapshot,
  hasPendingItems: mockHasPendingItems,
  processOfflineQueue: mockProcessOfflineQueue,
  initializeOfflineQueue: mockInitializeOfflineQueue,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const importService = async () => {
  const module = await import('../progressService');
  return module.progressService;
};

describe('progressService.fetchLessonProgress session enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    mockApiRequest.mockReset();
    mockGetUserSession.mockReset();
    mockEnqueueProgressSnapshot.mockReset();
    mockHasPendingItems.mockReset();
    mockHasPendingItems.mockReturnValue(false);
    mockProcessOfflineQueue.mockReset();
    mockInitializeOfflineQueue.mockReset();
    mockInitializeOfflineQueue.mockResolvedValue(undefined);
  });

  it('skips remote fetch when no session is available', async () => {
    mockGetUserSession.mockReturnValue(null);
    const service = await importService();

    const result = await service.fetchLessonProgress({
      userId: 'user-123',
      courseId: 'course-1',
      lessonIds: ['lesson-1'],
    });

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('skips remote fetch when requested user differs from authenticated session', async () => {
    mockGetUserSession.mockReturnValue({ id: 'another-user' });
    const service = await importService();

    const result = await service.fetchLessonProgress({
      userId: 'user-123',
      courseId: 'course-1',
      lessonIds: ['lesson-1'],
    });

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('returns snapshot rows when session matches and API succeeds', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    const lessons = [
      {
        lesson_id: 'lesson-1',
        progress_percentage: 75,
        completed: false,
        time_spent: 120,
        last_accessed_at: new Date().toISOString(),
      },
    ];

    mockApiRequest.mockResolvedValue({ data: { lessons } });

    const service = await importService();
    const result = await service.fetchLessonProgress({
      courseId: 'course-1',
      lessonIds: ['lesson-1'],
    });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual(lessons);
  });

  it('treats unauthorized errors as empty responses', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockApiRequest.mockRejectedValue(new MockApiError(401));

    const service = await importService();
    const result = await service.fetchLessonProgress({
      courseId: 'course-1',
      lessonIds: ['lesson-1'],
    });

    expect(result).toEqual([]);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('treats rate limit errors as empty responses', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockApiRequest.mockRejectedValue(new MockApiError(429));

    const service = await importService();
    const result = await service.fetchLessonProgress({
      courseId: 'course-1',
      lessonIds: ['lesson-1'],
    });

    expect(result).toEqual([]);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
});

describe('progressService.syncProgressSnapshot coalescing', () => {
  beforeEach(() => {
    vi.resetModules();
    mockApiRequest.mockReset();
    mockGetUserSession.mockReset();
    mockEnqueueProgressSnapshot.mockReset();
    mockHasPendingItems.mockReset();
    mockHasPendingItems.mockReturnValue(false);
    mockProcessOfflineQueue.mockReset();
    mockInitializeOfflineQueue.mockReset();
    mockInitializeOfflineQueue.mockResolvedValue(undefined);
  });

  it('coalesces overlapping snapshot saves for the same user/course', async () => {
    let firstRequestResolve!: (value: { ok: boolean }) => void;
    mockApiRequest
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            firstRequestResolve = resolve as (value: { ok: boolean }) => void;
          }),
      )
      .mockResolvedValueOnce({ ok: true });

    const service = await importService();

    const first = service.syncProgressSnapshot({
      userId: 'user-1',
      courseId: 'course-1',
      lessonIds: ['l1'],
      lessons: [{ lessonId: 'l1', progressPercent: 10, completed: false, positionSeconds: 5 }],
      overallPercent: 10,
      totalTimeSeconds: 5,
      lastLessonId: 'l1',
    });

    const second = service.syncProgressSnapshot({
      userId: 'user-1',
      courseId: 'course-1',
      lessonIds: ['l1'],
      lessons: [{ lessonId: 'l1', progressPercent: 65, completed: false, positionSeconds: 45 }],
      overallPercent: 65,
      totalTimeSeconds: 45,
      lastLessonId: 'l1',
    });

    await Promise.resolve();
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    firstRequestResolve({ ok: true });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });

  it('does not trigger immediate duplicate retry requests after a failed in-flight save', async () => {
    mockApiRequest.mockRejectedValue(new MockApiError(500));
    const service = await importService();

    const first = service.syncProgressSnapshot({
      userId: 'user-2',
      courseId: 'course-2',
      lessonIds: ['l2'],
      lessons: [{ lessonId: 'l2', progressPercent: 20, completed: false, positionSeconds: 12 }],
      overallPercent: 20,
      totalTimeSeconds: 12,
      lastLessonId: 'l2',
    });

    const second = service.syncProgressSnapshot({
      userId: 'user-2',
      courseId: 'course-2',
      lessonIds: ['l2'],
      lessons: [{ lessonId: 'l2', progressPercent: 30, completed: false, positionSeconds: 18 }],
      overallPercent: 30,
      totalTimeSeconds: 18,
      lastLessonId: 'l2',
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe(false);
    expect(secondResult).toBe(false);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockEnqueueProgressSnapshot).toHaveBeenCalledTimes(1);
  });
});
