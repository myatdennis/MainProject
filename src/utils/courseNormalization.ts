import type { Course, Module, Lesson, Chapter } from '../types/courseTypes.js';

export interface NormalizedLesson extends Lesson {
  moduleId: string;
  moduleTitle?: string;
  moduleOrder: number;
  absoluteOrder: number;
}

export interface NormalizedCourse extends Course {
  slug: string;
  modules: Module[];
  chapters: Chapter[];
  lessons: number;
}

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export const parseDurationToMinutes = (duration?: string | number | null): number | undefined => {
  if (duration === null || duration === undefined) return undefined;
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return duration >= 0 ? Math.round(duration) : undefined;
  }

  const normalized = String(duration).toLowerCase();
  const hourMatch = normalized.match(/(\d+)\s*h/);
  const minuteMatch = normalized.match(/(\d+)\s*m/);
  const plainMinutes = normalized.match(/(\d+)\s*min/);

  let total = 0;

  if (hourMatch) {
    total += parseInt(hourMatch[1], 10) * 60;
  }

  if (minuteMatch) {
    total += parseInt(minuteMatch[1], 10);
  } else if (!hourMatch && plainMinutes) {
    total += parseInt(plainMinutes[1], 10);
  }

  if (total === 0) {
    const numeric = parseInt(normalized, 10);
    if (!Number.isNaN(numeric) && numeric >= 0) {
      total = numeric;
    }
  }

  return total > 0 ? total : undefined;
};

export const formatMinutes = (minutes?: number): string | undefined => {
  if (!minutes || minutes <= 0) return undefined;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

import { migrateLessonContent } from './contentMigrator.js';

const normalizeLessons = (module: Module, _courseId: string, _moduleIndex: number): Lesson[] => {
  const lessons = module.lessons || [];

  return lessons
    .map((lesson: Lesson, lessonIndex: number) => {
      const estimatedMinutes =
        lesson.estimatedDuration ?? parseDurationToMinutes(lesson.duration);

  const contentJson = migrateLessonContent((lesson as any).content_json ?? lesson.content ?? {});

      return {
        ...lesson,
        chapterId: lesson.chapterId || module.id,
        order: lesson.order ?? lessonIndex + 1,
        estimatedDuration: estimatedMinutes,
        duration: lesson.duration || formatMinutes(estimatedMinutes),
        content: contentJson,
        content_json: contentJson,
        resources: lesson.resources || [],
        description: lesson.description || ''
      };
    })
    .sort((a: Lesson, b: Lesson) => (a.order ?? 0) - (b.order ?? 0));
};

const normalizeModules = (course: Course): Module[] => {
  const modules = course.modules || [];

  return modules
    .map((module: Module, index: number) => {
      const lessons = normalizeLessons(module, course.id, index);
      const moduleMinutes = lessons.reduce((sum: number, lesson: Lesson) => {
        return sum + (lesson.estimatedDuration ?? 0);
      }, 0);

      return {
        ...module,
        order: module.order ?? index + 1,
        lessons,
        duration: module.duration || formatMinutes(moduleMinutes) || '',
        resources: module.resources || []
      };
    })
    .sort((a: Module, b: Module) => (a.order ?? 0) - (b.order ?? 0));
};

const buildChaptersFromModules = (course: Course, modules: Module[]): Chapter[] => {
  return modules.map((module: Module, index: number) => {
    const lessons = module.lessons || [];
    const chapterMinutes = lessons.reduce((sum: number, lesson: Lesson) => {
      return sum + (lesson.estimatedDuration ?? 0);
    }, 0);

    return {
      id: module.id,
      courseId: course.id,
      title: module.title,
      description: module.description || '',
      order: module.order ?? index + 1,
      estimatedDuration: chapterMinutes,
      lessons
    };
  });
};

const computeCourseLessonCount = (modules: Module[]): number => {
  return modules.reduce((count: number, module: Module) => count + (module.lessons?.length ?? 0), 0);
};

const computeCourseDuration = (modules: Module[], fallback?: string): string => {
  const totalMinutes = modules.reduce((sum: number, module: Module) => {
    const moduleMinutes = (module.lessons || []).reduce((moduleSum: number, lesson: Lesson) => {
      return moduleSum + (lesson.estimatedDuration ?? 0);
    }, 0);
    return sum + moduleMinutes;
  }, 0);

  return fallback || formatMinutes(totalMinutes) || '0 min';
};

export const normalizeCourse = (course: Course): NormalizedCourse => {
  const slugSource = course.slug && course.slug.trim().length > 0
    ? course.slug
    : course.title && course.title.trim().length > 0
      ? course.title
      : course.id || 'course';

  const slug = slugify(slugSource);

  const modules = normalizeModules(course);
  const chapters = buildChaptersFromModules(course, modules);

  const normalizedCourse: NormalizedCourse = {
    ...course,
    slug,
    modules,
    chapters,
    lessons: computeCourseLessonCount(modules),
    duration: course.duration || computeCourseDuration(modules, course.duration),
    estimatedDuration:
      course.estimatedDuration ??
      modules.reduce((sum: number, module: Module) => {
        const moduleMinutes = (module.lessons || []).reduce((lessonSum: number, lesson: Lesson) => {
          return lessonSum + (lesson.estimatedDuration ?? 0);
        }, 0);
        return sum + moduleMinutes;
      }, 0)
  };

  return normalizedCourse;
};

export const flattenLessons = (course: NormalizedCourse): NormalizedLesson[] => {
  const lessons: NormalizedLesson[] = [];

  course.modules.forEach((module: Module, moduleIndex: number) => {
    (module.lessons || []).forEach((lesson: Lesson) => {
      lessons.push({
        ...lesson,
        moduleId: module.id,
        moduleTitle: module.title,
        moduleOrder: module.order ?? moduleIndex + 1,
        absoluteOrder: lessons.length + 1
      });
    });
  });

  return lessons;
};
