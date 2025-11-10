export const deriveJourneyKey = (userId, courseId) => `${userId}_${courseId}`;
export const ensureJourney = (journeyMap, event) => {
    if (!event.courseId || event.userId === 'system')
        return null;
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
export const recordJourneyEvent = (journey, event) => {
    journey.lastActiveAt = event.timestamp;
    journey.pathTaken.push(`${event.type}:${event.lessonId || 'general'}`);
};
