import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../lib/secureStorage', () => ({
  __esModule: true,
  getUserSession: vi.fn(() => ({ id: 'user-1', email: 'u@example.com' })),
  getActiveOrgPreference: vi.fn(() => 'org-1'),
  secureGet: vi.fn(() => null),
  secureSet: vi.fn(() => null),
  secureRemove: vi.fn(() => null),
}));

describe('assignmentStorage backend routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls backend learner progress endpoint when updating progress', async () => {
    const apiModule = await import('../../utils/apiClient');
    const apiRequest = apiModule.default as any;
    apiRequest.mockResolvedValue({ data: [{ id: 'a1', user_id: 'user-1', course_id: 'course-1', progress: 50, status: 'in-progress' }] });

    const { updateAssignmentProgress } = await import('../../utils/assignmentStorage');
    const res = await updateAssignmentProgress('course-1', 'user-1', 50);

    expect(apiRequest).toHaveBeenCalled();
    const call = apiRequest.mock.calls[0];
    expect(String(call[0])).toContain('/api/learner/assignments/progress');
    expect(call[1]).toBeDefined();
    expect(res).toBeDefined();
    if (res) expect(res.progress).toBe(50);
  });

  it('routes admin add assignments to backend API', async () => {
    const apiModule = await import('../../utils/apiClient');
    const apiRequest = apiModule.default as any;
    apiRequest.mockResolvedValueOnce({ data: [] });
    const { legacyAddAssignments } = await import('../../utils/assignmentStorage');
    const rows = await legacyAddAssignments('course-1', ['user-a', 'user-b'], { organizationId: 'org-1' });
    expect(apiRequest).toHaveBeenCalled();
    const call = (apiRequest as any).mock.calls[0][0];
    expect(typeof call === 'string' && call.includes('/api/admin/courses/course-1/assign')).toBeTruthy();
    expect(Array.isArray(rows)).toBe(true);
  });
});
