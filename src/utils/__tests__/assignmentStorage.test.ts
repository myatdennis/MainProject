import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CourseAssignment } from '../../types/assignment';

const mockApiRequest = vi.fn();
const mockGetUserSession = vi.fn();

class MockApiError extends Error {
  status?: number;
  constructor(status?: number) {
    super('api error');
    this.status = status;
  }
}

vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: mockApiRequest,
  ApiError: MockApiError,
}));

vi.mock('../../lib/secureStorage', () => ({
  getUserSession: mockGetUserSession,
}));

vi.mock('../../lib/supabaseClient', () => ({
  getSupabase: vi.fn(async () => null),
  hasSupabaseConfig: false,
}));

vi.mock('../../dal/sync', () => ({
  syncService: {
    logSyncEvent: vi.fn(),
  },
}));

vi.mock('../../state/runtimeStatus', () => ({
  isSupabaseOperational: vi.fn(() => false),
  subscribeRuntimeStatus: vi.fn(() => () => {}),
}));

const importModule = async () => {
  const module = await import('../assignmentStorage');
  return module;
};

describe('assignmentStorage session enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    mockApiRequest.mockReset();
    mockGetUserSession.mockReset();
    localStorage.clear();
  });

  it('skips remote fetch when no authenticated session exists', async () => {
    mockGetUserSession.mockReturnValue(null);

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('refuses to query remote assignments when requested user differs from session', async () => {
    mockGetUserSession.mockReturnValue({ id: 'another-user' });

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('returns mapped assignments when session matches and API succeeds', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });

    const now = new Date().toISOString();
    const apiAssignments = [
      {
        id: 'assign-1',
        course_id: 'course-1',
        user_id: 'user-123',
        status: 'assigned',
        progress: 0,
        due_date: null,
        note: null,
        assigned_by: null,
        created_at: now,
        updated_at: now,
      },
    ];

    mockApiRequest.mockResolvedValue({ data: apiAssignments });

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: 'assign-1',
        courseId: 'course-1',
        userId: 'user-123',
        status: 'assigned',
        progress: 0,
        dueDate: null,
        note: null,
        assignedBy: null,
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies CourseAssignment[]);
  });

  it('treats unauthorized errors from the API as empty responses', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockApiRequest.mockRejectedValue(new MockApiError(401));

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(result).toEqual([]);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
});
