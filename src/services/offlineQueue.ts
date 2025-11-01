import toast from 'react-hot-toast';

export type OfflineQueuePriority = 'low' | 'medium' | 'high';

export interface OfflineQueueItem {
  id: string;
  type: 'progress-event' | 'progress-snapshot';
  userId: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  action?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  attempts: number;
  priority: OfflineQueuePriority;
}

const DB_NAME = 'huddle_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue_state';
const STORE_KEY = 'items';
const LEGACY_SNAPSHOT_KEY = 'lms_progress_retry_queue_v1';
const MAX_QUEUE_SIZE = 200;

type QueueListener = (items: OfflineQueueItem[]) => void;

let queue: OfflineQueueItem[] = [];
let dbPromise: Promise<IDBDatabase> | null = null;
let initialized = false;
let initializing: Promise<void> | null = null;
const listeners = new Set<QueueListener>();
let queueFullHandler: (() => void) | null = null;
let storageErrorHandler: ((error: Error) => void) | null = null;

const openQueueDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline queue database'));
  });

  return dbPromise;
};

const readQueueFromStorage = async (): Promise<OfflineQueueItem[]> => {
  if (typeof indexedDB === 'undefined') return [];

  try {
    const db = await openQueueDb();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(STORE_KEY);

      request.onsuccess = () => {
        resolve((request.result as OfflineQueueItem[]) ?? []);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to read offline queue'));
      };
    });
  } catch (error) {
    console.error('[OfflineQueue] Failed to read IndexedDB queue:', error);
    return [];
  }
};

const writeQueueToStorage = async (snapshot: OfflineQueueItem[]): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;

  try {
    const db = await openQueueDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(snapshot, STORE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to persist offline queue'));
    });
  } catch (error) {
    console.error('[OfflineQueue] Failed to persist queue to storage:', error);
    if (storageErrorHandler) {
      storageErrorHandler(error as Error);
    }
  }
};

