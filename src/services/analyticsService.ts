/**
 * 📊 Advanced Analytics Service
 * 
 * Comprehensive event tracking, learner analytics, and admin dashboard metrics
 * for deep insights into course performance and learner engagement.
 */

import { supabase } from '../lib/supabase';

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

export type EventType = 
  // Course Events
  | 'course_started' | 'course_resumed' | 'course_completed' | 'course_abandoned'
  // Lesson Events  
  | 'lesson_started' | 'lesson_completed' | 'lesson_paused' | 'lesson_replay'
  // Video Events
  | 'video_play' | 'video_pause' | 'video_seek' | 'video_speed_change' | 'video_fullscreen'
  // Engagement Events
  | 'quiz_started' | 'quiz_submitted' | 'quiz_passed' | 'quiz_failed' | 'quiz_retaken'
  // Navigation Events
  | 'page_view' | 'navigation_click' | 'download_resource' | 'external_link_click'
  // Performance Events
  | 'slow_load' | 'error_occurred' | 'retry_action' | 'offline_detected';

export interface LearnerJourney {
  userId: string;
  courseId: string;
  startedAt: string;
  lastActiveAt: string;
  completedAt?: string;
  totalTimeSpent: number;
  sessionsCount: number;
  progressPercentage: number;
  engagementScore: number;
  strugglingIndicators: string[];
  milestones: JourneyMilestone[];
  dropOffPoints: DropOffPoint[];
  pathTaken: string[];
}

export interface JourneyMilestone {
  type: 'lesson_completed' | 'quiz_passed' | 'module_completed' | 'certificate_earned';
  timestamp: string;
  lessonId?: string;
  moduleId?: string;
  score?: number;
}

export interface DropOffPoint {
  location: string;
  timestamp: string;
  timeSpentBeforeDropOff: number;
  resumedAt?: string;
  abandoned: boolean;
}

export interface EngagementMetrics {
  courseId: string;
  totalLearners: number;
  activeLastWeek: number;
  averageTimeSpent: number;
  completionRate: number;
  dropOffRate: number;
  engagementScore: number;
  hottestContent: ContentEngagement[];
  strugglingLearners: LearnerProgress[];
  peakUsageHours: HourlyUsage[];
}

export interface ContentEngagement {
  contentId: string;
  contentType: 'lesson' | 'quiz' | 'resource' | 'video';
  title: string;
  views: number;
  avgTimeSpent: number;
  completionRate: number;
  replays: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LearnerProgress {
  userId: string;
  userName: string;
  courseId: string;
  currentProgress: number;
  timeSpent: number;
  lastActive: string;
  strugglingIndicators: string[];
  recommendedActions: string[];
}

export interface HourlyUsage {
  hour: number;
  usage: number;
  completion: number;
  engagement: number;
}

class AnalyticsService {
  private events: Map<string, AnalyticsEvent> = new Map();
  private learnerJourneys: Map<string, LearnerJourney> = new Map();
  private sessionId: string;
  private supabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  private remoteQueue: AnalyticsEvent[] = [];
  private remoteFlushTimer: number | null = null;
  private readonly REMOTE_FLUSH_INTERVAL = 4000;
  private readonly REMOTE_BATCH_SIZE = 50;
  private readonly handleReconnect = () => {
    if (this.supabaseConfigured) {
      void this.flushRemoteQueue();
    }
  };

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadStoredAnalytics();
    this.setupEventCollection();
    window.addEventListener('online', this.handleReconnect);
  }

  /**
   * 📈 Track analytics event
   */
  trackEvent(
    type: EventType, 
    userId: string, 
    data: Record<string, any> = {},
    courseId?: string,
    lessonId?: string,
    moduleId?: string
  ): void {
    const event: AnalyticsEvent = {
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

    this.events.set(event.id, event);
    this.updateLearnerJourney(event);
    this.persistAnalytics();
    this.enqueueRemoteEvent(event);

    // Real-time processing for critical events
    this.processRealTimeEvent(event);
  }

  /**
   * 🎯 Track course completion with detailed metrics
   */
  trackCourseCompletion(
    userId: string, 
    courseId: string, 
    completionData: {
      totalTimeSpent: number;
      finalScore?: number;
      modulesCompleted: number;
      lessonsCompleted: number;
      quizzesPassed: number;
      certificateGenerated: boolean;
    }
  ): void {
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
  trackVideoEngagement(
    userId: string,
    courseId: string,
    lessonId: string,
    videoData: {
      action: 'play' | 'pause' | 'seek' | 'complete';
      currentTime: number;
      duration: number;
      playbackRate: number;
      quality: string;
    }
  ): void {
    this.trackEvent(`video_${videoData.action}` as EventType, userId, videoData, courseId, lessonId);
    
    // Detect engagement patterns
    if (videoData.action === 'seek') {
      this.detectSeekingPatterns(userId, courseId, lessonId, videoData);
    }
  }

  /**
   * 🧠 Advanced learner journey analysis
   */
  updateLearnerJourney(event: AnalyticsEvent): void {
    if (!event.courseId) return;

    const journeyKey = `${event.userId}_${event.courseId}`;
    let journey = this.learnerJourneys.get(journeyKey);

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
        pathTaken: []
      };
    }

    // Update journey metrics
    journey.lastActiveAt = event.timestamp;
    journey.pathTaken.push(`${event.type}:${event.lessonId || 'general'}`);
    
    // Calculate engagement score
    journey.engagementScore = this.calculateEngagementScore(journey, event);
    
    // Detect struggling patterns
    this.detectStrugglingPatterns(journey, event);
    
    // Track milestones
    this.trackMilestones(journey, event);

    this.learnerJourneys.set(journeyKey, journey);
  }

