// DAL facade for course operations. UI should import from here instead of services.
// This module wraps and re-exports safe functions/types from the underlying service.
import { CourseService, CourseValidationError } from '../services/courseService';
export { CourseValidationError };
// Contract
// - syncCourseToDatabase: Upserts full course graph and returns refreshed normalized snapshot
// - getAllCoursesFromDatabase: Admin list of all courses (any status)
// - deleteCourseFromDatabase: Hard delete by id
// - loadCourseFromDatabase: Fetch by id/slug with optional drafts
// - getPublishedCourses: Client-facing catalog
export async function syncCourseToDatabase(course) {
    return CourseService.syncCourseToDatabase(course);
}
export async function getAllCoursesFromDatabase() {
    return CourseService.getAllCoursesFromDatabase();
}
export async function deleteCourseFromDatabase(courseId) {
    return CourseService.deleteCourseFromDatabase(courseId);
}
export async function loadCourseFromDatabase(identifier, options = {}) {
    return CourseService.loadCourseFromDatabase(identifier, options);
}
export async function getPublishedCourses() {
    return CourseService.getPublishedCourses();
}
import { request } from './http';
export async function listPublishedCourses() {
    const json = await request('/api/client/courses', { noTransform: true });
    return (json.data || []);
}
export async function getCourse(identifier) {
    const json = await request(`/api/client/courses/${identifier}`, { noTransform: true });
    return (json.data || null);
}
export async function adminCreateCourse(payload) {
    const json = await request(`/api/admin/courses`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return json.data;
}
export async function adminPublishCourse(courseId) {
    await request(`/api/admin/courses/${courseId}/publish`, { method: 'POST' });
}
export async function adminAssignCourse(courseId, orgId) {
    await request(`/api/admin/courses/${courseId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: orgId }),
    });
}
