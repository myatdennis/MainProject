// Thin DAL facade over analytics service to centralize imports and enable future swapping
import {
  analyticsService,
  type AnalyticsEvent,
  type EngagementMetrics,
  type LearnerProgress,
  type HourlyUsage,
  type EventType,
} from '../services/analyticsService';

export type { AnalyticsEvent, EngagementMetrics, LearnerProgress, HourlyUsage, EventType };

export const trackEvent = (
  type: EventType,
  userId: string,
  data: Record<string, any> = {},
  courseId?: string,
  lessonId?: string,
  moduleId?: string,
) => analyticsService.trackEvent(type, userId, data, courseId, lessonId, moduleId);

export const trackCourseCompletion = (
  userId: string,
  courseId: string,
  completionData: {
    totalTimeSpent: number;
    finalScore?: number;
    modulesCompleted: number;
    lessonsCompleted: number;
    quizzesPassed: number;
    certificateGenerated: boolean;
  },
) => analyticsService.trackCourseCompletion(userId, courseId, completionData);

export const getCourseAnalytics = (courseId: string): EngagementMetrics =>
  analyticsService.getCourseAnalytics(courseId);

export const getEvents = (filters?: Partial<AnalyticsEvent>) =>
  analyticsService.getEvents(filters);

export const getLearnerJourney = (userId: string, courseId: string) =>
  analyticsService.getLearnerJourney(userId, courseId);

export const getAllJourneys = () => analyticsService.getAllJourneys();

export const clearOldData = (daysOld: number) => analyticsService.clearOldData(daysOld);

export default {
  trackEvent,
  trackCourseCompletion,
  getCourseAnalytics,
  getEvents,
  getLearnerJourney,
  getAllJourneys,
  clearOldData,
};
