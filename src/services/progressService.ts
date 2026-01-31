import apiRequest, { ApiError } from '../utils/apiClient';
import { NetworkErrorHandler } from '../utils/NetworkErrorHandler';
import { toast } from 'react-hot-toast';
import { getUserSession } from '../lib/secureStorage';
import {
  enqueueProgressSnapshot,
  hasPendingItems,
  processOfflineQueue,
  initializeOfflineQueue,
  type OfflineQueueItem,
} from './offlineQueue';

const getAvailability = () => ({
  enabled: true,
  message: undefined,
});

type LessonProgressRow = {
  lesson_id: string;
  progress_percentage: number | null;
  completed: boolean | null;
  time_spent: number | null;
  last_accessed_at: string | null;
};

const toInt = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const getSessionUserId = (): string | null => {
  try {
    const session = getUserSession();
    return session?.id ? session.id.toLowerCase() : null;
  } catch (error) {
    console.warn('[progressService] Unable to resolve authenticated session:', error);
    return null;
  }
};

let retryTimer: number | null = null;
let isDraining = false;
let eventRetryTimer: number | null = null;
let isDrainingEvents = false;
let serverErrorBackoffUntil: number | null = null;
const SERVER_ERROR_BACKOFF_MS = 60000;

interface ProgressSnapshot {
  userId: string;
  courseId: string;
  lessonIds: string[];
  lessons: Array<{
    lessonId: string;
    progressPercent: number;
    completed: boolean;
    positionSeconds: number;
    lastAccessedAt?: string;
  }>;
  overallPercent: number;
  completedAt?: string | null;
  totalTimeSeconds?: number | null;
  lastLessonId?: string | null;
}

const buildSnapshotPayload = ({
  userId,
  courseId,
  lessonIds,
  lessons,
  overallPercent,
  completedAt,
  totalTimeSeconds,
  lastLessonId,
}: SnapshotInput): ProgressSnapshot => ({
  userId,
  courseId,
  lessonIds,
  lessons: lessons.map((entry) => ({
    lessonId: entry.lessonId,
    progressPercent: toInt(entry.progressPercent),
    completed: entry.completed,
    positionSeconds: Math.max(0, Math.round(entry.positionSeconds ?? 0)),
    lastAccessedAt: entry.lastAccessedAt,
  })),
  overallPercent: toInt(overallPercent),
  completedAt: completedAt ?? null,
  totalTimeSeconds: typeof totalTimeSeconds === 'number' ? Math.max(0, Math.round(totalTimeSeconds)) : null,
  lastLessonId: lastLessonId ?? null,
});

const scheduleRetry = (delayMs: number = 5000) => {
  if (typeof window === 'undefined') return;
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  retryTimer = window.setTimeout(async () => {
    retryTimer = null;
    await flushPendingSnapshots();
  }, delayMs);
};

const postSnapshot = async (snapshot: ProgressSnapshot, { showFailureToast }: { showFailureToast: boolean }) => {
  try {
    await NetworkErrorHandler.handleApiCall(
      () =>
        apiRequest('/api/learner/progress', {
          method: 'POST',
          body: {
            userId: snapshot.userId,
            courseId: snapshot.courseId,
            lessonIds: snapshot.lessonIds,
            lessons: snapshot.lessons,
            course: {
              percent: snapshot.overallPercent,
              completedAt: snapshot.completedAt,
              totalTimeSeconds: snapshot.totalTimeSeconds,
              lastLessonId: snapshot.lastLessonId,
            },
          },
        }),
      {
        retryConfig: { maxAttempts: 3, delay: 800, backoffMultiplier: 2 },
        showErrorToast: false,
        errorMessage: 'Progress sync failed',
      }
    );
    serverErrorBackoffUntil = null;
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) {
      serverErrorBackoffUntil = Date.now() + SERVER_ERROR_BACKOFF_MS;
      scheduleRetry(SERVER_ERROR_BACKOFF_MS);
    }
    if (showFailureToast) {
      const message = NetworkErrorHandler.isOnline()
        ? 'We lost the connection while saving your progress. We will keep retrying automatically.'
        : 'Progress saved locally. We will sync once you are back online.';

      toast.error(message, {
        duration: 4500,
        id: 'progress-sync-error',
      });
    }

    console.error('Failed to sync progress snapshot to API:', error);
    return false;
  }
};

const flushPendingSnapshots = async () => {
  if (isDraining || typeof window === 'undefined') return;

  if (!NetworkErrorHandler.isOnline()) {
    scheduleRetry(10000);
    return;
  }

  if (serverErrorBackoffUntil && Date.now() < serverErrorBackoffUntil) {
    const delay = Math.max(serverErrorBackoffUntil - Date.now(), 5000);
    scheduleRetry(delay);
    return;
  }

  if (!hasPendingItems('progress-snapshot')) {
    return;
  }

  isDraining = true;
  try {
    await initializeOfflineQueue();
    const result = await processOfflineQueue('progress-snapshot', (item: OfflineQueueItem) =>
      postSnapshot(item.payload as unknown as ProgressSnapshot, { showFailureToast: false })
    );
    if (result.remaining > 0) {
      const delay = result.nextDelayMs ?? 10000;
      scheduleRetry(delay);
    }
  } finally {
    isDraining = false;
  }
};

