import type { Course, Module, Lesson } from '../types/courseTypes';

export interface CourseValidationResult {
  isValid: boolean;
  issues: string[];
}

export const validateCourse = (course: Course): CourseValidationResult => {
  const issues: string[] = [];

  if (!course.title?.trim()) issues.push('Course title is required');
  if (!course.description?.trim()) issues.push('Course description is required');
  if (!course.modules || course.modules.length === 0) issues.push('At least one module is required');

  course.modules?.forEach((module: Module, mIndex: number) => {
    if (!module.title?.trim()) issues.push(`Module ${mIndex + 1}: Title is required`);
    if (!module.lessons || module.lessons.length === 0) {
      issues.push(`Module ${mIndex + 1}: At least one lesson is required`);
    }

    module.lessons?.forEach((lesson: Lesson, lIndex: number) => {
      if (!lesson.title?.trim()) {
        issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Title is required`);
      }

      switch (lesson.type) {
        case 'video':
          if (!lesson.content?.videoUrl?.trim()) {
            issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Video URL is required`);
          }
          break;
        case 'quiz':
          if (!lesson.content?.questions || lesson.content.questions.length === 0) {
            issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Quiz questions are required`);
          }
          break;
        case 'document':
          if (!lesson.content?.fileUrl?.trim()) {
            issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Document file is required`);
          }
          break;
        case 'text':
          if (!lesson.content?.textContent?.trim()) {
            issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Text content is required`);
          }
          break;
        default:
          break;
      }
    });
  });

  return { isValid: issues.length === 0, issues };
};
