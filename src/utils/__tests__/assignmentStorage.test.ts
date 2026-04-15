import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CourseAssignment } from '../../types/assignment';

const mockApiRequest = vi.fn();
const mockGetUserSession = vi.fn();
const secureStore = new Map<string, unknown>();
const secureGetMock = vi.fn((key: string) => (secureStore.has(key) ? secureStore.get(key) : null));
const secureSetMock = vi.fn((key: string, value: unknown) => {
  secureStore.set(key, value);
});
const secureRemoveMock = vi.fn((key: string) => {
  secureStore.delete(key);
});

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
  secureGet: secureGetMock,
  secureSet: secureSetMock,
  secureRemove: secureRemoveMock,
}));

const mockGetSupabase = vi.fn(async () => null);

vi.mock('../../lib/supabaseClient', () => ({
  getSupabase: mockGetSupabase,
  hasSupabaseConfig: () => false,
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
    secureStore.clear();
    secureGetMock.mockClear();
    secureSetMock.mockClear();
    secureRemoveMock.mockClear();
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
        surveyId: null,
        userId: 'user-123',
        organizationId: null,
        status: 'assigned',
        progress: 0,
        dueDate: null,
        note: null,
        assignedBy: null,
        assignmentType: 'course',
        metadata: null,
        createdAt: now,
        updatedAt: now,
        active: true,
      },
    ] satisfies CourseAssignment[]);
  });

  it('returns mapped assignments when apiRequest already unwraps the envelope', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });

    const now = new Date().toISOString();
    mockApiRequest.mockResolvedValue([
      {
        id: 'assign-2',
        course_id: 'course-2',
        user_id: 'user-123',
        status: 'assigned',
        progress: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-2',
        courseId: 'course-2',
        userId: 'user-123',
        assignmentType: 'course',
      }),
    ]);
  });

  it('maps UUID-backed assignment rows that only expose user_id_uuid', async () => {
    const now = new Date().toISOString();

    const { mapAssignmentsFromApiRows } = await importModule();
    const result = mapAssignmentsFromApiRows([
      {
        id: 'assign-survey-1',
        survey_id: 'survey-1',
        assignment_type: 'survey',
        user_id_uuid: '00000000-0000-0000-0000-000000000123',
        status: 'assigned',
        progress: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-survey-1',
        surveyId: 'survey-1',
        userId: '00000000-0000-0000-0000-000000000123',
        assignmentType: 'survey',
      }),
    ]);
  });

  it('maps legacy org_id assignment rows without dropping organization scope', async () => {
    const now = new Date().toISOString();

    const { mapAssignmentsFromApiRows } = await importModule();
    const result = mapAssignmentsFromApiRows([
      {
        id: 'assign-survey-2',
        survey_id: 'survey-2',
        assignment_type: 'survey',
        user_id: 'user-456',
        org_id: 'legacy-org-1',
        status: 'assigned',
        progress: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-survey-2',
        surveyId: 'survey-2',
        userId: 'user-456',
        organizationId: 'legacy-org-1',
        assignmentType: 'survey',
      }),
    ]);
  });

  it('treats unauthorized errors from the API as empty responses', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockApiRequest.mockRejectedValue(new MockApiError(401));

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(result).toEqual([]);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('falls back to local assignments when API request fails', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockApiRequest.mockRejectedValue(new Error('network down'));

    const cachedAssignment: CourseAssignment = {
      id: 'assign-1',
      courseId: 'course-1',
      userId: 'user-123',
      organizationId: null,
      status: 'assigned',
      progress: 0,
      dueDate: null,
      note: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedBy: null,
      active: true,
    };
    secureStore.set('huddle_course_assignments_v1', [cachedAssignment]);

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('user-123');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual([cachedAssignment]);
  });

  it('fetches remote assignments when the requested user is email-based but the session is id-based', async () => {
    mockGetUserSession.mockReturnValue({ id: 'user-123' });
    mockGetSupabase.mockResolvedValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: { id: 'user-123', email: 'learner@example.com' },
            },
          },
        })),
      },
    } as any);

    const now = new Date().toISOString();
    mockApiRequest.mockResolvedValue({
      data: [
        {
          id: 'assign-1',
          course_id: 'course-1',
          user_id: 'user-123',
          status: 'assigned',
          progress: 0,
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser('learner@example.com');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-1',
        courseId: 'course-1',
        userId: 'user-123',
      }),
    ]);
  });
});
