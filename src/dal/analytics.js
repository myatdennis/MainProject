// Thin DAL facade over analytics service to centralize imports and enable future swapping
import { analyticsService } from '../services/analyticsService';
export const trackEvent = (type, userId, data = {}, courseId, lessonId, moduleId) => analyticsService.trackEvent(type, userId, data, courseId, lessonId, moduleId);
export const trackCourseCompletion = (userId, courseId, completionData) => analyticsService.trackCourseCompletion(userId, courseId, completionData);
export const getCourseAnalytics = (courseId) => analyticsService.getCourseAnalytics(courseId);
export const getEvents = (filters) => analyticsService.getEvents(filters);
export const getLearnerJourney = (userId, courseId) => analyticsService.getLearnerJourney(userId, courseId);
export const clearOldData = (daysOld) => analyticsService.clearOldData(daysOld);
export default {
    trackEvent,
    trackCourseCompletion,
    getCourseAnalytics,
    getEvents,
    getLearnerJourney,
    clearOldData,
};
