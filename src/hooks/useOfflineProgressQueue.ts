import { useEffect, useRef, useCallback, useState } from 'react';
import toast from 'react-hot-toast';

export interface QueuedProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  moduleId: string;
  action: 'progress_update' | 'lesson_complete' | 'quiz_submit' | 'reflection_save';
  data: any;
  timestamp: number;
  attempts: number;
  priority: 'low' | 'medium' | 'high';
}

interface UseOfflineQueueOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxQueueSize?: number;
  onSync?: (item: QueuedProgress) => void;
  onSyncError?: (item: QueuedProgress, error: Error) => void;
  onQueueFull?: () => void;
}

export const useOfflineProgressQueue = (options: UseOfflineQueueOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    maxQueueSize = 100,
    onSync,
    onSyncError,
    onQueueFull
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const queueRef = useRef<QueuedProgress[]>([]);
  const processingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('offline_progress_queue');
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        queueRef.current = parsedQueue.filter((item: QueuedProgress) => {
          // Remove items older than 7 days
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return item.timestamp > sevenDaysAgo;
        });
        setQueueSize(queueRef.current.length);
        console.log(`[OfflineQueue] Loaded ${queueRef.current.length} items from storage`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue from storage:', error);
      queueRef.current = [];
    }
  }, []);

  // Save queue to localStorage whenever it changes
  const saveQueueToStorage = useCallback(() => {
    try {
      localStorage.setItem('offline_progress_queue', JSON.stringify(queueRef.current));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue to storage:', error);
    }
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing progress...', { 
        duration: 3000,
        id: 'connection-restored'
      });
      // Start processing queue when back online
      setTimeout(() => processQueue(), 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('You\'re offline. Progress will be saved locally.', { 
        icon: '💾',
        duration: 4000,
        id: 'connection-lost'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const generateQueueId = useCallback((): string => {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addToQueue = useCallback((item: Omit<QueuedProgress, 'id' | 'timestamp' | 'attempts'>) => {
    // Check queue size limit
    if (queueRef.current.length >= maxQueueSize) {
      console.warn('[OfflineQueue] Queue size limit reached');
      onQueueFull?.();
      
      // Remove oldest low priority items to make room
      queueRef.current = queueRef.current
        .filter(existing => existing.priority !== 'low')
        .slice(-(maxQueueSize - 1));
    }

    const queuedItem: QueuedProgress = {
      ...item,
      id: generateQueueId(),
      timestamp: Date.now(),
      attempts: 0
    };

    // Remove any duplicate items for the same lesson/action
    queueRef.current = queueRef.current.filter(existing => 
      !(existing.userId === item.userId && 
        existing.courseId === item.courseId && 
        existing.lessonId === item.lessonId && 
        existing.action === item.action)
    );

    // Add new item with priority sorting
    queueRef.current.push(queuedItem);
    queueRef.current.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority] || a.timestamp - b.timestamp;
    });

    setQueueSize(queueRef.current.length);
    saveQueueToStorage();

    console.log('[OfflineQueue] Added item to queue:', queuedItem.id, queuedItem.action);

    // Show appropriate toast based on online status
    if (!isOnline) {
      toast('Progress saved offline', { 
        icon: '💾',
        duration: 2000,
        id: 'offline-save'
      });
    } else {
      // If online, process immediately
      setTimeout(() => processQueue(), 500);
    }

    return queuedItem.id;
  }, [maxQueueSize, isOnline, generateQueueId, saveQueueToStorage, onQueueFull]);

  const processQueue = useCallback(async () => {
    if (!isOnline || processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    console.log(`[OfflineQueue] Processing ${queueRef.current.length} queued items`);

    const itemsToProcess = [...queueRef.current];
    const processedIds: string[] = [];
    const failedItems: QueuedProgress[] = [];

    for (const item of itemsToProcess) {
      try {
        // Simulate API call based on action type
        const success = await syncProgressItem(item);

        if (success) {
          processedIds.push(item.id);
          onSync?.(item);
          console.log('[OfflineQueue] Successfully synced:', item.id, item.action);
        } else {
          // Increment attempts and re-queue if under max retries
          if (item.attempts < maxRetries) {
            failedItems.push({
              ...item,
              attempts: item.attempts + 1
            });
          } else {
            console.error('[OfflineQueue] Max retries exceeded:', item.id);
            onSyncError?.(item, new Error('Max retries exceeded'));
          }
        }
      } catch (error) {
        console.error('[OfflineQueue] Sync error for item:', item.id, error);
        
        if (item.attempts < maxRetries) {
          failedItems.push({
            ...item,
            attempts: item.attempts + 1
          });
        } else {
          onSyncError?.(item, error as Error);
        }
      }

      // Small delay between items to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update queue by removing processed items and re-adding failed items
    queueRef.current = queueRef.current
      .filter(item => !processedIds.includes(item.id))
      .concat(failedItems);

    setQueueSize(queueRef.current.length);
    saveQueueToStorage();
    
    processingRef.current = false;
    setIsProcessing(false);
    setLastSync(new Date());

    if (processedIds.length > 0) {
      toast.success(`Synced ${processedIds.length} progress updates`, {
        duration: 3000
      });
    }

    if (failedItems.length > 0) {
      toast('Some items will retry later', {
        icon: '⚠️',
        duration: 2000
      });
      
      // Schedule retry for failed items
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, retryDelay);
    }

    console.log('[OfflineQueue] Processing complete. Remaining items:', queueRef.current.length);
  }, [isOnline, maxRetries, retryDelay, onSync, onSyncError, saveQueueToStorage]);

  const syncProgressItem = async (item: QueuedProgress): Promise<boolean> => {
    // This would normally make API calls to your backend
    // For demo purposes, we'll simulate the sync
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

      // Simulate success/failure (90% success rate)
      const success = Math.random() > 0.1;
      
      if (!success) {
        throw new Error('Simulated API error');
      }

      // In a real implementation, you would:
      switch (item.action) {
        case 'progress_update':
          // await supabase.from('user_progress').upsert(item.data);
          break;
        case 'lesson_complete':
          // await supabase.from('lesson_completions').insert(item.data);
          break;
        case 'quiz_submit':
          // await supabase.from('quiz_submissions').insert(item.data);
          break;
        case 'reflection_save':
          // await supabase.from('reflections').upsert(item.data);
          break;
      }

      return true;
    } catch (error) {
      console.error(`[OfflineQueue] Failed to sync ${item.action}:`, error);
      return false;
    }
  };

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueueSize(0);
    saveQueueToStorage();
    console.log('[OfflineQueue] Queue cleared');
  }, [saveQueueToStorage]);

  const removeItem = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter(item => item.id !== id);
    setQueueSize(queueRef.current.length);
    saveQueueToStorage();
  }, [saveQueueToStorage]);

  const getQueueStats = useCallback(() => {
    const stats = {
      total: queueRef.current.length,
      byPriority: {
        high: queueRef.current.filter(item => item.priority === 'high').length,
        medium: queueRef.current.filter(item => item.priority === 'medium').length,
        low: queueRef.current.filter(item => item.priority === 'low').length
      },
      byAction: queueRef.current.reduce((acc, item) => {
        acc[item.action] = (acc[item.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      oldestTimestamp: queueRef.current.length > 0 ? 
        Math.min(...queueRef.current.map(item => item.timestamp)) : null,
      failedItems: queueRef.current.filter(item => item.attempts > 0).length
    };
    
    return stats;
  }, []);

  // Auto-process queue when online
  useEffect(() => {
    if (isOnline && queueRef.current.length > 0) {
      const timeoutId = setTimeout(() => processQueue(), 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    addToQueue,
    processQueue,
    clearQueue,
    removeItem,
    getQueueStats,
    isOnline,
    isProcessing,
    queueSize,
    lastSync,
    queue: queueRef.current
  };
};