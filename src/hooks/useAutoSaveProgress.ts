import { useEffect, useRef, useCallback, useState } from 'react';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

interface ProgressData {
  courseId: string;
  lessonId: string;
  moduleId: string;
  progress: number;
  timeSpent: number;
  completed: boolean;
  reflection?: string;
  lastAccessed: Date;
  quizScores?: Record<string, number>;
  videoProgress?: number;
}

interface UseAutoSaveOptions {
  userId?: string;
  enabled?: boolean;
  saveInterval?: number; // milliseconds
  maxRetries?: number;
  onSaveSuccess?: (data: ProgressData) => void;
  onSaveError?: (error: Error, data: ProgressData) => void;
}

interface QueuedSave {
  id: string;
  data: ProgressData;
  timestamp: number;
  attempts: number;
}

export const useAutoSaveProgress = (options: UseAutoSaveOptions = {}) => {
  const {
    userId = 'demo-user',
    enabled = true,
    saveInterval = 30000, // 30 seconds
    maxRetries = 3,
    onSaveSuccess,
    onSaveError
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const saveQueueRef = useRef<QueuedSave[]>([]);
  const saveIntervalRef = useRef<NodeJS.Timeout>();
  const pendingDataRef = useRef<Map<string, ProgressData>>(new Map());

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process queued saves when back online
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const generateSaveId = useCallback((data: ProgressData): string => {
    return `${data.courseId}_${data.moduleId}_${data.lessonId}`;
  }, []);

  const saveToStorage = useCallback((data: ProgressData) => {
    try {
      const key = `autosave_${userId}_${generateSaveId(data)}`;
      const saveData = {
        ...data,
        lastAccessed: data.lastAccessed.toISOString()
      };
      localStorage.setItem(key, JSON.stringify(saveData));
      console.log('[AutoSave] Saved to local storage:', key);
    } catch (error) {
      console.error('[AutoSave] Failed to save to local storage:', error);
    }
  }, [userId, generateSaveId]);

  const loadFromStorage = useCallback((courseId: string, moduleId: string, lessonId: string): ProgressData | null => {
    try {
      const key = `autosave_${userId}_${courseId}_${moduleId}_${lessonId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return {
          ...data,
          lastAccessed: new Date(data.lastAccessed)
        };
      }
    } catch (error) {
      console.error('[AutoSave] Failed to load from local storage:', error);
    }
    return null;
  }, [userId]);

  const clearStoredProgress = useCallback((courseId: string, moduleId: string, lessonId: string) => {
    try {
      const key = `autosave_${userId}_${courseId}_${moduleId}_${lessonId}`;
      localStorage.removeItem(key);
      console.log('[AutoSave] Cleared stored progress:', key);
    } catch (error) {
      console.error('[AutoSave] Failed to clear stored progress:', error);
    }
  }, [userId]);

  const saveToDatabase = useCallback(async (data: ProgressData): Promise<boolean> => {
    if (!hasSupabaseConfig()) {
      console.warn('[AutoSave] Supabase not configured; skipping remote save');
      return true; // Treat as success in demo mode
    }
    const supabase = await getSupabase();
    if (!supabase) {
      console.warn('[AutoSave] Supabase client unavailable');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          course_id: data.courseId,
          module_id: data.moduleId,
          lesson_id: data.lessonId,
          progress: data.progress,
          time_spent: data.timeSpent,
          completed: data.completed,
          reflection: data.reflection,
          quiz_scores: data.quizScores,
          video_progress: data.videoProgress,
          last_accessed: data.lastAccessed.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,course_id,module_id,lesson_id'
        });

      if (error) {
        console.error('[AutoSave] Database save error:', error);
        return false;
      }

      console.log('[AutoSave] Successfully saved to database:', generateSaveId(data));
      return true;
    } catch (error) {
      console.error('[AutoSave] Database save exception:', error);
      return false;
    }
  }, [userId, generateSaveId]);

  const processQueue = useCallback(async () => {
    if (!isOnline || saveQueueRef.current.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    const queue = [...saveQueueRef.current];
    saveQueueRef.current = [];

    for (const queuedSave of queue) {
      try {
        const success = await saveToDatabase(queuedSave.data);
        
        if (success) {
          onSaveSuccess?.(queuedSave.data);
          clearStoredProgress(
            queuedSave.data.courseId,
            queuedSave.data.moduleId,
            queuedSave.data.lessonId
          );
        } else {
          // Re-queue with incremented attempts if under max retries
          if (queuedSave.attempts < maxRetries) {
            saveQueueRef.current.push({
              ...queuedSave,
              attempts: queuedSave.attempts + 1
            });
          } else {
            console.error('[AutoSave] Max retries exceeded for:', queuedSave.id);
            onSaveError?.(new Error('Max retries exceeded'), queuedSave.data);
          }
        }
      } catch (error) {
        console.error('[AutoSave] Queue processing error:', error);
        onSaveError?.(error as Error, queuedSave.data);
      }
    }

    setIsSaving(false);
    setLastSaved(new Date());
  }, [isOnline, isSaving, saveToDatabase, maxRetries, onSaveSuccess, onSaveError, clearStoredProgress]);

  const scheduleProgressSave = useCallback((data: ProgressData) => {
    if (!enabled) return;

    const saveId = generateSaveId(data);
    
    // Update pending data map
    pendingDataRef.current.set(saveId, data);
    setPendingChanges(pendingDataRef.current.size);

    // Always save to local storage immediately
    saveToStorage(data);

    // Queue for database save if online, or save locally if offline
    if (isOnline) {
      // Remove any existing queued save for this item
      saveQueueRef.current = saveQueueRef.current.filter(item => item.id !== saveId);
      
      // Add new save to queue
      saveQueueRef.current.push({
        id: saveId,
        data,
        timestamp: Date.now(),
        attempts: 0
      });
    } else {
      toast('Progress saved offline. Will sync when connection restored.', {
        icon: '💾',
        id: 'offline-save'
      });
    }
  }, [enabled, generateSaveId, saveToStorage, isOnline]);

  const forceSave = useCallback(async (data?: ProgressData): Promise<boolean> => {
    if (data) {
      scheduleProgressSave(data);
    }

    if (!isOnline) {
      toast.error('Cannot save - you are offline');
      return false;
    }

    await processQueue();
    return saveQueueRef.current.length === 0;
  }, [scheduleProgressSave, isOnline, processQueue]);

  // Auto-save interval
  useEffect(() => {
    if (!enabled || !isOnline) return;

    saveIntervalRef.current = setInterval(() => {
      if (pendingDataRef.current.size > 0) {
        processQueue();
      }
    }, saveInterval);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [enabled, isOnline, saveInterval, processQueue]);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && saveQueueRef.current.length > 0) {
      processQueue();
    }
  }, [isOnline, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  return {
    scheduleProgressSave,
    forceSave,
    loadFromStorage,
    clearStoredProgress,
    isSaving,
    isOnline,
    lastSaved,
    pendingChanges,
    queueLength: saveQueueRef.current.length
  };
};
