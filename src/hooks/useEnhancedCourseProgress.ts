import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { useRealtimeSync, RealtimeEvent } from './useRealtimeSync';
import { useAutoSaveProgress } from './useAutoSaveProgress';
import { useOfflineProgressQueue } from './useOfflineProgressQueue';
import toast from 'react-hot-toast';
import type { UserLessonProgress, UserCourseEnrollment, UserReflection } from '../lib/supabase';

interface UseCourseProgressOptions {
  userId?: string;
  enableAutoSave?: boolean;
  enableRealtime?: boolean;
  autoSaveInterval?: number;
}

export const useEnhancedCourseProgress = (courseId: string, options: UseCourseProgressOptions = {}) => {
  const {
    userId = 'demo-user',
    enableAutoSave = true,
    enableRealtime = true,
    autoSaveInterval = 30000
  } = options;

  // Core state
  const [enrollmentData, setEnrollmentData] = useState<UserCourseEnrollment | null>(null);
  const [lessonProgress, setLessonProgress] = useState<{ [lessonId: string]: UserLessonProgress }>({});
  const [reflections, setReflections] = useState<{ [lessonId: string]: UserReflection }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error'>('synced');

  // Track active lesson for focused updates
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const lastUpdateRef = useRef<Date>(new Date());
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  // Initialize auto-save hook
  const autoSave = useAutoSaveProgress({
    userId,
    enabled: enableAutoSave,
    saveInterval: autoSaveInterval,
    onSaveSuccess: (data) => {
      console.log('[CourseProgress] Auto-save successful:', data);
      setSyncStatus('synced');
      pendingUpdatesRef.current.delete(`${data.courseId}_${data.lessonId}`);
    },
    onSaveError: (error, data) => {
      console.error('[CourseProgress] Auto-save failed:', error, data);
      setSyncStatus('error');
    }
  });

  // Initialize offline queue
  const offlineQueue = useOfflineProgressQueue({
    onSync: (item) => {
      console.log('[CourseProgress] Offline item synced:', item);
      toast.success(`Progress synced: ${item.action}`);
      // indicate that processing succeeded
      return true;
    },
    onSyncError: (item, error) => {
      console.error('[CourseProgress] Offline sync failed:', item, error);
      toast.error('Failed to sync some progress data');
    }
  });

  // Handle real-time events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'course_updated' && event.payload.course_id === courseId) {
      console.log('[CourseProgress] Course updated via realtime:', event.payload);
      // Reload course data
      loadProgressData();
    } else if (event.type === 'progress_sync' && event.payload.course_id === courseId) {
      console.log('[CourseProgress] Progress sync event:', event.payload);
      // Update local progress if from another device
      if (event.userId !== userId) {
        updateLessonProgressFromSync(event.payload);
      }
    }
  }, [courseId, userId]);

  // Initialize real-time sync
  const realtimeSync = useRealtimeSync({
    userId,
    enabled: enableRealtime,
    onEvent: handleRealtimeEvent,
    onError: (error) => {
      console.error('[CourseProgress] Realtime error:', error);
    }
  });

  // Load initial progress data
  const loadProgressData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we're in demo mode (Supabase not configured)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - create mock data and return immediately
        console.log('[CourseProgress] Running in demo mode');
        const demoEnrollment: UserCourseEnrollment = {
          id: `enrollment_demo_${Date.now()}`,
          user_id: userId,
          course_id: courseId,
          enrolled_at: new Date().toISOString(),
          progress_percentage: 0,
          completed_at: undefined,
          last_accessed_at: new Date().toISOString()
        };
        
        setEnrollmentData(demoEnrollment);
        setLessonProgress({});
        setReflections({});
        setLoading(false);
        return;
      }

      // Try to get current user lazily
      const supabase = await getSupabase();
      if (!supabase) {
        console.log('[CourseProgress] Supabase client unavailable despite env vars');
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || userId;

      // Load enrollment data
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('user_course_enrollments')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('course_id', courseId)
        .limit(1);

      if (enrollmentError) {
        console.error('Error loading enrollment:', enrollmentError);
        setError('Failed to load enrollment data');
        return;
      }

      if (enrollment && enrollment.length > 0) {
        setEnrollmentData(enrollment[0]);
      } else {
        // Create default enrollment for demo
        const defaultEnrollment: UserCourseEnrollment = {
          id: `enrollment_${Date.now()}`,
          user_id: currentUserId,
          course_id: courseId,
          enrolled_at: new Date().toISOString(),
          progress_percentage: 0,
          last_accessed_at: new Date().toISOString(),
          completed_at: undefined
        };
        setEnrollmentData(defaultEnrollment);
      }

      // Load lesson progress
      const { data: progress, error: progressError } = await supabase
        .from('user_lesson_progress')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('course_id', courseId);

      if (progressError) {
        console.error('Error loading progress:', progressError);
        // Continue with empty progress
      }

      if (progress) {
        const progressMap = progress.reduce((acc: any, item: any) => {
          acc[item.lesson_id] = item;
          return acc;
        }, {});
        setLessonProgress(progressMap);
      }

      // Load reflections
      const { data: reflectionData, error: reflectionError } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('course_id', courseId);

      if (reflectionError) {
        console.error('Error loading reflections:', reflectionError);
      }

      if (reflectionData) {
        const reflectionMap = reflectionData.reduce((acc: any, item: any) => {
          acc[item.lesson_id] = item;
          return acc;
        }, {});
        setReflections(reflectionMap);
      }

    } catch (err) {
      console.error('Error in loadProgressData:', err);
      setError('Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [courseId, userId]);

  // Update lesson progress with auto-save and real-time sync
  const updateLessonProgress = useCallback(async (
    lessonId: string,
    moduleId: string,
    updates: Partial<UserLessonProgress>
  ) => {
    try {
      // Check if we're in demo mode
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const currentProgress = lessonProgress[lessonId] || {};
      const defaultProgress: UserLessonProgress = {
        id: `progress_${Date.now()}`,
        user_id: userId,
        lesson_id: lessonId,
        module_id: moduleId,
        course_id: courseId,
        time_spent: 0,
        completed: false,
        progress_percentage: 0,
        last_accessed_at: new Date().toISOString(),
        status: 'in-progress',
      };
      const safeProgress = (currentProgress && typeof currentProgress === 'object' && 'id' in currentProgress)
        ? (currentProgress as Partial<UserLessonProgress>)
        : {};
      const updatedProgress: UserLessonProgress = {
        ...defaultProgress,
        ...safeProgress,
        id: safeProgress.id ?? defaultProgress.id,
        time_spent: safeProgress.time_spent ?? 0,
        completed: safeProgress.completed ?? false,
        progress_percentage: safeProgress.progress_percentage ?? 0,
        last_accessed_at: safeProgress.last_accessed_at ?? defaultProgress.last_accessed_at,
        completed_at: safeProgress.completed_at,
        status: safeProgress.status ?? (safeProgress.completed ? 'completed' : 'in-progress'),
        ...updates
      };

      // Update local state immediately
      setLessonProgress(prev => ({
        ...prev,
        [lessonId]: updatedProgress
      }));

      // If in demo mode, skip database operations
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('[CourseProgress] Demo mode - progress updated locally only');
        setSyncStatus('synced');
        return;
      }

      // Mark as pending sync
      const updateKey = `${courseId}_${lessonId}`;
      pendingUpdatesRef.current.add(updateKey);
      setSyncStatus('pending');
      lastUpdateRef.current = new Date();

      // Schedule auto-save
      if (enableAutoSave) {
        autoSave.scheduleProgressSave({
          courseId,
          lessonId,
          moduleId,
          progress: updatedProgress.progress_percentage,
          timeSpent: updatedProgress.time_spent,
          completed: updatedProgress.completed,
          lastAccessed: new Date(updatedProgress.last_accessed_at),
          quizScores: undefined, // Will be handled separately in quiz attempts
          videoProgress: updatedProgress.progress_percentage
        });
      }

      // Add to offline queue if offline
      if (!navigator.onLine) {
        offlineQueue.addToQueue({
          userId,
          courseId,
          lessonId,
          moduleId,
          action: 'progress_update',
          data: updatedProgress,
          priority: 'medium'
        });
      }

      // Broadcast to other devices if online and realtime enabled
      if (navigator.onLine && enableRealtime && realtimeSync.isConnected) {
        await realtimeSync.broadcastUpdate('progress_update', {
          course_id: courseId,
          lesson_id: lessonId,
          progress: updatedProgress.progress_percentage,
          completed: updatedProgress.completed,
          timestamp: Date.now()
        });
      }

    } catch (err) {
      console.error('Error updating lesson progress:', err);
      setError('Failed to update progress');
      setSyncStatus('error');
    }
  }, [courseId, userId, lessonProgress, enableAutoSave, enableRealtime, autoSave, offlineQueue, realtimeSync]);

  // Mark lesson as complete
  const markLessonComplete = useCallback(async (
    lessonId: string,
    moduleId: string,
    finalQuizScore?: number
  ) => {
    const completionData = {
      completed: true,
      completed_at: new Date().toISOString(),
      progress_percentage: 100,
      last_accessed_at: new Date().toISOString()
    };

    await updateLessonProgress(lessonId, moduleId, completionData);

    // Add completion event to offline queue
    offlineQueue.addToQueue({
      userId,
      courseId,
      lessonId,
      moduleId,
      action: 'lesson_complete',
      data: {
        lesson_id: lessonId,
        completed_at: completionData.completed_at,
        quiz_score: finalQuizScore
      },
      priority: 'high'
    });

    toast.success('Lesson completed!', { duration: 3000 });
  }, [updateLessonProgress, offlineQueue, userId, courseId]);

  // Save reflection
  const saveReflection = useCallback(async (
    lessonId: string,
    content: string
  ) => {
    try {
      // Check if we're in demo mode
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const reflection: UserReflection = {
        id: reflections[lessonId]?.id || `reflection_${Date.now()}`,
        user_id: userId,
        lesson_id: lessonId,
        content,
        created_at: reflections[lessonId]?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Update local state
      setReflections(prev => ({
        ...prev,
        [lessonId]: reflection
      }));

      // If in demo mode, skip database operations
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('[CourseProgress] Demo mode - reflection saved locally only');
        return;
      }

      // Add to offline queue
      offlineQueue.addToQueue({
        userId,
        courseId,
        lessonId,
        moduleId: 'reflection', // Reflections don't have modules
        action: 'reflection_save',
        data: reflection,
        priority: 'low'
      });

      toast.success('Reflection saved');
    } catch (err) {
      console.error('Error saving reflection:', err);
      toast.error('Failed to save reflection');
    }
  }, [courseId, userId, reflections, offlineQueue]);

  // Update progress from realtime sync
  const updateLessonProgressFromSync = useCallback((syncData: any) => {
    if (syncData.lesson_id && syncData.progress !== undefined) {
      setLessonProgress(prev => {
        const current = (prev[syncData.lesson_id] || {}) as import('../lib/supabase').UserLessonProgress;
        // Only update if the sync data is newer
        const syncTime = new Date(syncData.timestamp || 0);
        const currentTime = new Date(current.last_accessed_at || 0);
        if (syncTime > currentTime) {
          return {
            ...prev,
            [syncData.lesson_id]: {
              ...current,
              progress: syncData.progress,
              completed: syncData.completed || current.completed,
              last_accessed_at: syncData.timestamp || current.last_accessed_at
            }
          };
        }
        return prev;
      });
    }
  }, []);

  // Calculate course progress
  const calculateCourseProgress = useCallback(() => {
    const progressValues = Object.values(lessonProgress);
    if (progressValues.length === 0) return 0;
    
    const totalProgress = progressValues.reduce((sum, progress) => sum + progress.progress_percentage, 0);
    return Math.round(totalProgress / progressValues.length);
  }, [lessonProgress]);

  // Get completion statistics
  const getCompletionStats = useCallback(() => {
    const completedLessons = Object.values(lessonProgress).filter(p => p.completed);
    const totalLessons = Object.keys(lessonProgress).length;
    
    return {
      completed: completedLessons.length,
      total: totalLessons,
      percentage: totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0
    };
  }, [lessonProgress]);

  // Initialize data loading
  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  // Set active lesson for focused tracking
  const setActiveLessonTracking = useCallback((lessonId: string | null) => {
    setActiveLesson(lessonId);
    if (lessonId && lessonProgress[lessonId]) {
      // Update last accessed time
      updateLessonProgress(lessonId, 'module_1', {
        last_accessed_at: new Date().toISOString()
      });
    }
  }, [lessonProgress, updateLessonProgress]);

  return {
    // Core data
    enrollmentData,
    lessonProgress,
    reflections,
    loading,
    error,

    // Progress actions
    updateLessonProgress,
    markLessonComplete,
    saveReflection,
    setActiveLessonTracking,

    // Calculations
    calculateCourseProgress,
    getCompletionStats,

    // Sync status
    syncStatus,
    isOnline: offlineQueue.isOnline,
    isSaving: autoSave.isSaving,
    isProcessingQueue: offlineQueue.isProcessing,
    pendingChanges: autoSave.pendingChanges,
    queueSize: offlineQueue.queueSize,
    queuedItems: offlineQueue.queue,
    lastSaved: autoSave.lastSaved,

    // Actions
    forceSave: autoSave.forceSave,
  processQueue: offlineQueue.flushQueue,
    flushQueue: offlineQueue.flushQueue,
    loadFromStorage: autoSave.loadFromStorage,
    reloadData: loadProgressData,

    // Real-time
    isRealtimeConnected: realtimeSync.isConnected,
    reconnectRealtime: realtimeSync.connect,

    // Active lesson tracking
    activeLesson
  };
};
