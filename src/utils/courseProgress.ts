import type { LearnerProgress, ChapterProgress, LessonProgress } from '../types/courseTypes';
import type { NormalizedCourse } from './courseNormalization';
import { progressService, type LessonProgressRow } from '../dal/progress';

export type StoredCourseProgress = {
  completedLessonIds: string[];
  lessonProgress: Record<string, number>;
  lessonPositions?: Record<string, number>;
  lastLessonId?: string;
};

export const PROGRESS_STORAGE_KEY = 'lms_course_progress_v1';
const REMOTE_SYNC_CACHE_TTL_MS = 45_000;
const MAX_CONCURRENT_REMOTE_SYNCS = 2;
const MAX_LESSON_IDS_PER_REQUEST = 25;

type RemoteSyncCacheEntry = {
  timestamp: number;
  payload: StoredCourseProgress | null;
};

const remoteSyncCache = new Map<string, RemoteSyncCacheEntry>();

const readLocalProgress = (courseSlug: string): StoredCourseProgress => {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    }
    const parsed = JSON.parse(raw) as Record<string, StoredCourseProgress>;
    const entry = parsed[courseSlug];
    if (!entry) {
      return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    }
    return {
      completedLessonIds: Array.isArray(entry.completedLessonIds) ? entry.completedLessonIds : [],
      lessonProgress: entry.lessonProgress || {},
      lessonPositions: entry.lessonPositions || {},
      lastLessonId: entry.lastLessonId
    };
  } catch (error) {
    console.warn('Failed to load stored course progress:', error);
    return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
  }
};

const writeLocalProgress = (courseSlug: string, data: StoredCourseProgress) => {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StoredCourseProgress>) : {};
    parsed[courseSlug] = data;
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn('Failed to persist course progress:', error);
  }
};

const deriveStoredProgressFromRemote = (
  rows: LessonProgressRow[],
  lessonIds: string[]
): StoredCourseProgress => {
  if (rows.length === 0) {
    return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
  }

  const lessonProgress: Record<string, number> = {};
  const lessonPositions: Record<string, number> = {};
  const completionSet = new Set<string>();
  let latestLesson: { id: string; at: number } | null = null;

  rows.forEach((row) => {
    const progress = typeof row.progress_percentage === 'number' ? row.progress_percentage : 0;
    lessonProgress[row.lesson_id] = progress;
    lessonPositions[row.lesson_id] = row.time_spent ?? 0;

    if (row.completed || progress >= 100) {
      completionSet.add(row.lesson_id);
    }

    if (row.last_accessed_at) {
      const timestamp = Date.parse(row.last_accessed_at);
      if (!Number.isNaN(timestamp)) {
        if (!latestLesson || timestamp > latestLesson.at) {
          latestLesson = { id: row.lesson_id, at: timestamp };
        }
      }
    }
  });

  const orderedLessons = lessonIds.filter((id) => completionSet.has(id));

  return {
    completedLessonIds: orderedLessons,
    lessonProgress,
    lessonPositions,
    lastLessonId: (latestLesson as any)?.id ?? undefined,
  };
};

const chunkLessonIds = (lessonIds: string[]): string[][] => {
  if (lessonIds.length <= MAX_LESSON_IDS_PER_REQUEST) {
    return [lessonIds];
  }
  const chunks: string[][] = [];
  for (let i = 0; i < lessonIds.length; i += MAX_LESSON_IDS_PER_REQUEST) {
    chunks.push(lessonIds.slice(i, i + MAX_LESSON_IDS_PER_REQUEST));
  }
  return chunks;
};

// Limit concurrent remote syncs so we don't flood the API and trigger 429s when
// multiple courses request progress snapshots simultaneously.
const createConcurrencyLimiter = () => {
  let active = 0;
  const waiters: Array<() => void> = [];
  const release = () => {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) {
      active++;
      next();
    }
  };
  return async () => {
    if (active < MAX_CONCURRENT_REMOTE_SYNCS) {
      active++;
      return release;
    }
    return new Promise<() => void>((resolve) => {
      waiters.push(() => resolve(release));
    });
  };
};

const acquireRemoteSyncSlot = createConcurrencyLimiter();

export const loadStoredCourseProgress = (courseSlug?: string): StoredCourseProgress => {
  if (!courseSlug) return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
  return readLocalProgress(courseSlug);
};

