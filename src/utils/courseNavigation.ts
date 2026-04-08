import type { NormalizedCourse } from './courseNormalization';
import type { StoredCourseProgress } from './courseProgress';

const toNumericOrder = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const getOrderedModules = (course: NormalizedCourse) => {
  return [...(course.modules || [])].sort((left, right) => {
    const leftOrder = toNumericOrder((left as any)?.order_index, toNumericOrder(left.order, 0));
    const rightOrder = toNumericOrder((right as any)?.order_index, toNumericOrder(right.order, 0));
    return leftOrder - rightOrder;
  });
};

const getOrderedLessons = (module: NormalizedCourse['modules'][number]) => {
  return [...(module.lessons || [])].sort((left, right) => {
    const leftOrder = toNumericOrder(left.order_index, toNumericOrder(left.order, 0));
    const rightOrder = toNumericOrder(right.order_index, toNumericOrder(right.order, 0));
    return leftOrder - rightOrder;
  });
};

const collectLessons = (course: NormalizedCourse) => {
  return getOrderedModules(course).flatMap((module) => getOrderedLessons(module));
};

const sanitizeProgress = (
  lessonIds: Set<string>,
  storedProgress?: StoredCourseProgress | null,
) => {
  const completed = new Set(
    (storedProgress?.completedLessonIds || []).filter((lessonId) => lessonIds.has(lessonId)),
  );
  const lastLessonId =
    storedProgress?.lastLessonId && lessonIds.has(storedProgress.lastLessonId)
      ? storedProgress.lastLessonId
      : undefined;

  return {
    completed,
    lastLessonId,
  };
};

export const getInitialLesson = (
  course: NormalizedCourse,
  storedProgress?: StoredCourseProgress | null,
) => {
  const lessons = collectLessons(course);
  if (lessons.length === 0) {
    return null;
  }

  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const { completed, lastLessonId } = sanitizeProgress(lessonIds, storedProgress);

  if (!storedProgress) {
    return lessons[0];
  }

  if (lastLessonId) {
    const lastLesson = lessons.find((lesson) => lesson.id === lastLessonId);
    if (lastLesson && !completed.has(lastLessonId)) {
      return lastLesson;
    }

    const lastIndex = lessons.findIndex((lesson) => lesson.id === lastLessonId);
    if (lastIndex !== -1) {
      const nextIncomplete = lessons.slice(lastIndex + 1).find((lesson) => !completed.has(lesson.id));
      if (nextIncomplete) {
        return nextIncomplete;
      }
    }
  }

  const firstIncomplete = lessons.find((lesson) => !completed.has(lesson.id));
  if (firstIncomplete) {
    return firstIncomplete;
  }

  return lessons[0];
};

export const getNextLesson = (
  currentLesson: { id: string } | string | null | undefined,
  course: NormalizedCourse,
) => {
  const lessons = collectLessons(course);
  if (lessons.length === 0 || !currentLesson) {
    return null;
  }

  const currentLessonId = typeof currentLesson === 'string' ? currentLesson : currentLesson.id;
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLessonId);
  if (currentIndex === -1 || currentIndex >= lessons.length - 1) {
    return null;
  }

  return lessons[currentIndex + 1];
};

export const getPreviousLesson = (
  currentLesson: { id: string } | string | null | undefined,
  course: NormalizedCourse,
) => {
  const lessons = collectLessons(course);
  if (lessons.length === 0 || !currentLesson) {
    return null;
  }

  const currentLessonId = typeof currentLesson === 'string' ? currentLesson : currentLesson.id;
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLessonId);
  if (currentIndex <= 0) {
    return null;
  }

  return lessons[currentIndex - 1];
};

export const isLessonIdInCourse = (course: NormalizedCourse, lessonId?: string | null): boolean => {
  if (!lessonId) return false;
  return collectLessons(course).some((lesson) => lesson.id === lessonId);
};

export const getFirstLessonId = (course: NormalizedCourse): string | null => {
  return getInitialLesson(course, null)?.id ?? null;
};

export const getPreferredLessonId = (
  course: NormalizedCourse,
  storedProgress?: StoredCourseProgress | null
): string | null => {
  return getInitialLesson(course, storedProgress)?.id ?? null;
};
