import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  initializeOfflineQueue,
  subscribeOfflineQueue,
  enqueueOfflineItem,
  processOfflineQueue,
  getOfflineQueueSnapshot,
  setQueueFullHandler,
  setStorageErrorHandler,
  removeOfflineItem,
  type OfflineQueueItem,
} from '../services/offlineQueue';

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
  onSync?: (item: QueuedProgress) => Promise<boolean> | boolean;
  onSyncError?: (item: QueuedProgress, error: Error) => void;
  onQueueFull?: () => void;
}

const mapToQueuedProgress = (item: OfflineQueueItem): QueuedProgress => ({
  id: item.id,
  userId: item.userId,
  courseId: item.courseId,
  moduleId: item.moduleId ?? '',
  lessonId: item.lessonId ?? '',
  action: (item.action as QueuedProgress['action']) ?? 'progress_update',
  data: item.payload,
  timestamp: item.timestamp,
  attempts: item.attempts,
  priority: item.priority,
});

export const useOfflineProgressQueue = (options: UseOfflineQueueOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    onSync,
    onSyncError,
    onQueueFull,
  } = options;

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [queueSize, setQueueSize] = useState<number>(() => getOfflineQueueSnapshot().length);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const queueItems = useMemo(
    () => getOfflineQueueSnapshot().filter((item) => item.type === 'progress-event'),
    [queueSize],
  );

  const getSnapshot = useCallback(
    () => queueItems.map(mapToQueuedProgress),
    [queueItems],
  );

  useEffect(() => {
    void initializeOfflineQueue().then(() => {
      setQueueSize(getOfflineQueueSnapshot().length);
    });

    const unsubscribe = subscribeOfflineQueue((items) => {
      setQueueSize(items.length);
    });

    setQueueFullHandler(() => {
      toast.error('Offline storage is full. Please reconnect to sync your progress.', {
        duration: 5000,
        id: 'offline-queue-full',
      });
      onQueueFull?.();
    });

    setStorageErrorHandler((error) => {
      console.error('[OfflineQueue] Storage error encountered', error);
      toast.error('Could not save progress locally. Please refresh when back online.', {
        duration: 5000,
        id: 'offline-storage-error',
      });
    });

    return () => {
      unsubscribe();
      setQueueFullHandler(null);
      setStorageErrorHandler(null);
    };
  }, [onQueueFull]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing progress...', {
        duration: 3000,
        id: 'connection-restored',
      });
      setTimeout(() => {
        void processQueue();
      }, 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('You\'re offline. Progress will be saved locally.', {
        icon: '💾',
        duration: 4000,
        id: 'connection-lost',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToQueue = useCallback(
    (item: Omit<QueuedProgress, 'id' | 'timestamp' | 'attempts'>) => {
      const queuedItem: OfflineQueueItem = {
        id: item.id ?? `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'progress-event',
        userId: item.userId,
        courseId: item.courseId,
        moduleId: item.moduleId,
        lessonId: item.lessonId,
        action: item.action,
        payload: item.data ?? {},
        priority: item.priority ?? 'medium',
        timestamp: Date.now(),
        attempts: 0,
      };
      void enqueueOfflineItem(queuedItem);
      return queuedItem;
    },
    [],
  );

  const removeFromQueue = useCallback((id: string) => {
    void removeOfflineItem(id);
    return true;
  }, []);

  const findInQueue = useCallback(
    (predicate: (item: QueuedProgress) => boolean) => getSnapshot().find(predicate) ?? null,
    [getSnapshot],
  );

  const processQueue = useCallback(async () => {
    if (!isOnline || queueItems.length === 0 || !onSync) return;
    setIsProcessing(true);
    try {
      const result = await processOfflineQueue('progress-event', async (item) => {
        const mapped = mapToQueuedProgress(item);
        try {
          const success = await onSync(mapped);
          if (!success) {
            onSyncError?.(mapped, new Error('Sync handler returned false'));
          }
          return success;
        } catch (error) {
          onSyncError?.(mapped, error as Error);
          return false;
        }
      });

      if (result.processed > 0) {
        setLastSync(new Date());
      }

      if (result.remaining > 0 && result.nextDelayMs) {
        setTimeout(() => {
          void processQueue();
        }, Math.min(60000, result.nextDelayMs * Math.max(1, maxRetries)));
      }
    } finally {
      setIsProcessing(false);
      setQueueSize(getOfflineQueueSnapshot().length);
    }
  }, [isOnline, maxRetries, onSync, onSyncError, queueItems.length]);

  const flushQueue = useCallback(async () => {
    await processQueue();
  }, [processQueue]);

  useEffect(() => {
    if (isOnline && queueItems.length > 0) {
      void processQueue();
    }
  }, [isOnline, queueItems.length, processQueue]);

  return {
    isOnline,
    isProcessing,
    queueSize,
    lastSync,
    queue: getSnapshot(),
    addToQueue,
    removeFromQueue,
    findInQueue,
    flushQueue,
  };
};