const migrateLegacySnapshots = (): OfflineQueueItem[] => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(LEGACY_SNAPSHOT_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];

    localStorage.removeItem(LEGACY_SNAPSHOT_KEY);

    return parsed.map((snapshot) => ({
      id: `snapshot_${snapshot.userId}_${snapshot.courseId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      type: 'progress-snapshot' as const,
      userId: snapshot.userId,
      courseId: snapshot.courseId,
      moduleId: snapshot.lastLessonId ?? undefined,
      lessonId: snapshot.lessonIds?.[0],
      action: 'course_snapshot',
      payload: snapshot,
      timestamp: snapshot.enqueuedAt ?? Date.now(),
      attempts: snapshot.attempts ?? 0,
      priority: 'medium' as const,
    }));
  } catch (error) {
    console.warn('[OfflineQueue] Failed to migrate legacy snapshots:', error);
    return [];
  }
};

const notifyChange = () => {
  const snapshot = [...queue];
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('[OfflineQueue] Listener failure', error);
    }
  });
};

const pruneQueue = () => {
  if (queue.length <= MAX_QUEUE_SIZE) return;

  // Remove oldest low-priority items first
  const lowPriority = queue.filter((item) => item.priority === 'low');
  if (lowPriority.length > 0) {
    const excess = queue.length - MAX_QUEUE_SIZE;
    const toRemove = Math.min(excess, lowPriority.length);
    const idsToRemove = new Set(lowPriority.slice(0, toRemove).map((item) => item.id));
    queue = queue.filter((item) => !idsToRemove.has(item.id));
    return;
  }

  // Fallback: trim oldest items overall
  queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
};

export const initializeOfflineQueue = async () => {
  if (initialized) return;
  if (initializing) {
    await initializing;
    return;
  }

  initializing = (async () => {
    const [stored, legacy] = await Promise.all([readQueueFromStorage(), Promise.resolve(migrateLegacySnapshots())]);
    queue = [...stored, ...legacy].sort((a, b) => a.timestamp - b.timestamp);
    pruneQueue();
    await writeQueueToStorage(queue);
    initialized = true;
    notifyChange();
  })();

  await initializing;
  initializing = null;
};

export const getOfflineQueueSnapshot = (): OfflineQueueItem[] => [...queue];

export const subscribeOfflineQueue = (listener: QueueListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setQueueFullHandler = (handler: (() => void) | null) => {
  queueFullHandler = handler;
};

export const setStorageErrorHandler = (handler: ((error: Error) => void) | null) => {
  storageErrorHandler = handler;
};

const persistQueue = async () => {
  await writeQueueToStorage(queue);
  notifyChange();
};

const enqueueInternal = async (item: OfflineQueueItem) => {
  if (queue.length >= MAX_QUEUE_SIZE) {
    pruneQueue();
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn('[OfflineQueue] queue full, dropping oldest entries');
      queue.pop();
      if (queueFullHandler) {
        queueFullHandler();
      } else {
        toast.error('Offline storage is full. Please reconnect to sync your progress.', {
          duration: 5000,
          id: 'offline-queue-full',
        });
      }
    }
  }

  queue.push(item);
  queue.sort((a, b) => {
    if (a.priority === b.priority) {
      return a.timestamp - b.timestamp;
    }
    const priorityOrder: Record<OfflineQueuePriority, number> = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  await persistQueue();
};

export const enqueueOfflineItem = async (item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'attempts'>) => {
  await initializeOfflineQueue();
  const queuedItem: OfflineQueueItem = {
    ...item,
    id: item.id ?? `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    attempts: 0,
  };
  await enqueueInternal(queuedItem);
  return queuedItem;
};

export interface ProcessResult {
  processed: number;
  remaining: number;
  nextDelayMs?: number;
}

const computeBackoff = (attempts: number = 0): number => {
  const base = 2000;
  const multiplier = Math.pow(2, attempts);
  return Math.min(60000, base * multiplier);
};

export const processOfflineQueue = async (
  type: OfflineQueueItem['type'],
  processor: (item: OfflineQueueItem) => Promise<boolean>
): Promise<ProcessResult> => {
  await initializeOfflineQueue();

  if (queue.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  let processed = 0;

  for (let index = 0; index < queue.length; ) {
    const item = queue[index];
    if (item.type !== type) {
      index += 1;
      continue;
    }

    const success = await processor(item);

    if (success) {
      queue.splice(index, 1);
      processed += 1;
      await persistQueue();
      continue;
    }

    const attempts = item.attempts + 1;
    queue[index] = { ...item, attempts };
    await persistQueue();

    return {
      processed,
      remaining: queue.filter((entry) => entry.type === type).length,
      nextDelayMs: computeBackoff(attempts),
    };
  }

  await persistQueue();
  return {
    processed,
    remaining: queue.filter((entry) => entry.type === type).length,
  };
};

export const hasPendingItems = (type?: OfflineQueueItem['type']): boolean => {
  if (type) {
    return queue.some((item) => item.type === type);
  }
  return queue.length > 0;
};

export const enqueueProgressSnapshot = async (snapshot: Record<string, unknown>) => {
  return enqueueOfflineItem({
    type: 'progress-snapshot',
    userId: String(snapshot.userId ?? ''),
    courseId: String(snapshot.courseId ?? ''),
    moduleId: snapshot.moduleId as string | undefined,
    lessonId: Array.isArray(snapshot.lessonIds) ? (snapshot.lessonIds[0] as string | undefined) : undefined,
    action: 'course_snapshot',
    payload: snapshot,
    priority: 'medium',
  });
};

export const clearOfflineQueue = async () => {
  queue = [];
  await persistQueue();
};

export const removeOfflineItem = async (id: string) => {
  await initializeOfflineQueue();
  const originalLength = queue.length;
  queue = queue.filter((item) => item.id !== id);
  if (queue.length !== originalLength) {
    await persistQueue();
  }
};
