import apiRequest from '../utils/apiClient';
import { NetworkErrorHandler } from '../utils/NetworkErrorHandler';
import { toast } from 'react-hot-toast';
import {
  enqueueProgressSnapshot,
  hasPendingItems,
  processOfflineQueue,
  initializeOfflineQueue,
  type OfflineQueueItem,
} from './offlineQueue';

const hasApiConfig = () => Boolean(import.meta.env.VITE_API_BASE_URL);

type LessonProgressRow = {
  lesson_id: string;
  progress_percentage: number | null;
  completed: boolean | null;
  time_spent: number | null;
  last_accessed_at: string | null;
};

const toInt = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let isDraining = false;

type ProgressSnapshot = ReturnType<typeof buildSnapshotPayload>;

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
          body: JSON.stringify({
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
          }),
        }),
      {
        retryConfig: { maxAttempts: 3, delay: 800, backoffMultiplier: 2 },
        showErrorToast: false,
        errorMessage: 'Progress sync failed',
      }
    );
    return true;
  } catch (error) {
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

  if (!hasPendingItems('progress-snapshot')) {
    return;
  }

  isDraining = true;
  try {
    await initializeOfflineQueue();
    const result = await processOfflineQueue('progress-snapshot', (item: OfflineQueueItem) =>
      postSnapshot(item.payload as ProgressSnapshot, { showFailureToast: false })
    );
    if (result.remaining > 0) {
      const delay = result.nextDelayMs ?? 10000;
      scheduleRetry(delay);
    }
  } finally {
    isDraining = false;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushPendingSnapshots();
  });

  void flushPendingSnapshots();
}

export const progressService = {
  isEnabled: (): boolean => hasApiConfig(),

  fetchLessonProgress: async (options: {
    userId: string;
    courseId: string;
    lessonIds: string[];
  }): Promise<LessonProgressRow[]> => {
    const { userId, courseId, lessonIds } = options;
    if (!hasApiConfig() || !userId || !courseId || lessonIds.length === 0) {
      return [];
    }

    const params = new URLSearchParams();
    params.set('courseId', courseId);
    params.set('lessonIds', lessonIds.join(','));
    params.set('userId', userId);

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
    if (!hasApiConfig() || !userId || !courseId) {
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
      await enqueueProgressSnapshot(snapshot);
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
