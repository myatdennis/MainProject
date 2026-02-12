import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockApiRequest = vi.fn(() => Promise.resolve({ data: {} }));
const mockEnsureReady = vi.hoisted(() => vi.fn(() => true));
const mockIsEnabled = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: () => mockApiRequest(),
}));

vi.mock('../analytics/analyticsApiClient', () => ({
  analyticsApiClient: {
    fetchEvents: vi.fn(() => Promise.resolve({ data: [] })),
    fetchJourneys: vi.fn(() => Promise.resolve({ data: [] })),
    persistEvent: mockApiRequest,
    persistJourney: mockApiRequest,
  },
  isAnalyticsEnabled: mockIsEnabled,
}));

describe('analyticsService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockApiRequest.mockResolvedValue({ data: [] });
    vi.stubEnv('VITE_ENABLE_ANALYTICS', 'true');
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
