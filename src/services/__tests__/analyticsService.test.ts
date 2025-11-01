import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockApiRequest = vi.fn(() => Promise.resolve({ data: {} }));

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockApiRequest(...args),
}));

describe('analyticsService', () => {
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  mockApiRequest.mockResolvedValue({ data: [] });
});

  it('records course lifecycle events', async () => {
    const { analyticsService } = await import('../analyticsService');

    analyticsService.trackCourseCompletion('user-1', 'course-1', {
      totalTimeSpent: 120,
      modulesCompleted: 5,
      lessonsCompleted: 12,
      quizzesPassed: 3,
      certificateGenerated: true,
    });

    await Promise.resolve();

    const events = analyticsService.getEvents();
    expect(events[0]?.type).toBe('course_completed');
    expect(mockApiRequest).toHaveBeenCalled();
  });

  it('tracks retry_action events', async () => {
    const { analyticsService } = await import('../analyticsService');

    analyticsService.trackEvent('retry_action', 'user-1', { component: 'progress-sync' });

    await Promise.resolve();

    const events = analyticsService.getEvents({ type: 'retry_action' });
    expect(events.length).toBeGreaterThan(0);
  });
});