  /**
   * 📊 Generate comprehensive course analytics
   */
  getCourseAnalytics(courseId: string): EngagementMetrics {
    const courseEvents = Array.from(this.events.values())
      .filter(event => event.courseId === courseId);
    
    const uniqueLearners = new Set(courseEvents.map(e => e.userId)).size;
    const completions = courseEvents.filter(e => e.type === 'course_completed').length;
    
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeLastWeek = new Set(
      courseEvents
        .filter(e => new Date(e.timestamp) > lastWeek)
        .map(e => e.userId)
    ).size;

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
  private getHottestContent(courseId: string): ContentEngagement[] {
    const contentMap = new Map<string, ContentEngagement>();
    
    Array.from(this.events.values())
      .filter(event => event.courseId === courseId && event.lessonId)
      .forEach(event => {
        const key = event.lessonId!;
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
        
        const content = contentMap.get(key)!;
        if (event.type === 'lesson_started') content.views++;
        if (event.type === 'lesson_replay') content.replays++;
      });

    return Array.from(contentMap.values())
      .sort((a, b) => (b.views + b.replays) - (a.views + a.replays))
      .slice(0, 10);
  }

  /**
   * 🚨 Identify learners who need help
   */
  private getStrugglingLearners(courseId: string): LearnerProgress[] {
    const strugglingLearners: LearnerProgress[] = [];
    
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
  private getPeakUsageHours(courseId: string): HourlyUsage[] {
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      usage: 0,
      completion: 0,
      engagement: 0
    }));

