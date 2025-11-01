import type { AnalyticsEvent, LearnerJourney } from '../analyticsService';

export const deriveJourneyKey = (userId: string, courseId: string): string => `${userId}_${courseId}`;

export const ensureJourney = (
  journeyMap: Map<string, LearnerJourney>,
  event: AnalyticsEvent,
): LearnerJourney | null => {
  if (!event.courseId || event.userId === 'system') return null;

  const key = deriveJourneyKey(event.userId, event.courseId);
  let journey = journeyMap.get(key);

  if (!journey) {
    journey = {
      userId: event.userId,
      courseId: event.courseId,
      startedAt: event.timestamp,
      lastActiveAt: event.timestamp,
      totalTimeSpent: 0,
      sessionsCount: 1,
      progressPercentage: 0,
      engagementScore: 0,
      strugglingIndicators: [],
      milestones: [],
      dropOffPoints: [],
      pathTaken: [],
    };
  }

  journeyMap.set(key, journey);
  return journey;
};

export const recordJourneyEvent = (journey: LearnerJourney, event: AnalyticsEvent) => {
  journey.lastActiveAt = event.timestamp;
  journey.pathTaken.push(`${event.type}:${event.lessonId || 'general'}`);
};
