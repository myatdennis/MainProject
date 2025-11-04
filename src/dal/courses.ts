// DAL facade for course operations. UI should import from here instead of services.
// This module wraps and re-exports safe functions/types from the underlying service.

import type { Course } from '../types/courseTypes';
import type { NormalizedCourse as NormalizedCourseModel } from '../utils/courseNormalization';
import { CourseService, CourseValidationError } from '../services/courseService';

export { CourseValidationError };

// Contract
// - syncCourseToDatabase: Upserts full course graph and returns refreshed normalized snapshot
// - getAllCoursesFromDatabase: Admin list of all courses (any status)
// - deleteCourseFromDatabase: Hard delete by id
// - loadCourseFromDatabase: Fetch by id/slug with optional drafts
// - getPublishedCourses: Client-facing catalog

export async function syncCourseToDatabase(course: Course): Promise<NormalizedCourseModel | null> {
  return CourseService.syncCourseToDatabase(course);
}

export async function getAllCoursesFromDatabase(): Promise<NormalizedCourseModel[]> {
  return CourseService.getAllCoursesFromDatabase();
}

export async function deleteCourseFromDatabase(courseId: string): Promise<void> {
  return CourseService.deleteCourseFromDatabase(courseId);
}

export async function loadCourseFromDatabase(
  identifier: string,
  options: { includeDrafts?: boolean } = {},
): Promise<NormalizedCourseModel | null> {
  return CourseService.loadCourseFromDatabase(identifier, options);
}

export async function getPublishedCourses(): Promise<NormalizedCourseModel[]> {
  return CourseService.getPublishedCourses();
}
import type { NormalizedCourse } from '../utils/courseNormalization';
import { request } from './http';

export type CourseListResponse = { data: any[] };
export type CourseResponse = { data: any };

export async function listPublishedCourses(): Promise<NormalizedCourse[]> {
  const json = await request<CourseListResponse>('/api/client/courses', { noTransform: true });
  return (json.data || []) as unknown as NormalizedCourse[];
}

export async function getCourse(identifier: string): Promise<NormalizedCourse | null> {
  const json = await request<CourseResponse>(`/api/client/courses/${identifier}`, { noTransform: true });
  return (json.data || null) as unknown as NormalizedCourse | null;
}

export async function adminCreateCourse(payload: any): Promise<any> {
  const json = await request<{ data: any }>(`/api/admin/courses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function adminPublishCourse(courseId: string): Promise<void> {
  await request(`/api/admin/courses/${courseId}/publish`, { method: 'POST' });
}

export async function adminAssignCourse(courseId: string, orgId: string): Promise<void> {
  await request(`/api/admin/courses/${courseId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ organization_id: orgId }),
  });
}
