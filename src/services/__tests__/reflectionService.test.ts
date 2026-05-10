import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reflectionService } from '../reflectionService';

const apiRequestMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiRequestMock(...args),
}));

describe('reflectionService admin queries', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: { rows: [], total: 0 } });
  });

  it('includes organization scope when fetching lesson reflections', async () => {
    await reflectionService.fetchAdminReflections({
      orgId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-1',
      limit: 5,
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/admin/lessons/lesson-1/reflections?orgId=org-1&courseId=course-1&lessonId=lesson-1&limit=5&offset=0',
    );
  });

  it('includes organization scope when fetching course reflections', async () => {
    await reflectionService.fetchAdminCourseReflections({
      orgId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-1',
      search: 'learner',
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/admin/courses/course-1/reflections?orgId=org-1&lessonId=lesson-1&search=learner&limit=50&offset=0',
    );
  });
});
