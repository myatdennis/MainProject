import type { Course } from '../types/courseTypes';
import type { NormalizedCourse } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { CourseService, CourseValidationError } from '../services/courseService';
import type { IdempotentAction } from '../utils/idempotency';

export { CourseValidationError };

export async function syncCourseToDatabase(
  course: Course,
  options: { idempotencyKey?: string; action?: IdempotentAction } = {},
): Promise<NormalizedCourse | null> {
  return CourseService.syncCourseToDatabase(course, options);
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
    body: payload
  });
  return json.data;
}

export interface PublishCourseOptions {
  version?: number | null;
  idempotencyKey?: string;
  clientEventId?: string;
}

export async function adminPublishCourse(courseId: string, options: PublishCourseOptions = {}): Promise<any> {
  const body: Record<string, unknown> = {};
  if (typeof options.version === 'number') {
    body.version = options.version;
  }
  if (options.idempotencyKey) {
    body.idempotency_key = options.idempotencyKey;
  } else if (options.clientEventId) {
    body.client_event_id = options.clientEventId;
  }

  const response = await apiRequest<{ data: any }>(`/api/admin/courses/${courseId}/publish`, {
    method: 'POST',
    body: Object.keys(body).length > 0 ? body : undefined,
  });

  return response.data;
}

export interface AdminAssignCoursePayload {
  organizationId: string;
  userIds?: string[];
  dueAt?: string | null;
  note?: string | null;
  assignedBy?: string | null;
  idempotencyKey?: string;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}

export async function adminAssignCourse(
  courseId: string,
  payload: AdminAssignCoursePayload
): Promise<any> {
  if (!payload?.organizationId) {
    throw new CourseValidationError('adminAssignCourse', ['organizationId is required to assign a course']);
  }

  const response = await apiRequest<{ data: any }>(`/api/admin/courses/${courseId}/assign`, {
    method: 'POST',
    body: payload,
  });

  return response.data;
}
