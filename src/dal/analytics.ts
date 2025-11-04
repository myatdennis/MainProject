// Thin DAL facade over analytics service to centralize imports and enable future swapping
import { analyticsService } from '../services/analyticsService';

export type EventType =
  | 'course_started' | 'course_resumed' | 'course_completed' | 'course_abandoned'
  | 'lesson_started' | 'lesson_completed' | 'lesson_paused' | 'lesson_replay'
  | 'video_play' | 'video_pause' | 'video_seek' | 'video_speed_change' | 'video_fullscreen'
  | 'quiz_started' | 'quiz_submitted' | 'quiz_passed' | 'quiz_failed' | 'quiz_retaken'
  | 'page_view' | 'navigation_click' | 'download_resource' | 'external_link_click'
  | 'slow_load' | 'error_occurred' | 'retry_action' | 'offline_detected';

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId: string;
  courseId?: string;
  lessonId?: string;
  moduleId?: string;
  timestamp: string;
  duration?: number;
  data: Record<string, any>;
  userAgent: string;
  sessionId: string;
}

export interface EngagementMetrics {
  courseId: string;
  totalLearners: number;
  activeLastWeek: number;
  averageTimeSpent: number;
  completionRate: number;
  dropOffRate: number;
  engagementScore: number;
  hottestContent: any[];
  strugglingLearners: any[];
  peakUsageHours: any[];
}

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

export const clearOldData = (daysOld: number) => analyticsService.clearOldData(daysOld);

export default {
  trackEvent,
  trackCourseCompletion,
  getCourseAnalytics,
  getEvents,
  getLearnerJourney,
  clearOldData,
};