export const syncCourseProgressWithRemote = async (options: {
  courseSlug: string;
  courseId: string;
  userId?: string;
  lessonIds: string[];
}): Promise<StoredCourseProgress | null> => {
  const { courseSlug, courseId, userId, lessonIds } = options;
  if (!progressService.isEnabled() || !courseId || lessonIds.length === 0) {
    return null;
  }

  const cacheKey = `${userId}:${courseId}`;
  const cached = remoteSyncCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < REMOTE_SYNC_CACHE_TTL_MS) {
    return cached.payload;
  }

  const release = await acquireRemoteSyncSlot();
  try {
    const aggregatedRows: LessonProgressRow[] = [];
    for (const chunk of chunkLessonIds(lessonIds)) {
      const rows = await progressService.fetchLessonProgress({ userId, courseId, lessonIds: chunk });
      aggregatedRows.push(...rows);
      if (chunk.length >= MAX_LESSON_IDS_PER_REQUEST) {
        // Small delay prevents hammering Supabase with large requests in succession
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const derived = deriveStoredProgressFromRemote(aggregatedRows, lessonIds);
    writeLocalProgress(courseSlug, derived);
    remoteSyncCache.set(cacheKey, { timestamp: Date.now(), payload: derived });
    return derived;
  } finally {
    release();
  }
};

export const saveStoredCourseProgress = (
  courseSlug: string,
  data: StoredCourseProgress,
  options?: { courseId?: string; userId?: string; lessonIds?: string[] }
) => {
  writeLocalProgress(courseSlug, data);

  if (
    !options?.courseId ||
    !options?.userId ||
    !options?.lessonIds ||
    options.lessonIds.length === 0 ||
    !progressService.isEnabled() ||
    !isRemoteSyncAvailable()
  ) {
    return;
  }

  const lessonProgressPayload = options.lessonIds.map((lessonId) => {
    const progressValue = data.lessonProgress[lessonId] ?? (data.completedLessonIds.includes(lessonId) ? 100 : 0);
    return {
      lessonId,
      progressPercent: progressValue,
      completed: data.completedLessonIds.includes(lessonId) || progressValue >= 100,
      positionSeconds: data.lessonPositions?.[lessonId] ?? 0,
    };
  });

  const completedCount = lessonProgressPayload.filter((entry) => entry.completed).length;
  const overallProgress =
    options.lessonIds.length > 0 ? (completedCount / options.lessonIds.length) * 100 : 0;
  const completedAt = overallProgress >= 100 ? new Date().toISOString() : null;

  const totalTimeSeconds = Object.values(data.lessonPositions ?? {}).reduce(
    (sum, value) => sum + Math.max(0, Math.round(value ?? 0)),
    0
  );

  const lessonRowsToPersist = lessonProgressPayload.filter(
    (entry) => entry.progressPercent > 0 || entry.positionSeconds > 0 || entry.completed
  );

  void progressService
    .syncProgressSnapshot({
      userId: options.userId,
      courseId: options.courseId,
      lessonIds: options.lessonIds,
      lessons: lessonRowsToPersist,
      overallPercent: overallProgress,
      completedAt,
      totalTimeSeconds,
      lastLessonId: data.lastLessonId ?? null,
    })
    .then((success) => {
      if (!success) {
        console.warn('Progress sync deferred; data will be retried automatically when connectivity returns.');
      }
    });
};

export const buildLearnerProgressSnapshot = (
  course: NormalizedCourse,
  completedLessons: Set<string>,
  lessonProgress: Record<string, number>,
  lessonPositions: Record<string, number> = {}
): LearnerProgress => {
  const chapterProgress: ChapterProgress[] = course.chapters.map((chapter) => {
    const lessonEntries = chapter.lessons || [];
    const lessonProgressEntries: LessonProgress[] = lessonEntries.map((lesson) => {
      const progressValue = lessonProgress[lesson.id] ?? (completedLessons.has(lesson.id) ? 100 : 0);
      const isCompleted = completedLessons.has(lesson.id);
      return {
        lessonId: lesson.id,
        status: isCompleted ? 'completed' : progressValue > 0 ? 'in-progress' : 'not-started',
        progress: progressValue,
        progressPercent: progressValue,
        isCompleted,
        timeSpent: lessonPositions[lesson.id] ?? 0,
        lastAccessedAt: new Date().toISOString()
      };
    });

    const completedCount = lessonProgressEntries.filter((lp) => lp.isCompleted).length;
    const chapterCompletion = lessonEntries.length > 0 ? (completedCount / lessonEntries.length) * 100 : 0;

    return {
      chapterId: chapter.id,
      progress: Math.round(chapterCompletion),
      timeSpent: 0,
      lessonProgress: lessonProgressEntries
    };
  });

  const totalLessons = course.lessons || 0;
  const overallCompletion = totalLessons > 0 ? completedLessons.size / totalLessons : 0;

  return {
    id: `local-${course.id}`,
    learnerId: 'local-user',
    courseId: course.id,
    enrolledAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    overallProgress: overallCompletion,
    timeSpent: 0,
    chapterProgress,
    lessonProgress: chapterProgress.flatMap((chapter) => chapter.lessonProgress),
    bookmarks: [],
    notes: []
  };
};
const isRemoteSyncAvailable = () => {
  const envSource =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL);
  return Boolean(envSource && String(envSource).trim().length > 0);
};
