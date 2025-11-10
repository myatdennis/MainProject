import { progressService } from '../services/progressService';
export const PROGRESS_STORAGE_KEY = 'lms_course_progress_v1';
const readLocalProgress = (courseSlug) => {
    try {
        const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        if (!raw) {
            return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
        }
        const parsed = JSON.parse(raw);
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
    }
    catch (error) {
        console.warn('Failed to load stored course progress:', error);
        return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    }
};
const writeLocalProgress = (courseSlug, data) => {
    try {
        const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[courseSlug] = data;
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(parsed));
    }
    catch (error) {
        console.warn('Failed to persist course progress:', error);
    }
};
const deriveStoredProgressFromRemote = (rows, lessonIds) => {
    if (rows.length === 0) {
        return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    }
    const lessonProgress = {};
    const lessonPositions = {};
    const completionSet = new Set();
    let latestLesson = null;
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
        lastLessonId: latestLesson?.id ?? undefined,
    };
};
export const loadStoredCourseProgress = (courseSlug) => {
    if (!courseSlug)
        return { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    return readLocalProgress(courseSlug);
};
export const syncCourseProgressWithRemote = async (options) => {
    const { courseSlug, courseId, userId, lessonIds } = options;
    if (!progressService.isEnabled() || !userId || !courseId || lessonIds.length === 0) {
        return null;
    }
    const rows = await progressService.fetchLessonProgress({ userId, courseId, lessonIds });
    const derived = deriveStoredProgressFromRemote(rows, lessonIds);
    writeLocalProgress(courseSlug, derived);
    return derived;
};
export const saveStoredCourseProgress = (courseSlug, data, options) => {
    writeLocalProgress(courseSlug, data);
    if (!options?.courseId ||
        !options?.userId ||
        !options?.lessonIds ||
        options.lessonIds.length === 0 ||
        !progressService.isEnabled()) {
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
    const overallProgress = options.lessonIds.length > 0 ? (completedCount / options.lessonIds.length) * 100 : 0;
    const completedAt = overallProgress >= 100 ? new Date().toISOString() : null;
    const totalTimeSeconds = Object.values(data.lessonPositions ?? {}).reduce((sum, value) => sum + Math.max(0, Math.round(value ?? 0)), 0);
    const lessonRowsToPersist = lessonProgressPayload.filter((entry) => entry.progressPercent > 0 || entry.positionSeconds > 0 || entry.completed);
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
export const buildLearnerProgressSnapshot = (course, completedLessons, lessonProgress, lessonPositions = {}) => {
    const chapterProgress = course.chapters.map((chapter) => {
        const lessonEntries = chapter.lessons || [];
        const lessonProgressEntries = lessonEntries.map((lesson) => {
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
