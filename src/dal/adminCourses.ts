import type { Course } from '../types/courseTypes';
import type { NormalizedCourse } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { CourseService, CourseValidationError } from '../services/courseService';

export { CourseValidationError };

export async function syncCourseToDatabase(course: Course): Promise<NormalizedCourse | null> {
  return CourseService.syncCourseToDatabase(course);
}

export async function getAllCoursesFromDatabase(): Promise<NormalizedCourse[]> {
  return CourseService.getAllCoursesFromDatabase();
}

export async function deleteCourseFromDatabase(courseId: string): Promise<void> {
  return CourseService.deleteCourseFromDatabase(courseId);
}

export async function loadCourseFromDatabase(
  identifier: string,
  options: { includeDrafts?: boolean } = {}
): Promise<NormalizedCourse | null> {
  return CourseService.loadCourseFromDatabase(identifier, options);
}

export async function adminCreateCourse(payload: any): Promise<any> {
  const json = await apiRequest<{ data: any }>(`/api/admin/courses`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return json.data;
}

export async function adminPublishCourse(courseId: string): Promise<void> {
  await apiRequest(`/api/admin/courses/${courseId}/publish`, { method: 'POST' });
}

export async function adminAssignCourse(courseId: string, orgId: string): Promise<void> {
  await apiRequest(`/api/admin/courses/${courseId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ organization_id: orgId })
  });
}
