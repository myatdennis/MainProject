import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPublishedCourses, fetchCourse } from '../clientCourses';

const apiClientMock = vi.fn();
const mapCourseRecordMock = vi.fn((record) => ({ id: record.id, title: record.title ?? 'Untitled' }));

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiClientMock(...args),
}));

vi.mock('../../lib/secureStorage', () => ({
  getUserSession: vi.fn(() => ({ id: 'test-user' })),
}));

vi.mock('../../services/courseService', async () => {
  const actual = await vi.importActual<typeof import('../../services/courseService')>('../../services/courseService');
  return {
    ...actual,
    mapCourseRecord: vi.fn((record) => mapCourseRecordMock(record)),
  };
});

describe('clientCourses DAL', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    apiClientMock.mockReset();
    mapCourseRecordMock.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  it('requires orgId when requesting assigned catalog', async () => {
    const courses = await fetchPublishedCourses({ assignedOnly: true });
    expect(courses).toEqual([]);
    expect(apiClientMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[clientCourses.fetchPublishedCourses] orgId is required when assignedOnly=true');
  });

  it('sends orgId filter for assigned catalog queries', async () => {
    apiClientMock.mockResolvedValueOnce({ data: [{ id: 'course-1', title: 'Inclusive Leadership' }] });

    const courses = await fetchPublishedCourses({ assignedOnly: true, orgId: 'org-9' });

    expect(apiClientMock).toHaveBeenCalledWith('/api/client/courses?assigned=true&orgId=org-9', { noTransform: true });
    expect(courses).toEqual([{ id: 'course-1', title: 'Inclusive Leadership' }]);
    expect(mapCourseRecordMock).toHaveBeenCalledWith({ id: 'course-1', title: 'Inclusive Leadership' });
  });

  it('fetchCourse falls back to slug when id lookup misses', async () => {
    apiClientMock
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'course-2', title: 'Belonging 101' } });

    const course = await fetchCourse('Belonging 101');

    expect(apiClientMock).toHaveBeenNthCalledWith(1, '/api/client/courses/Belonging 101', { noTransform: true });
    expect(apiClientMock).toHaveBeenNthCalledWith(2, '/api/client/courses/belonging-101', { noTransform: true });
    expect(course).toEqual({ id: 'course-2', title: 'Belonging 101' });
  });

  it('rethrows api errors so callers can handle auth/org failures', async () => {
    const apiError = new Error('Forbidden');
    apiClientMock.mockRejectedValueOnce(apiError);

    await expect(fetchCourse('restricted-course')).rejects.toBe(apiError);
    expect(errorSpy).toHaveBeenCalledWith('[clientCourses.fetchCourse] Failed to load course from API:', apiError);
  });
});
