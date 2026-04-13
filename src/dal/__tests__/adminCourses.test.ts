import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCreateCourse, adminPublishCourse } from '../adminCourses';

const apiClientMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiClientMock(...args),
}));

vi.mock('../../services/courseService', () => ({
  CourseService: {
    syncCourseToDatabase: vi.fn(),
    getAllCoursesFromDatabase: vi.fn(),
    deleteCourseFromDatabase: vi.fn(),
    loadCourseFromDatabase: vi.fn(),
  },
  CourseValidationError: class CourseValidationError extends Error {},
}));

describe('adminCourses DAL', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('accepts already-unwrapped create responses', async () => {
    apiClientMock.mockResolvedValueOnce({ id: 'course-1', title: 'Launch Readiness' });

    const created = await adminCreateCourse({ title: 'Launch Readiness' });

    expect(created).toEqual({ id: 'course-1', title: 'Launch Readiness' });
  });

  it('accepts already-unwrapped publish responses', async () => {
    apiClientMock.mockResolvedValueOnce({ id: 'course-1', status: 'published' });

    const published = await adminPublishCourse('course-1');

    expect(published).toEqual({ id: 'course-1', status: 'published' });
  });
});
