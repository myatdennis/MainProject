import type { Course, Module, Lesson } from '../types/courseTypes';

const normalizeContent = (content: any): string => {
  if (!content) return '';
  try {
    return JSON.stringify(content);
  } catch (_error) {
    return String(content);
  }
};

const compareLessons = (prev: Lesson, next: Lesson): boolean => {
  if (!prev || !next) return true;
  if (prev.title !== next.title) return true;
  if ((prev.type || 'text') !== (next.type || 'text')) return true;
  if ((prev.order ?? 0) !== (next.order ?? 0)) return true;
  if ((prev.estimatedDuration ?? 0) !== (next.estimatedDuration ?? 0)) return true;
  if (normalizeContent(prev.content) !== normalizeContent(next.content)) return true;
  if ((prev.description ?? '') !== (next.description ?? '')) return true;
  return false;
};

const compareModules = (prev: Module, next: Module): boolean => {
  if (!prev || !next) return true;
  if (prev.title !== next.title) return true;
  if ((prev.description ?? '') !== (next.description ?? '')) return true;
  if ((prev.order ?? 0) !== (next.order ?? 0)) return true;

  const prevLessons = prev.lessons || [];
  const nextLessons = next.lessons || [];

  if (prevLessons.length !== nextLessons.length) return true;

  const lessonMap = new Map(prevLessons.map((lesson) => [lesson.id, lesson]));

  for (const lesson of nextLessons) {
    const existing = lessonMap.get(lesson.id);
    if (!existing) return true;
    if (compareLessons(existing, lesson)) return true;
  }

  return false;
};

export interface CourseDiffResult {
  hasChanges: boolean;
}

export const computeCourseDiff = (previous: Course | null | undefined, next: Course): CourseDiffResult => {
  if (!previous) {
    return { hasChanges: true };
  }

  if (previous.title !== next.title) return { hasChanges: true };
  if ((previous.description ?? '') !== (next.description ?? '')) return { hasChanges: true };
  if ((previous.status ?? 'draft') !== (next.status ?? 'draft')) return { hasChanges: true };

  const prevModules = previous.modules || [];
  const nextModules = next.modules || [];

  if (prevModules.length !== nextModules.length) {
    return { hasChanges: true };
  }

  const moduleMap = new Map(prevModules.map((module) => [module.id, module]));

  for (const module of nextModules) {
    const existing = moduleMap.get(module.id);
    if (!existing) {
      return { hasChanges: true };
    }
    if (compareModules(existing, module)) {
      return { hasChanges: true };
    }
  }

  return { hasChanges: false };
};