    Array.from(this.events.values())
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
  private calculateEngagementScore(journey: LearnerJourney, event: AnalyticsEvent): number {
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
    } else if (negativeActions.includes(event.type)) {
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
  private detectStrugglingPatterns(journey: LearnerJourney, event: AnalyticsEvent): void {
    const indicators = journey.strugglingIndicators;
    
    // Multiple quiz failures
    const recentEvents = Array.from(this.events.values())
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
  private generateRecommendations(journey: LearnerJourney): string[] {
    const recommendations: string[] = [];
    
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
  private processRealTimeEvent(event: AnalyticsEvent): void {
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
  private triggerRealTimeAlert(event: AnalyticsEvent): void {
    const alerts = JSON.parse(localStorage.getItem('realtime_alerts') || '[]');
    alerts.push({
      id: this.generateEventId(),
      type: event.type,
      userId: event.userId,
      courseId: event.courseId,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(event.type),
      message: this.generateAlertMessage(event)
    });
    
    localStorage.setItem('realtime_alerts', JSON.stringify(alerts.slice(-50)));
  }

  private getAlertSeverity(eventType: EventType): 'low' | 'medium' | 'high' {
    switch (eventType) {
      case 'course_abandoned': return 'high';
      case 'quiz_failed': return 'medium';
      case 'error_occurred': return 'high';
      default: return 'low';
    }
  }

  private generateAlertMessage(event: AnalyticsEvent): string {
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
  private calculateAverageTimeSpent(courseId: string): number {
    const journeys = Array.from(this.learnerJourneys.values())
      .filter(j => j.courseId === courseId);
    
    if (journeys.length === 0) return 0;
    
    const totalTime = journeys.reduce((sum, j) => sum + j.totalTimeSpent, 0);
    return totalTime / journeys.length;
  }

  private calculateDropOffRate(courseId: string): number {
    const started = Array.from(this.events.values())
      .filter(e => e.courseId === courseId && e.type === 'course_started').length;
    
    const abandoned = Array.from(this.events.values())
      .filter(e => e.courseId === courseId && e.type === 'course_abandoned').length;
    
    return started > 0 ? (abandoned / started) * 100 : 0;
  }

  private calculateCourseEngagementScore(courseId: string): number {
    const journeys = Array.from(this.learnerJourneys.values())
      .filter(j => j.courseId === courseId);
    
    if (journeys.length === 0) return 0;
    
    const avgScore = journeys.reduce((sum, j) => sum + j.engagementScore, 0) / journeys.length;
    return Math.round(avgScore);
  }

  private detectSeekingPatterns(userId: string, courseId: string, lessonId: string, _videoData: any): void {
    // Implementation for detecting excessive seeking or confusion patterns
    const seekEvents = Array.from(this.events.values())
      .filter(e => 
        e.userId === userId && 
        e.courseId === courseId && 
        e.lessonId === lessonId &&
        e.type === 'video_seek'
      );

    if (seekEvents.length > 10) {
      this.trackEvent('video_seek', userId, { 
        seekCount: seekEvents.length,
        pattern: 'excessive'
      }, courseId, lessonId);
    }
  }

  private trackMilestones(journey: LearnerJourney, event: AnalyticsEvent): void {
    const milestoneEvents: EventType[] = [
      'lesson_completed', 'quiz_passed', 'course_completed'
    ];

    if (milestoneEvents.includes(event.type)) {
      journey.milestones.push({
        type: event.type as any,
        timestamp: event.timestamp,
        lessonId: event.lessonId,
        moduleId: event.moduleId,
        score: event.data.score
      });
    }
  }

  private logPerformanceIssue(event: AnalyticsEvent): void {
    const issues = JSON.parse(localStorage.getItem('performance_issues') || '[]');
    issues.push({
      timestamp: event.timestamp,
      type: event.type,
      data: event.data,
      userAgent: event.userAgent
    });
    localStorage.setItem('performance_issues', JSON.stringify(issues.slice(-100)));
  }

  private setupEventCollection(): void {
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

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredAnalytics(): void {
    // Load events
    const storedEvents = localStorage.getItem('analytics_events');
    if (storedEvents) {
      try {
        const eventArray = JSON.parse(storedEvents);
        eventArray.forEach((event: AnalyticsEvent) => {
          this.events.set(event.id, event);
        });
      } catch (error) {
        console.error('Failed to load stored analytics events:', error);
      }
    }

    // Load journeys
    const storedJourneys = localStorage.getItem('learner_journeys');
    if (storedJourneys) {
      try {
        const journeyArray = JSON.parse(storedJourneys);
        journeyArray.forEach((journey: LearnerJourney) => {
          const key = `${journey.userId}_${journey.courseId}`;
          this.learnerJourneys.set(key, journey);
        });
      } catch (error) {
        console.error('Failed to load stored learner journeys:', error);
      }
    }
  }

  private persistAnalytics(): void {
    // Persist events (keep last 1000)
    const eventArray = Array.from(this.events.values()).slice(-1000);
    localStorage.setItem('analytics_events', JSON.stringify(eventArray));

    // Persist journeys
    const journeyArray = Array.from(this.learnerJourneys.values());
    localStorage.setItem('learner_journeys', JSON.stringify(journeyArray));
  }

  private enqueueRemoteEvent(event: AnalyticsEvent): void {
    if (!this.supabaseConfigured) return;
    this.remoteQueue.push(event);

    if (this.remoteQueue.length >= this.REMOTE_BATCH_SIZE) {
      void this.flushRemoteQueue();
      return;
    }

    this.scheduleRemoteFlush();
  }

  private scheduleRemoteFlush(): void {
    if (!this.supabaseConfigured || this.remoteFlushTimer || !navigator.onLine) {
      return;
    }

    this.remoteFlushTimer = window.setTimeout(() => {
      this.remoteFlushTimer = null;
      void this.flushRemoteQueue();
    }, this.REMOTE_FLUSH_INTERVAL);
  }

  private async flushRemoteQueue(): Promise<void> {
    if (!this.supabaseConfigured || this.remoteQueue.length === 0) {
      return;
    }

    if (this.remoteFlushTimer) {
      window.clearTimeout(this.remoteFlushTimer);
      this.remoteFlushTimer = null;
    }

    const batch = this.remoteQueue.splice(0, this.REMOTE_BATCH_SIZE);
    if (batch.length === 0) return;

    const payload = batch.map(event => ({
      event_id: event.id,
      organization_id: (event.data?.organizationId ?? null) as string | null,
      user_id: event.userId || null,
      course_id: event.courseId ?? null,
      lesson_id: event.lessonId ?? null,
      module_id: event.moduleId ?? null,
      event_type: event.type,
      payload: event.data ?? {},
      user_agent: event.userAgent,
      session_id: event.sessionId,
      occurred_at: event.timestamp,
    }));

    const { error } = await supabase
      .from('analytics_events')
      .upsert(payload, { onConflict: 'event_id' });

    if (error) {
      console.warn('Failed to persist analytics remotely, will retry', error);
      this.remoteQueue.unshift(...batch);
      this.scheduleRemoteFlush();
    }
  }

  // Public API Methods
  getEvents(filters?: Partial<AnalyticsEvent>): AnalyticsEvent[] {
    let events = Array.from(this.events.values());
    
    if (filters) {
      events = events.filter(event => {
        return Object.entries(filters).every(([key, value]) => {
          return event[key as keyof AnalyticsEvent] === value;
        });
      });
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getLearnerJourney(userId: string, courseId: string): LearnerJourney | null {
    return this.learnerJourneys.get(`${userId}_${courseId}`) || null;
  }

  getAllJourneys(): LearnerJourney[] {
    return Array.from(this.learnerJourneys.values());
  }

  clearOldData(daysOld: number): void {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    // Remove old events
    for (const [id, event] of this.events.entries()) {
      if (new Date(event.timestamp) < cutoffDate) {
        this.events.delete(id);
      }
    }

    this.persistAnalytics();
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();