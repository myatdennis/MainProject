import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiRequest = vi.fn();
const mockGetUserSession = vi.fn();

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
  enqueueProgressSnapshot: vi.fn(),
  hasPendingItems: vi.fn(() => false),
  processOfflineQueue: vi.fn(),
  initializeOfflineQueue: vi.fn(),
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
