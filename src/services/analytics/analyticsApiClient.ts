import apiRequest, { ApiError } from '../../utils/apiClient';
import type { AnalyticsEvent, LearnerJourney } from '../analyticsService';

const disabledStatuses = new Set([404, 501, 503]);

const handleAnalyticsFailure = <T>(error: unknown, fallback: T, context: string): T => {
  if (error instanceof ApiError && disabledStatuses.has(error.status)) {
    if (import.meta.env.DEV) {
      console.info(`[analyticsApiClient] ${context} disabled (status ${error.status}). Using fallback.`);
    }
    return fallback;
  }
  throw error;
};

export const analyticsApiClient = {
  fetchEvents: async () => {
    try {
      return await apiRequest<{ data: any[] }>('/api/analytics/events');
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchEvents');
    }
  },
  fetchJourneys: async () => {
    try {
      return await apiRequest<{ data: any[] }>('/api/analytics/journeys');
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchJourneys');
    }
  },
  persistEvent: async (event: AnalyticsEvent) => {
    try {
      await apiRequest('/api/analytics/events', {
        method: 'POST',
        body: JSON.stringify({
          id: event.id,
          user_id: event.userId && event.userId !== 'system' ? event.userId : null,
          course_id: event.courseId ?? null,
          lesson_id: event.lessonId ?? null,
          module_id: event.moduleId ?? null,
          event_type: event.type,
          session_id: event.sessionId,
          user_agent: event.userAgent,
          payload: event.data,
        }),
      });
    } catch (error) {
      handleAnalyticsFailure(error, { skipped: true }, 'persistEvent');
    }
  },
  persistJourney: async (journey: LearnerJourney) => {
    try {
      await apiRequest('/api/analytics/journeys', {
        method: 'POST',
        body: JSON.stringify({
          user_id: journey.userId,
          course_id: journey.courseId,
          journey: {
            startedAt: journey.startedAt,
            lastActiveAt: journey.lastActiveAt,
            completedAt: journey.completedAt,
            totalTimeSpent: journey.totalTimeSpent,
            sessionsCount: journey.sessionsCount,
            progressPercentage: journey.progressPercentage,
            engagementScore: journey.engagementScore,
            milestones: journey.milestones,
            dropOffPoints: journey.dropOffPoints,
            pathTaken: journey.pathTaken,
          },
        }),
      });
    } catch (error) {
      handleAnalyticsFailure(error, { skipped: true }, 'persistJourney');
    }
  },
  fetchCourseEngagement: async () => {
    try {
      return await apiRequest<{ data: { course_id: string; avg_progress: number; active_users: number }[] }>(
        '/api/analytics/course-engagement'
      );
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchCourseEngagement');
    }
  },
};
