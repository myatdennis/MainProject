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

const hasMeaningfulProgress = (progress: StoredCourseProgress | null | undefined): boolean => {
  if (!progress) return false;
  if ((progress.completedLessonIds ?? []).length > 0) return true;
  if (Object.values(progress.lessonProgress ?? {}).some((value) => Number(value ?? 0) > 0)) return true;
  if (Object.values(progress.lessonPositions ?? {}).some((value) => Number(value ?? 0) > 0)) return true;
  return false;
};

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

const mergeStoredProgress = (
  existing: StoredCourseProgress,
  incoming: StoredCourseProgress,
  lessonIds: string[]
): StoredCourseProgress => {
  const lessonScope = new Set(lessonIds);
  const completed = new Set<string>();

  existing.completedLessonIds.forEach((lessonId) => {
    if (lessonScope.has(lessonId)) {
      completed.add(lessonId);
    }
  });
  incoming.completedLessonIds.forEach((lessonId) => {
    if (lessonScope.has(lessonId)) {
      completed.add(lessonId);
    }
  });

  const lessonProgress: Record<string, number> = {};
  lessonIds.forEach((lessonId) => {
    const existingValue = existing.lessonProgress[lessonId] ?? 0;
    const incomingValue = incoming.lessonProgress[lessonId] ?? 0;
    const merged = Math.max(existingValue, incomingValue);
    if (merged > 0) {
      lessonProgress[lessonId] = merged;
    }
  });

  const lessonPositions: Record<string, number> = {};
  lessonIds.forEach((lessonId) => {
    const existingPosition = existing.lessonPositions?.[lessonId] ?? 0;
    const incomingPosition = incoming.lessonPositions?.[lessonId] ?? 0;
    const merged = Math.max(existingPosition, incomingPosition);
    if (merged > 0) {
      lessonPositions[lessonId] = merged;
    }
  });

  return {
    completedLessonIds: lessonIds.filter((lessonId) => completed.has(lessonId)),
    lessonProgress,
    lessonPositions,
    lastLessonId: incoming.lastLessonId || existing.lastLessonId,
  };
};

const summarizeProgressCoverage = (progress: StoredCourseProgress, lessonIds: string[]) => {
  let completed = 0;
  let started = 0;
  lessonIds.forEach((lessonId) => {
    const value = progress.lessonProgress[lessonId] ?? 0;
    if (value > 0) {
      started += 1;
    }
    if (progress.completedLessonIds.includes(lessonId) || value >= 100) {
      completed += 1;
    }
  });
  return { started, completed };
};

const analyzeMergeDeltas = (
  existing: StoredCourseProgress,
  incoming: StoredCourseProgress,
  lessonIds: string[]
) => {
  let higherCount = 0;
  let lowerCount = 0;
  let equalCount = 0;

  lessonIds.forEach((lessonId) => {
    const current = existing.lessonProgress[lessonId] ?? 0;
    const next = incoming.lessonProgress[lessonId] ?? 0;
    if (next > current) {
      higherCount += 1;
    } else if (next < current) {
      lowerCount += 1;
    } else {
      equalCount += 1;
    }
  });

  return { higherCount, lowerCount, equalCount };
};

const deriveStoredProgressFromRemote = (
  rows: LessonProgressRow[],
  lessonIds: string[]
): StoredCourseProgress => {
  if (rows.length === 0) {
    return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
  }

  const lessonScope = new Set(lessonIds);
  const overlapCount = rows.reduce(
    (count, row) => (lessonScope.has(row.lesson_id) ? count + 1 : count),
    0,
  );

  let normalizedRows = rows;
  if (overlapCount === 0 && lessonIds.length === 1 && rows.length > 0) {
    const candidate =
      rows
        .slice()
        .sort((left, right) => {
          const leftTime = Date.parse(left.last_accessed_at ?? '') || 0;
          const rightTime = Date.parse(right.last_accessed_at ?? '') || 0;
          if (leftTime !== rightTime) return rightTime - leftTime;
          return (right.progress_percentage ?? 0) - (left.progress_percentage ?? 0);
        })[0] ?? rows[0];
    normalizedRows = [{ ...candidate, lesson_id: lessonIds[0] }];
  } else if (overlapCount === 0 && rows.length === lessonIds.length) {
    normalizedRows = rows.map((row, index) => ({ ...row, lesson_id: lessonIds[index] ?? row.lesson_id }));
  }

  const lessonProgress: Record<string, number> = {};
  const lessonPositions: Record<string, number> = {};
  const completionSet = new Set<string>();
  let latestLesson: { id: string; at: number } | null = null;

  normalizedRows.forEach((row) => {
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
    if (hasMeaningfulProgress(cached.payload)) {
      return cached.payload;
    }
    // Don't trust short-lived all-zero cache entries; fetch remote again in case
    // progress was just persisted on another route/tab.
    remoteSyncCache.delete(cacheKey);
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

    const existing = readLocalProgress(courseSlug);
    if (aggregatedRows.length === 0) {
      const existingSummary = summarizeProgressCoverage(existing, lessonIds);
      console.info('[courseProgress.sync] remote_empty_kept_local', {
        courseSlug,
        courseId,
        userId,
        lessonCount: lessonIds.length,
        localStartedLessons: existingSummary.started,
        localCompletedLessons: existingSummary.completed,
      });
      if (hasMeaningfulProgress(existing)) {
        remoteSyncCache.set(cacheKey, { timestamp: Date.now(), payload: existing });
      } else {
        remoteSyncCache.delete(cacheKey);
      }
      return existing;
    }

    const derived = deriveStoredProgressFromRemote(aggregatedRows, lessonIds);
    const merged = mergeStoredProgress(existing, derived, lessonIds);
    const delta = analyzeMergeDeltas(existing, derived, lessonIds);
    const localSummary = summarizeProgressCoverage(existing, lessonIds);
    const remoteSummary = summarizeProgressCoverage(derived, lessonIds);
    const mergedSummary = summarizeProgressCoverage(merged, lessonIds);
    const decision =
      delta.lowerCount > 0 && delta.higherCount === 0
        ? 'remote_stale_lower_merged_preserved_local'
        : delta.higherCount > 0 && delta.lowerCount === 0
          ? 'remote_newer_higher_accepted_merged'
          : delta.higherCount > 0 && delta.lowerCount > 0
            ? 'remote_mixed_merged_preserved_and_advanced'
            : 'remote_equal_merged';
    console.info('[courseProgress.sync] merge_decision', {
      decision,
      courseSlug,
      courseId,
      userId,
      lessonCount: lessonIds.length,
      remoteRows: aggregatedRows.length,
      deltas: delta,
      local: localSummary,
      remote: remoteSummary,
      merged: mergedSummary,
    });
    writeLocalProgress(courseSlug, merged);
    if (hasMeaningfulProgress(merged)) {
      remoteSyncCache.set(cacheKey, { timestamp: Date.now(), payload: merged });
    } else {
      remoteSyncCache.delete(cacheKey);
    }
    return merged;
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

  const totalLessons = course.lessons || chapterProgress.reduce((sum, ch) => sum + ch.lessonProgress.length, 0);
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
