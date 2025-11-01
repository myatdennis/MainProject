import type { NormalizedCourse } from './courseNormalization';
import type { StoredCourseProgress } from './courseProgress';

const collectLessons = (course: NormalizedCourse) => {
  return (course.modules || []).flatMap((module) => module.lessons || []);
};

export const getFirstLessonId = (course: NormalizedCourse): string | null => {
  const lessons = collectLessons(course);
  return lessons.length > 0 ? lessons[0].id : null;
};

export const getPreferredLessonId = (
  course: NormalizedCourse,
  storedProgress?: StoredCourseProgress | null
): string | null => {
  const lessons = collectLessons(course);
  if (lessons.length === 0) {
    return null;
  }

  if (!storedProgress) {
    return lessons[0].id;
  }

  const completed = new Set(storedProgress.completedLessonIds || []);
  const lastLessonId = storedProgress.lastLessonId;

  if (lastLessonId) {
    const lastIndex = lessons.findIndex((lesson) => lesson.id === lastLessonId);
    if (lastIndex !== -1) {
      if (!completed.has(lastLessonId)) {
        return lastLessonId;
      }

      const nextIncomplete = lessons.slice(lastIndex + 1).find((lesson) => !completed.has(lesson.id));
      if (nextIncomplete) {
        return nextIncomplete.id;
      }
    }
  }

  const firstIncomplete = lessons.find((lesson) => !completed.has(lesson.id));
  if (firstIncomplete) {
    return firstIncomplete.id;
  }

  return lessons[lessons.length - 1].id;
};
