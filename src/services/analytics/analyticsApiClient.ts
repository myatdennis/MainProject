import apiRequest from '../../utils/apiClient';
import type { AnalyticsEvent, LearnerJourney } from '../analyticsService';

export const analyticsApiClient = {
  fetchEvents: () => apiRequest<{ data: any[] }>('/api/analytics/events'),
  fetchJourneys: () => apiRequest<{ data: any[] }>('/api/analytics/journeys'),
  persistEvent: (event: AnalyticsEvent) =>
    apiRequest('/api/analytics/events', {
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
    }),
  persistJourney: (journey: LearnerJourney) =>
    apiRequest('/api/analytics/journeys', {
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
    }),
};