const postProgressEvent = async (item: OfflineQueueItem): Promise<boolean> => {
  try {
    const payload = item.payload as any || {};

    // Ensure idempotency: include client_event_id
    if (!payload.client_event_id) {
      payload.client_event_id = item.id;
    }

    // Decide endpoint based on presence of lessonId
    const endpoint = payload.lesson_id ? '/api/client/progress/lesson' : '/api/client/progress/course';

    await NetworkErrorHandler.handleApiCall(
      () =>
        apiRequest(endpoint, {
          method: 'POST',
          body: payload,
        }),
      {
        retryConfig: { maxAttempts: 2, delay: 800, backoffMultiplier: 2 },
        showErrorToast: false,
        errorMessage: 'Progress event sync failed',
      }
    );

    return true;
  } catch (error) {
    console.warn('Failed to post progress event', item.id, error);
    return false;
  }
};

const scheduleEventRetry = (delayMs: number = 5000) => {
  if (typeof window === 'undefined') return;
  if (eventRetryTimer) {
    clearTimeout(eventRetryTimer);
  }
  eventRetryTimer = window.setTimeout(async () => {
    eventRetryTimer = null;
    await flushPendingEvents();
  }, delayMs);
};

const flushPendingEvents = async () => {
  if (isDrainingEvents || typeof window === 'undefined') return;

  if (!NetworkErrorHandler.isOnline()) {
    scheduleEventRetry(10000);
    return;
  }

  if (!hasPendingItems('progress-event')) {
    return;
  }

  isDrainingEvents = true;
  try {
    await initializeOfflineQueue();
    const result = await processOfflineQueue('progress-event', (item: OfflineQueueItem) => postProgressEvent(item));
    if (result.remaining > 0) {
      const delay = result.nextDelayMs ?? 10000;
      scheduleEventRetry(delay);
    }
  } finally {
    isDrainingEvents = false;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushPendingSnapshots();
    void flushPendingEvents();
  });

  void flushPendingSnapshots();
  void flushPendingEvents();
}

export const progressService = {
  isEnabled: (): boolean => true,
  getAvailability,

  fetchLessonProgress: async (options: {
    userId: string;
    courseId: string;
    lessonIds: string[];
  }): Promise<LessonProgressRow[]> => {
    const { userId, courseId, lessonIds } = options;
    if (!userId || !courseId || lessonIds.length === 0) {
      return [];
    }

    const sessionUserId = getSessionUserId();
    if (!sessionUserId) {
      console.info('[progressService] Skipping remote progress fetch (no authenticated session).');
      return [];
    }

    const normalizedUserId = userId.toLowerCase();
    if (sessionUserId !== normalizedUserId) {
      console.warn('[progressService] Requested user does not match authenticated session; refusing remote fetch.');
      return [];
    }

    const params = new URLSearchParams();
    params.set('courseId', courseId);
    params.set('lessonIds', lessonIds.join(','));

    try {
      const response = await NetworkErrorHandler.handleApiCall(
        () =>
          apiRequest<{ data: { lessons: LessonProgressRow[] } }>(
            `/api/learner/progress?${params.toString()}`
          ),
        {
          retryConfig: { maxAttempts: 2, delay: 600 },
          showErrorToast: false,
          errorMessage: 'Failed to load remote progress snapshot',
        }
      );

      return response?.data?.lessons ?? [];
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        console.warn('[progressService] Remote progress request rejected (unauthorized).');
        return [];
      }
      console.warn('Failed to fetch lesson progress snapshot:', error);
      return [];
    }
  },

  syncProgressSnapshot: async ({
    userId,
    courseId,
    lessonIds,
    lessons,
    overallPercent,
    completedAt,
    totalTimeSeconds,
    lastLessonId,
  }: SnapshotInput): Promise<boolean> => {
    if (!userId || !courseId) {
      return false;
    }

    await initializeOfflineQueue();
    await flushPendingSnapshots();

    const snapshot = buildSnapshotPayload({
      userId,
      courseId,
      lessonIds,
      lessons,
      overallPercent,
      completedAt,
      totalTimeSeconds,
      lastLessonId,
    });

    const success = await postSnapshot(snapshot, { showFailureToast: true });

    if (!success) {
      await enqueueProgressSnapshot(snapshot as unknown as Record<string, unknown>);
      scheduleRetry();
    } else if (hasPendingItems('progress-snapshot')) {
      scheduleRetry(2000);
    }

    return success;
  },
};

export type { LessonProgressRow };

interface SnapshotInput {
  userId: string;
  courseId: string;
  lessonIds: string[];
  lessons: Array<{
    lessonId: string;
    progressPercent: number;
    completed: boolean;
    positionSeconds?: number;
    lastAccessedAt?: string;
  }>;
  overallPercent: number;
  completedAt?: string | null;
  totalTimeSeconds?: number;
  lastLessonId?: string | null;
}
