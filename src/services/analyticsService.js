/**
 * 📊 Advanced Analytics Service
 *
 * Comprehensive event tracking, learner analytics, and admin dashboard metrics
 * for deep insights into course performance and learner engagement.
 */
import { analyticsApiClient } from './analytics/analyticsApiClient';
import { EventQueue } from './analytics/eventQueue';
import { ensureJourney, recordJourneyEvent, deriveJourneyKey } from './analytics/journeyUpdater';
class AnalyticsService {
    constructor() {
        this.eventQueue = new EventQueue();
        this.learnerJourneys = new Map();
        this.sessionId = this.generateSessionId();
        this.bootstrapAnalytics();
        this.setupEventCollection();
    }
    /**
     * 📈 Track analytics event
     */
    trackEvent(type, userId, data = {}, courseId, lessonId, moduleId) {
        const event = {
            id: this.generateEventId(),
            type,
            userId,
            courseId,
            lessonId,
            moduleId,
            timestamp: new Date().toISOString(),
            data,
            userAgent: navigator.userAgent,
            sessionId: this.sessionId
        };
        this.eventQueue.add(event);
        this.updateLearnerJourney(event);
        this.persistEventRemote(event).catch((error) => {
            console.error('Failed to persist analytics event remotely', error);
        });
        // Real-time processing for critical events
        this.processRealTimeEvent(event);
    }
    /**
     * 🎯 Track course completion with detailed metrics
     */
    trackCourseCompletion(userId, courseId, completionData) {
        this.trackEvent('course_completed', userId, {
            ...completionData,
            completionTimestamp: new Date().toISOString()
        }, courseId);
        // Update journey completion
        const journeyKey = `${userId}_${courseId}`;
        const journey = this.learnerJourneys.get(journeyKey);
        if (journey) {
            journey.completedAt = new Date().toISOString();
            journey.progressPercentage = 100;
            journey.milestones.push({
                type: 'certificate_earned',
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * 🕐 Track detailed video analytics
     */
    trackVideoEngagement(userId, courseId, lessonId, videoData) {
        this.trackEvent(`video_${videoData.action}`, userId, videoData, courseId, lessonId);
        // Detect engagement patterns
        if (videoData.action === 'seek') {
            this.detectSeekingPatterns(userId, courseId, lessonId, videoData);
        }
    }
    /**
     * 🧠 Advanced learner journey analysis
     */
    updateLearnerJourney(event) {
        if (!event.courseId || event.userId === 'system')
            return;
        const journey = ensureJourney(this.learnerJourneys, event);
        if (!journey)
            return;
        recordJourneyEvent(journey, event);
        // Update journey metrics
        journey.lastActiveAt = event.timestamp;
        // Calculate engagement score
        journey.engagementScore = this.calculateEngagementScore(journey, event);
        // Detect struggling patterns
        this.detectStrugglingPatterns(journey, event);
        // Track milestones
        this.trackMilestones(journey, event);
        this.learnerJourneys.set(deriveJourneyKey(journey.userId, journey.courseId), journey);
        this.persistJourneyRemote(journey).catch((error) => {
            console.error('Failed to persist learner journey', error);
        });
    }
    /**
     * 📊 Generate comprehensive course analytics
     */
    getCourseAnalytics(courseId) {
        const courseEvents = this.eventQueue
            .all()
            .filter(event => event.courseId === courseId);
        const uniqueLearners = new Set(courseEvents.map(e => e.userId)).size;
        const completions = courseEvents.filter(e => e.type === 'course_completed').length;
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const activeLastWeek = new Set(courseEvents
            .filter(e => new Date(e.timestamp) > lastWeek)
            .map(e => e.userId)).size;
        return {
            courseId,
            totalLearners: uniqueLearners,
            activeLastWeek,
            averageTimeSpent: this.calculateAverageTimeSpent(courseId),
            completionRate: uniqueLearners > 0 ? (completions / uniqueLearners) * 100 : 0,
            dropOffRate: this.calculateDropOffRate(courseId),
            engagementScore: this.calculateCourseEngagementScore(courseId),
            hottestContent: this.getHottestContent(courseId),
            strugglingLearners: this.getStrugglingLearners(courseId),
            peakUsageHours: this.getPeakUsageHours(courseId)
        };
    }
    /**
     * 🔥 Identify most engaging content
     */
    getHottestContent(courseId) {
        const contentMap = new Map();
        this.eventQueue
            .all()
            .filter(event => event.courseId === courseId && event.lessonId)
            .forEach(event => {
            const key = event.lessonId;
            if (!contentMap.has(key)) {
                contentMap.set(key, {
                    contentId: key,
                    contentType: 'lesson',
                    title: event.data.lessonTitle || `Lesson ${key}`,
                    views: 0,
                    avgTimeSpent: 0,
                    completionRate: 0,
                    replays: 0,
                    difficulty: 'medium'
                });
            }
            const content = contentMap.get(key);
            if (event.type === 'lesson_started')
                content.views++;
            if (event.type === 'lesson_replay')
                content.replays++;
        });
        return Array.from(contentMap.values())
            .sort((a, b) => (b.views + b.replays) - (a.views + a.replays))
            .slice(0, 10);
    }
    /**
     * 🚨 Identify learners who need help
     */
    getStrugglingLearners(courseId) {
        const strugglingLearners = [];
        Array.from(this.learnerJourneys.values())
            .filter(journey => journey.courseId === courseId)
            .forEach(journey => {
            if (journey.strugglingIndicators.length > 0) {
                strugglingLearners.push({
                    userId: journey.userId,
                    userName: `User ${journey.userId}`, // Would be replaced with actual name
                    courseId: journey.courseId,
                    currentProgress: journey.progressPercentage,
                    timeSpent: journey.totalTimeSpent,
                    lastActive: journey.lastActiveAt,
                    strugglingIndicators: journey.strugglingIndicators,
                    recommendedActions: this.generateRecommendations(journey)
                });
            }
        });
        return strugglingLearners.slice(0, 10);
    }
    /**
     * 🕒 Analyze peak usage patterns
     */
    getPeakUsageHours(courseId) {
        const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            usage: 0,
            completion: 0,
            engagement: 0
        }));
        this.eventQueue
            .all()
            .filter(event => event.courseId === courseId)
            .forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            hourlyData[hour].usage++;
            if (event.type === 'course_completed') {
                hourlyData[hour].completion++;
            }
            // Engagement events
            if (['quiz_passed', 'lesson_completed', 'video_play'].includes(event.type)) {
                hourlyData[hour].engagement++;
            }
        });
        return hourlyData;
    }
    /**
     * 🎯 Calculate engagement score algorithm
     */
    calculateEngagementScore(journey, event) {
        let score = journey.engagementScore;
        // Positive engagement actions
        const positiveActions = [
            'lesson_completed', 'quiz_passed', 'video_play', 'course_completed'
        ];
        // Negative engagement actions
        const negativeActions = [
            'quiz_failed', 'lesson_paused', 'course_abandoned'
        ];
        if (positiveActions.includes(event.type)) {
            score += 10;
        }
        else if (negativeActions.includes(event.type)) {
            score -= 5;
        }
        // Time-based engagement
        if (event.duration && event.duration > 300000) { // 5+ minutes
            score += 5;
        }
        return Math.max(0, Math.min(100, score));
    }
    /**
     * 🚨 Detect struggling learner patterns
     */
    detectStrugglingPatterns(journey, event) {
        const indicators = journey.strugglingIndicators;
        // Multiple quiz failures
        const recentEvents = this.eventQueue
            .all()
            .filter(e => e.userId === journey.userId && e.courseId === journey.courseId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);
        const failureCount = recentEvents.filter(e => e.type === 'quiz_failed').length;
        if (failureCount >= 3 && !indicators.includes('multiple_quiz_failures')) {
            indicators.push('multiple_quiz_failures');
        }
        // Long inactivity
        const daysSinceLastActive = (Date.now() - new Date(journey.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastActive > 7 && !indicators.includes('long_inactivity')) {
            indicators.push('long_inactivity');
        }
        // Excessive video seeking
        if (event.type === 'video_seek' && event.data.seekCount > 10) {
            if (!indicators.includes('excessive_seeking')) {
                indicators.push('excessive_seeking');
            }
        }
        // Low engagement score
        if (journey.engagementScore < 30 && !indicators.includes('low_engagement')) {
            indicators.push('low_engagement');
        }
    }
    /**
     * 💡 Generate personalized recommendations
     */
    generateRecommendations(journey) {
        const recommendations = [];
        journey.strugglingIndicators.forEach(indicator => {
            switch (indicator) {
                case 'multiple_quiz_failures':
                    recommendations.push('Review prerequisite materials');
                    recommendations.push('Schedule a 1:1 support session');
                    break;
                case 'long_inactivity':
                    recommendations.push('Send re-engagement email');
                    recommendations.push('Assign a learning buddy');
                    break;
                case 'excessive_seeking':
                    recommendations.push('Provide supplementary materials');
                    recommendations.push('Offer alternative content format');
                    break;
                case 'low_engagement':
                    recommendations.push('Check learning preferences');
                    recommendations.push('Adjust content difficulty');
                    break;
            }
        });
        return [...new Set(recommendations)]; // Remove duplicates
    }
    /**
     * 📈 Real-time event processing for alerts
     */
    processRealTimeEvent(event) {
        // Alert for critical events
        const criticalEvents = ['quiz_failed', 'course_abandoned', 'error_occurred'];
        if (criticalEvents.includes(event.type)) {
            this.triggerRealTimeAlert(event);
        }
        // Performance monitoring
        if (event.type === 'slow_load' && event.data.loadTime > 5000) {
            this.logPerformanceIssue(event);
        }
    }
    /**
     * 🚨 Trigger real-time alerts for admin
     */
    triggerRealTimeAlert(event) {
        console.info('[Analytics] Alert triggered', {
            eventId: event.id,
            type: event.type,
            severity: this.getAlertSeverity(event.type),
            message: this.generateAlertMessage(event)
        });
    }
    getAlertSeverity(eventType) {
        switch (eventType) {
            case 'course_abandoned': return 'high';
            case 'quiz_failed': return 'medium';
            case 'error_occurred': return 'high';
            default: return 'low';
        }
    }
    generateAlertMessage(event) {
        switch (event.type) {
            case 'course_abandoned':
                return `User ${event.userId} abandoned course ${event.courseId}`;
            case 'quiz_failed':
                return `User ${event.userId} failed quiz in ${event.courseId}`;
            case 'error_occurred':
                return `Error in course ${event.courseId}: ${event.data.error}`;
            default:
                return `Event: ${event.type}`;
        }
    }
    // Utility Methods
    calculateAverageTimeSpent(courseId) {
        const journeys = Array.from(this.learnerJourneys.values())
            .filter(j => j.courseId === courseId);
        if (journeys.length === 0)
            return 0;
        const totalTime = journeys.reduce((sum, j) => sum + j.totalTimeSpent, 0);
        return totalTime / journeys.length;
    }
    calculateDropOffRate(courseId) {
        const started = this.eventQueue
            .all()
            .filter(e => e.courseId === courseId && e.type === 'course_started').length;
        const abandoned = this.eventQueue
            .all()
            .filter(e => e.courseId === courseId && e.type === 'course_abandoned').length;
        return started > 0 ? (abandoned / started) * 100 : 0;
    }
    calculateCourseEngagementScore(courseId) {
        const journeys = Array.from(this.learnerJourneys.values())
            .filter(j => j.courseId === courseId);
        if (journeys.length === 0)
            return 0;
        const avgScore = journeys.reduce((sum, j) => sum + j.engagementScore, 0) / journeys.length;
        return Math.round(avgScore);
    }
    detectSeekingPatterns(userId, courseId, lessonId, _videoData) {
        // Implementation for detecting excessive seeking or confusion patterns
        const seekEvents = this.eventQueue
            .all()
            .filter(e => e.userId === userId &&
            e.courseId === courseId &&
            e.lessonId === lessonId &&
            e.type === 'video_seek');
        if (seekEvents.length > 10) {
            this.trackEvent('video_seek', userId, {
                seekCount: seekEvents.length,
                pattern: 'excessive'
            }, courseId, lessonId);
        }
    }
    trackMilestones(journey, event) {
        const milestoneEvents = [
            'lesson_completed', 'quiz_passed', 'course_completed'
        ];
        if (milestoneEvents.includes(event.type)) {
            journey.milestones.push({
                type: event.type,
                timestamp: event.timestamp,
                lessonId: event.lessonId,
                moduleId: event.moduleId,
                score: event.data.score
            });
        }
    }
    logPerformanceIssue(event) {
        console.warn('[Analytics] Performance issue detected', {
            timestamp: event.timestamp,
            type: event.type,
            data: event.data,
            userAgent: event.userAgent
        });
    }
    setupEventCollection() {
        // Auto-track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, potential drop-off
                this.trackEvent('page_view', 'system', { visibility: 'hidden' });
            }
        });
        // Auto-track errors
        window.addEventListener('error', (e) => {
            this.trackEvent('error_occurred', 'system', {
                error: e.message,
                filename: e.filename,
                lineno: e.lineno
            });
        });
    }
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async bootstrapAnalytics() {
        try {
            const eventsResponse = await analyticsApiClient.fetchEvents();
            (eventsResponse.data || []).forEach((record) => {
                const event = {
                    id: record.id,
                    type: record.event_type,
                    userId: record.user_id,
                    courseId: record.course_id ?? undefined,
                    lessonId: record.lesson_id ?? undefined,
                    moduleId: record.module_id ?? undefined,
                    timestamp: record.created_at,
                    data: record.payload ?? {},
                    userAgent: record.user_agent ?? '',
                    sessionId: record.session_id ?? ''
                };
                this.eventQueue.add(event);
            });
            const journeysResponse = await analyticsApiClient.fetchJourneys();
            (journeysResponse.data || []).forEach((record) => {
                const journey = {
                    userId: record.user_id,
                    courseId: record.course_id,
                    startedAt: record.started_at,
                    lastActiveAt: record.last_active_at,
                    completedAt: record.completed_at ?? undefined,
                    totalTimeSpent: record.total_time_spent ?? 0,
                    sessionsCount: record.sessions_count ?? 0,
                    progressPercentage: Number(record.progress_percentage ?? 0),
                    engagementScore: Number(record.engagement_score ?? 0),
                    strugglingIndicators: [],
                    milestones: record.milestones ?? [],
                    dropOffPoints: record.drop_off_points ?? [],
                    pathTaken: record.path_taken ?? []
                };
                const key = `${journey.userId}_${journey.courseId}`;
                this.learnerJourneys.set(key, journey);
            });
        }
        catch (error) {
            console.warn('Failed to bootstrap analytics from API', error);
        }
    }
    persistAnalytics() {
        // Remote persistence handled per event; no local persistence required
    }
    async persistEventRemote(event) {
        await analyticsApiClient.persistEvent(event);
    }
    async persistJourneyRemote(journey) {
        await analyticsApiClient.persistJourney(journey);
    }
    // Public API Methods
    getEvents(filters) {
        const events = this.eventQueue
            .filter(filters)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return events;
    }
    getLearnerJourney(userId, courseId) {
        return this.learnerJourneys.get(`${userId}_${courseId}`) || null;
    }
    getAllJourneys() {
        return Array.from(this.learnerJourneys.values());
    }
    clearOldData(daysOld) {
        this.eventQueue.clearOlderThan(daysOld);
        this.persistAnalytics();
    }
}
// Export singleton instance
export const analyticsService = new AnalyticsService();
