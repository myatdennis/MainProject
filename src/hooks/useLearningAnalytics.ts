import { useEffect, useRef, useCallback, useState } from 'react';
import { useEnhancedCourseProgress } from './useEnhancedCourseProgress';

interface PerformanceMetrics {
  sessionStart: number;
  timeSpent: number;
  lessonsViewed: string[];
  quizzesAttempted: number;
  averageQuizScore: number;
  videoWatchTime: number;
  reflectionsWritten: number;
  coursesAccessed: string[];
  clickCount: number;
  scrollDistance: number;
  pageViews: number;
  engagementScore: number;
}

interface LearningSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  courseId?: string;
  lessonId?: string;
  metrics: PerformanceMetrics;
  activities: LearningActivity[];
}

interface LearningActivity {
  id: string;
  type: 'lesson_start' | 'lesson_complete' | 'quiz_attempt' | 'video_play' | 'video_pause' | 'reflection_save' | 'navigation' | 'idle';
  timestamp: Date;
  data: any;
  duration?: number;
}

interface UseLearningAnalyticsOptions {
  userId?: string;
  courseId?: string;
  enabled?: boolean;
  trackingInterval?: number;
  idleThreshold?: number;
  autoSubmit?: boolean;
}

export const useLearningAnalytics = (options: UseLearningAnalyticsOptions = {}) => {
  const {
    userId = 'demo-user',
    courseId,
    enabled = true,
    trackingInterval = 30000, // 30 seconds
    idleThreshold = 300000, // 5 minutes
    autoSubmit = true
  } = options;

  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);

  // Refs for tracking
  const sessionRef = useRef<LearningSession | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const metricsRef = useRef<PerformanceMetrics>({
    sessionStart: Date.now(),
    timeSpent: 0,
    lessonsViewed: [],
    quizzesAttempted: 0,
    averageQuizScore: 0,
    videoWatchTime: 0,
    reflectionsWritten: 0,
    coursesAccessed: [],
    clickCount: 0,
    scrollDistance: 0,
    pageViews: 0,
    engagementScore: 0
  });
  const activitiesRef = useRef<LearningActivity[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Enhanced course progress for activity tracking (monitoring only)
  useEnhancedCourseProgress(courseId || 'global', {
    enableAutoSave: false,
    enableRealtime: false
  });

  // Initialize session
  const initializeSession = useCallback(() => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: LearningSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      courseId,
      metrics: { ...metricsRef.current },
      activities: []
    };

    sessionRef.current = session;
    setCurrentSession(session);
    lastActivityRef.current = Date.now();

    // Track session start
    trackActivity('lesson_start', {
      sessionId,
      courseId,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    console.log('[LearningAnalytics] Session started:', sessionId);
  }, [userId, courseId]);

  // Track learning activity
  const trackActivity = useCallback((
    type: LearningActivity['type'], 
    data: any, 
    duration?: number
  ) => {
    if (!enabled || !sessionRef.current) return;

    const activity: LearningActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
      duration
    };

    activitiesRef.current.push(activity);
    lastActivityRef.current = Date.now();
    setIsActive(true);

    // Update metrics based on activity type
    updateMetrics(type, data, duration);

    console.log('[LearningAnalytics] Activity tracked:', type, data);
  }, [enabled]);

  // Update performance metrics
  const updateMetrics = useCallback((
    type: LearningActivity['type'], 
    data: any, 
    duration?: number
  ) => {
    const metrics = metricsRef.current;
    
    switch (type) {
      case 'lesson_start':
        if (data.lessonId && !metrics.lessonsViewed.includes(data.lessonId)) {
          metrics.lessonsViewed.push(data.lessonId);
        }
        if (data.courseId && !metrics.coursesAccessed.includes(data.courseId)) {
          metrics.coursesAccessed.push(data.courseId);
        }
        metrics.pageViews++;
        break;
        
      case 'lesson_complete':
        // Completion activities are high engagement
        metrics.engagementScore += 10;
        break;
        
      case 'quiz_attempt':
        metrics.quizzesAttempted++;
        if (data.score !== undefined && data.maxScore !== undefined) {
          const currentAvg = metrics.averageQuizScore;
          const totalAttempts = metrics.quizzesAttempted;
          const newScore = (data.score / data.maxScore) * 100;
          metrics.averageQuizScore = ((currentAvg * (totalAttempts - 1)) + newScore) / totalAttempts;
        }
        metrics.engagementScore += 5;
        break;
        
      case 'video_play':
      case 'video_pause':
        if (duration) {
          metrics.videoWatchTime += duration;
          metrics.engagementScore += Math.min(duration / 1000 * 0.1, 2); // Cap engagement per video interaction
        }
        break;
        
      case 'reflection_save':
        metrics.reflectionsWritten++;
        metrics.engagementScore += 3;
        break;
        
      case 'navigation':
        metrics.clickCount++;
        if (data.scrollDistance) {
          metrics.scrollDistance += data.scrollDistance;
        }
        break;
        
      case 'idle':
        // Reduce engagement score for idle time
        if (duration && duration > idleThreshold) {
          metrics.engagementScore = Math.max(0, metrics.engagementScore - 1);
        }
        break;
    }

    // Update total time spent
    metrics.timeSpent = Date.now() - metrics.sessionStart;
    
    // Calculate engagement score based on multiple factors
    const timeScore = Math.min(metrics.timeSpent / 60000, 10); // Max 10 points for 10+ minutes
    const activityScore = Math.min(activitiesRef.current.length * 0.5, 10); // Max 10 points for 20+ activities
    const completionScore = metrics.lessonsViewed.length * 2; // 2 points per lesson viewed
    
    metrics.engagementScore = Math.round(timeScore + activityScore + completionScore);

    setPerformanceData({ ...metrics });
  }, [idleThreshold]);

  // Track user interactions
  useEffect(() => {
    if (!enabled) return;

    let scrollY = window.scrollY;

    const handleClick = () => {
      trackActivity('navigation', { type: 'click', path: window.location.pathname });
    };

    const handleScroll = () => {
      const newScrollY = window.scrollY;
      const scrollDiff = Math.abs(newScrollY - scrollY);
      
      if (scrollDiff > 100) { // Only track significant scrolls
        trackActivity('navigation', { 
          type: 'scroll', 
          scrollDistance: scrollDiff,
          path: window.location.pathname 
        });
        scrollY = newScrollY;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackActivity('idle', { reason: 'tab_hidden' });
      } else {
        trackActivity('lesson_start', { reason: 'tab_visible', path: window.location.pathname });
      }
    };

    const handleBeforeUnload = () => {
      endSession();
    };

    // Add event listeners
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, trackActivity]);

  // Idle detection
  useEffect(() => {
    if (!enabled) return;

    const checkIdle = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      if (timeSinceLastActivity > idleThreshold) {
        setIsActive(false);
        trackActivity('idle', { 
          duration: timeSinceLastActivity,
          threshold: idleThreshold 
        }, timeSinceLastActivity);
      }
    };

    intervalRef.current = setInterval(checkIdle, trackingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, trackingInterval, idleThreshold, trackActivity]);

  // Auto-submit session data
  useEffect(() => {
    if (!enabled || !autoSubmit) return;

    const submitInterval = setInterval(() => {
      if (sessionRef.current && activitiesRef.current.length > 0) {
        submitSessionData();
      }
    }, 60000); // Submit every minute

    return () => clearInterval(submitInterval);
  }, [enabled, autoSubmit]);

  // Submit session data to analytics service
  const submitSessionData = useCallback(async () => {
    if (!sessionRef.current) return;

    try {
      const sessionData = {
        ...sessionRef.current,
        endTime: new Date(),
        metrics: metricsRef.current,
        activities: activitiesRef.current.slice() // Copy activities
      };

      // Store in localStorage for now (would send to analytics service in production)
      const existingSessions = JSON.parse(localStorage.getItem('learning_sessions') || '[]');
      existingSessions.push({
        ...sessionData,
        startTime: sessionData.startTime.toISOString(),
        endTime: sessionData.endTime?.toISOString(),
        activities: sessionData.activities.map(a => ({
          ...a,
          timestamp: a.timestamp.toISOString()
        }))
      });

      // Keep only last 10 sessions
      if (existingSessions.length > 10) {
        existingSessions.splice(0, existingSessions.length - 10);
      }

      localStorage.setItem('learning_sessions', JSON.stringify(existingSessions));
      
      console.log('[LearningAnalytics] Session data submitted:', sessionData.id);
      
      // Clear submitted activities
      activitiesRef.current = [];
      
    } catch (error) {
      console.error('[LearningAnalytics] Failed to submit session data:', error);
    }
  }, []);

  // End current session
  const endSession = useCallback(() => {
    if (!sessionRef.current) return;

    trackActivity('lesson_complete', { 
      reason: 'session_end',
      finalEngagementScore: metricsRef.current.engagementScore 
    });

    submitSessionData();

    sessionRef.current.endTime = new Date();
    setCurrentSession(null);

    console.log('[LearningAnalytics] Session ended:', sessionRef.current.id);
  }, [trackActivity, submitSessionData]);

  // Public methods for lesson-specific tracking
  const trackLessonStart = useCallback((lessonId: string, lessonTitle?: string) => {
    trackActivity('lesson_start', { lessonId, lessonTitle, courseId });
  }, [trackActivity, courseId]);

  const trackLessonComplete = useCallback((lessonId: string, completionData?: any) => {
    trackActivity('lesson_complete', { lessonId, courseId, ...completionData });
  }, [trackActivity, courseId]);

  const trackQuizAttempt = useCallback((lessonId: string, quizData: any) => {
    trackActivity('quiz_attempt', { lessonId, courseId, ...quizData });
  }, [trackActivity, courseId]);

  const trackVideoInteraction = useCallback((action: 'play' | 'pause', videoData: any) => {
    trackActivity(action === 'play' ? 'video_play' : 'video_pause', {
      courseId,
      ...videoData
    }, videoData.duration);
  }, [trackActivity, courseId]);

  const trackReflectionSave = useCallback((lessonId: string, reflectionData?: any) => {
    trackActivity('reflection_save', { lessonId, courseId, ...reflectionData });
  }, [trackActivity, courseId]);

  // Get analytics summary
  const getAnalyticsSummary = useCallback(() => {
    const sessions = JSON.parse(localStorage.getItem('learning_sessions') || '[]');
    const currentSessionActivities = activitiesRef.current.length;
    
    return {
      totalSessions: sessions.length,
      currentSessionId: sessionRef.current?.id,
      currentSessionActivities,
      totalTimeSpent: sessions.reduce((total: number, session: any) => 
        total + (session.metrics?.timeSpent || 0), 0),
      averageEngagementScore: sessions.length > 0 ? 
        sessions.reduce((total: number, session: any) => 
          total + (session.metrics?.engagementScore || 0), 0) / sessions.length : 0,
      currentMetrics: performanceData
    };
  }, [performanceData]);

  // Initialize session on mount
  useEffect(() => {
    if (enabled) {
      initializeSession();
    }

    return () => {
      if (sessionRef.current) {
        endSession();
      }
    };
  }, [enabled, initializeSession, endSession]);

  return {
    // Current session data
    currentSession,
    isActive,
    performanceData,
    
    // Tracking methods
    trackLessonStart,
    trackLessonComplete,
    trackQuizAttempt,
    trackVideoInteraction,
    trackReflectionSave,
    trackActivity,
    
    // Session management
    endSession,
    submitSessionData,
    getAnalyticsSummary,
    
    // Metrics
    engagementScore: performanceData?.engagementScore || 0,
    timeSpent: performanceData?.timeSpent || 0,
    activitiesCount: activitiesRef.current.length
  };
};