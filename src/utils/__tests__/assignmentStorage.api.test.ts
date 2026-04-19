import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../utils/apiClient', () => ({
  default: vi.fn(async () => ({ data: [] })),
}));

import apiRequest from '../../utils/apiClient';
import { legacyAddAssignments } from '../assignmentStorage';

describe('assignmentStorage backend routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes admin add assignments to backend API', async () => {
    (apiRequest as any).mockResolvedValueOnce({ data: [] });
    const rows = await legacyAddAssignments('course-1', ['user-a', 'user-b'], { organizationId: 'org-1' });
    expect(apiRequest).toHaveBeenCalled();
    const call = (apiRequest as any).mock.calls[0][0];
    expect(typeof call === 'string' && call.includes('/api/admin/courses/course-1/assign')).toBeTruthy();
    expect(Array.isArray(rows)).toBe(true);
  });
});
