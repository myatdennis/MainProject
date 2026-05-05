import { describe, it, expect, vi, beforeEach } from 'vitest';

const CANONICAL_UUID = '11111111-1111-1111-1111-111111111111';

const mockApiRequest = vi.fn();
const mockGetUserSession = vi.fn();
const secureStore = new Map<string, unknown>();
const secureGetMock = vi.fn((key: string) => (secureStore.has(key) ? secureStore.get(key) : null));
const secureSetMock = vi.fn((key: string, value: unknown) => secureStore.set(key, value));
const secureRemoveMock = vi.fn((key: string) => secureStore.delete(key));

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
  getActiveOrgPreference: () => 'org-1',
  secureGet: secureGetMock,
  secureSet: secureSetMock,
  secureRemove: secureRemoveMock,
}));

const mockSupabaseGetSession = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockSupabaseGetSession,
    },
  }),
}));

vi.mock('../../dal/sync', () => ({
  syncService: {
    logSyncEvent: vi.fn(),
  },
}));

const importModule = async () => {
  const m = await import('../assignmentStorage');
  return m;
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
    mockSupabaseGetSession.mockReset();
    mockSupabaseGetSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.clear();
  });

  it('skips remote fetch when no authenticated session exists', async () => {
    mockGetUserSession.mockReturnValue(null);

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('refuses to query remote assignments when requested user differs from session', async () => {
    mockGetUserSession.mockReturnValue({ id: 'another-user' });

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(result).toEqual([]);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('returns mapped assignments when session matches and API succeeds', async () => {
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });

    const now = new Date().toISOString();
    const apiAssignments = [
      {
        id: 'assign-1',
        course_id: 'course-1',
        user_id: CANONICAL_UUID,
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
    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith('/api/learner/assignments?include_completed=true');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-1',
        courseId: 'course-1',
        userId: CANONICAL_UUID,
        status: 'assigned',
        progress: 0,
        assignmentType: 'course',
        active: true,
      }),
    ]);
  });

  it('returns mapped assignments when apiRequest already unwraps the envelope', async () => {
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });

    const now = new Date().toISOString();
    mockApiRequest.mockResolvedValue([
      {
        id: 'assign-2',
        course_id: 'course-2',
        user_id: CANONICAL_UUID,
        status: 'assigned',
        progress: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-2',
        userId: CANONICAL_UUID,
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
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });
    mockApiRequest.mockRejectedValue(new MockApiError(401));

    const { getAssignmentsForUser } = await importModule();
    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(result).toEqual([]);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('reports unauthorized assignment reads as unauthenticated in outcome mode', async () => {
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });
    mockApiRequest.mockRejectedValue(new MockApiError(401));

    const { getAssignmentsForUserWithOutcome } = await importModule();
    const result = await getAssignmentsForUserWithOutcome(CANONICAL_UUID);

    expect(result).toEqual({
      outcome: 'unauthenticated',
      assignments: [],
      error: 'auth_session_unavailable',
    });
  });

  it('falls back to local assignments when API request fails', async () => {
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });
    mockApiRequest.mockRejectedValue(new Error('network down'));

    const { getAssignmentsForUser } = await importModule();

    const cachedAssignment = {
      id: 'assign-1',
      courseId: 'course-1',
      userId: CANONICAL_UUID,
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

    const result = await getAssignmentsForUser(CANONICAL_UUID);

    expect(mockApiRequest).toHaveBeenCalled();
    expect(result).toEqual([cachedAssignment]);
  });

  it('fetches remote assignments when the requested user is email-based but the session is id-based', async () => {
    mockGetUserSession.mockReturnValue({ id: CANONICAL_UUID });
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: { user: { id: CANONICAL_UUID, email: 'learner@example.com' } } },
      error: null,
    });

    const now = new Date().toISOString();
    mockApiRequest.mockResolvedValue({
      data: [
        {
          id: 'assign-1',
          course_id: 'course-1',
          user_id: CANONICAL_UUID,
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
        userId: CANONICAL_UUID,
      }),
    ]);
  });
});
