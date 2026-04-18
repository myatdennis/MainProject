import { afterEach, describe, expect, it, vi } from 'vitest';

const apiRequestMock = vi.fn();
const resolveActiveOrgIdMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: (...args: any[]) => apiRequestMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../../utils/orgHeaders', () => ({
  resolveActiveOrgId: () => resolveActiveOrgIdMock(),
}));

describe('CourseService admin org scoping', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('adds the active orgId to the admin courses request path', async () => {
    resolveActiveOrgIdMock.mockReturnValue('org-ctx-1');
    apiRequestMock.mockResolvedValue({ data: [] });

    const { CourseService } = await import('../courseService');
    await CourseService.getAllCoursesFromDatabase();

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/admin/courses?includeStructure=true&includeLessons=true&orgId=org-ctx-1',
      expect.objectContaining({ noTransform: true, skipAdminGateCheck: true }),
    );
  });
});
