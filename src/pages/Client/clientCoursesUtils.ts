import type { CourseAssignment } from '../../types/assignment';

export const shouldIncludeCourseForLearner = (
  courseId: string,
  assignmentByCourseId: Map<string, CourseAssignment>,
) => assignmentByCourseId.has(courseId);
