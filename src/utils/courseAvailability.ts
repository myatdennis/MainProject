import type { CourseAssignmentStatus } from '../types/assignment';
import type { NormalizedCourse } from './courseNormalization';
import type { StoredCourseProgress } from './courseProgress';

export type CourseAvailabilityReason = 'missing' | 'unpublished' | 'no_history';

export interface CourseAvailabilityResult {
  isUnavailable: boolean;
  isReadOnly: boolean;
  reason?: CourseAvailabilityReason;
  assignmentStatus?: CourseAssignmentStatus | null;
  hasProgressHistory: boolean;
}

const courseLooksPublished = (course?: NormalizedCourse | null): boolean => {
  if (!course) return false;
  const normalizedStatus = (course.status || '').toLowerCase();
  if (normalizedStatus === 'draft' || normalizedStatus === 'archived') {
    return false;
  }
  if (typeof course.isPublished === 'boolean') {
    return course.isPublished;
  }
  if (!normalizedStatus) {
    return true;
  }
  return normalizedStatus === 'published' || normalizedStatus === 'active' || normalizedStatus === 'live';
};

export const hasStoredProgressHistory = (stored?: StoredCourseProgress | null): boolean => {
  if (!stored) return false;
  if (Array.isArray(stored.completedLessonIds) && stored.completedLessonIds.length > 0) {
    return true;
  }
  const lessonProgressValues = Object.values(stored.lessonProgress || {});
  return lessonProgressValues.some((value) => (value ?? 0) > 0);
};

interface EvaluateOptions {
  course?: NormalizedCourse | null;
  assignmentStatus?: CourseAssignmentStatus | null;
  storedProgress?: StoredCourseProgress | null;
}

export const evaluateCourseAvailability = (options: EvaluateOptions): CourseAvailabilityResult => {
  const { course, assignmentStatus, storedProgress } = options;
  const hasHistory = hasStoredProgressHistory(storedProgress);

  if (!course) {
    return {
      isUnavailable: true,
      isReadOnly: false,
      reason: 'missing',
      assignmentStatus: assignmentStatus ?? null,
      hasProgressHistory: hasHistory,
    };
  }

  const normalizedAssignmentStatus: CourseAssignmentStatus | null =
    assignmentStatus ?? course.assignmentStatus ?? null;
  const isPublished = courseLooksPublished(course);
  const hasAssignmentContext = Boolean(normalizedAssignmentStatus);

  if (!isPublished && !hasAssignmentContext && !hasHistory) {
    return {
      isUnavailable: true,
      isReadOnly: false,
      reason: 'unpublished',
      assignmentStatus: normalizedAssignmentStatus,
      hasProgressHistory: hasHistory,
    };
  }

  if (!hasAssignmentContext && !hasHistory) {
    return {
      isUnavailable: true,
      isReadOnly: false,
      reason: 'no_history',
      assignmentStatus: normalizedAssignmentStatus,
      hasProgressHistory: hasHistory,
    };
  }

  const isReadOnly =
    !isPublished || normalizedAssignmentStatus === 'completed' || (!hasAssignmentContext && hasHistory);

  return {
    isUnavailable: false,
    isReadOnly,
    reason: !isPublished ? 'unpublished' : undefined,
    assignmentStatus: normalizedAssignmentStatus,
    hasProgressHistory: hasHistory,
  };
};
