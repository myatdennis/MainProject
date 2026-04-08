import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import { syncService } from '../dal/sync';
import type { AssignmentKind, CourseAssignment, CourseAssignmentStatus } from '../types/assignment';
import { isSupabaseOperational, subscribeRuntimeStatus } from '../state/runtimeStatus';
import { getUserSession, secureGet, secureSet, secureRemove } from '../lib/secureStorage';
import apiRequest, { ApiError as RequestError } from './apiClient';

const STORAGE_KEY = 'huddle_course_assignments_v1';
const ASSIGNMENTS_TABLE = 'assignments';
let assignmentsTableUnavailable = false;
let assignmentsTableWarningLogged = false;
let assignmentsProgressColumnMissing = false;
let assignmentsProgressWarningLogged = false;

const isAssignmentsTableMissingError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const code = typeof (error as { code?: string })?.code === 'string' ? (error as { code?: string }).code : null;
  const messageCandidate =
    typeof (error as { message?: string })?.message === 'string'
      ? (error as { message?: string }).message
      : error instanceof Error
      ? error.message
      : '';
  const message = (messageCandidate ?? '').toLowerCase();
  if (code === 'PGRST205') {
    return true;
  }
  if (!message) return false;
  return (
    message.includes(`could not find the table 'public.${ASSIGNMENTS_TABLE}`) ||
    message.includes(`relation \"public.${ASSIGNMENTS_TABLE}`)
  );
};

const handleAssignmentsTableMissing = (context: string, error: unknown): boolean => {
  if (!isAssignmentsTableMissingError(error)) {
    return false;
  }
  assignmentsTableUnavailable = true;
  if (!assignmentsTableWarningLogged) {
    assignmentsTableWarningLogged = true;
    console.warn(
      `[assignmentStorage] Supabase table "${ASSIGNMENTS_TABLE}" is missing; disabling remote assignment sync (${context}).`,
      error,
    );
  }
  return true;
};

const isAssignmentsProgressColumnMissingError = (error: unknown): boolean => {
  if (!error) return false;
  const message = typeof (error as { message?: string })?.message === 'string' ? (error as { message?: string })?.message : '';
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("'progress' column") && normalized.includes(`'${ASSIGNMENTS_TABLE}`);
};

const handleAssignmentsProgressColumnMissing = (context: string, error: unknown): boolean => {
  if (!isAssignmentsProgressColumnMissingError(error)) {
    return false;
  }
  const wasMissing = assignmentsProgressColumnMissing;
  assignmentsProgressColumnMissing = true;
  if (!assignmentsProgressWarningLogged) {
    assignmentsProgressWarningLogged = true;
    console.warn('[assignments.schema_mismatch]', {
      context,
      column: 'progress',
      table: ASSIGNMENTS_TABLE,
      message: (error as { message?: string })?.message ?? null,
    });
  }
  return !wasMissing;
};

const supabaseReady = () => hasSupabaseConfig() || isSupabaseOperational();

const getAuthedSupabaseClient = async () => {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      return null;
    }
    return supabase;
  } catch (error) {
    console.warn('[assignmentStorage] Unable to resolve Supabase auth session:', error);
    return null;
  }
};

type SupabaseAssignmentRow = {
  id: string;
  course_id?: string | null;
  survey_id?: string | null;
  assignment_type?: AssignmentKind | null;
  user_id: string;
  organization_id?: string | null;
  status?: CourseAssignmentStatus | null;
  progress?: number | null;
  due_at?: string | null;
  due_date?: string | null;
  note?: string | null;
  assigned_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  active?: boolean | null;
};

const toAssignmentStatus = (status?: string | null): CourseAssignmentStatus => {
  if (status === 'in-progress' || status === 'completed') {
    return status;
  }
  return 'assigned';
};

const normalizeUserId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }
  return null;
};

const getSessionUserId = (): string | null => {
  try {
    const session = getUserSession();
    return session?.id ? session.id.toLowerCase() : null;
  } catch (error) {
    console.warn('[assignmentStorage] Unable to resolve authenticated session:', error);
    return null;
  }
};

const mapSupabaseAssignment = (row: SupabaseAssignmentRow): CourseAssignment => {
  const normalizedUserId = normalizeUserId(row.user_id);
  if (!normalizedUserId) {
    throw new Error('Supabase assignment row is missing user_id');
  }
  const assignmentType: AssignmentKind =
    row.assignment_type === 'survey' ? 'survey' : 'course';
  return {
    id: row.id,
    courseId: row.course_id ?? null,
    surveyId: row.survey_id ?? null,
    userId: normalizedUserId,
    organizationId: row.organization_id ?? null,
    status: toAssignmentStatus(row.status),
    progress: Number.isFinite(row.progress) ? Number(row.progress) : 0,
    dueDate: row.due_at || row.due_date || null,
    note: row.note || null,
  assignedBy: row.assigned_by || null,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
  active: typeof row.active === 'boolean' ? row.active : true,
  metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
  assignmentType,
};
};

const loadLocalAssignments = (): CourseAssignment[] => {
  try {
    const parsed = secureGet<CourseAssignment[]>(STORAGE_KEY) ?? [];
    if (!Array.isArray(parsed)) return [];
    const sanitized: CourseAssignment[] = [];
    parsed.forEach((record) => {
      const normalizedUserId = normalizeUserId(record?.userId);
      if (!normalizedUserId) {
        console.warn('[assignmentStorage] Dropping assignment with missing userId:', record);
        return;
      }
      const assignmentType: AssignmentKind =
        record.assignmentType === 'survey' ? 'survey' : 'course';
      const resolvedCourseId = record.courseId ?? (record as any)?.course_id;
      const resolvedSurveyId = record.surveyId ?? (record as any)?.survey_id;
      const sanitizedRecord: CourseAssignment = {
        ...record,
        userId: normalizedUserId,
        progress: Number.isFinite(record.progress) ? record.progress : 0,
        status: toAssignmentStatus(record.status),
        dueDate: record.dueDate ?? null,
        note: record.note ?? null,
      };
      if (resolvedCourseId !== undefined) {
        sanitizedRecord.courseId = resolvedCourseId ?? null;
      }
      if (resolvedSurveyId !== undefined) {
        sanitizedRecord.surveyId = resolvedSurveyId ?? null;
      }
      if (assignmentType === 'survey') {
        sanitizedRecord.assignmentType = 'survey';
      } else if (record.assignmentType === 'course') {
        sanitizedRecord.assignmentType = 'course';
      }
      if (record.metadata && typeof record.metadata === 'object') {
        sanitizedRecord.metadata = record.metadata as Record<string, unknown>;
      } else if (Object.prototype.hasOwnProperty.call(record, 'metadata')) {
        sanitizedRecord.metadata = null;
      }
      sanitized.push(sanitizedRecord);
    });

    if (sanitized.length !== parsed.length) {
      persistLocalAssignments(sanitized);
    }
    return sanitized;
  } catch (error) {
    console.warn('Failed to load assignments:', error);
    return [];
  }
};

const persistLocalAssignments = (records: CourseAssignment[]) => {
  secureSet(STORAGE_KEY, records);
};

const clearLocalAssignments = () => {
  secureRemove(STORAGE_KEY);
};

let inflightLocalSync: Promise<void> | null = null;

const buildSupabaseAssignmentRecord = (assignment: CourseAssignment, includeProgress: boolean) => ({
  id: assignment.id,
  course_id: assignment.courseId,
  survey_id: assignment.surveyId ?? null,
  assignment_type: assignment.assignmentType ?? 'course',
  user_id: assignment.userId,
  organization_id: assignment.organizationId ?? null,
  status: assignment.status,
  ...(includeProgress ? { progress: assignment.progress ?? 0 } : {}),
  due_at: assignment.dueDate ?? null,
  note: assignment.note ?? null,
  assigned_by: assignment.assignedBy ?? null,
  created_at: assignment.createdAt ?? new Date().toISOString(),
  updated_at: assignment.updatedAt ?? new Date().toISOString(),
  active: assignment.active ?? true,
});

const buildUpsertOptions = () =>
  (ASSIGNMENTS_TABLE as string) === 'course_assignments' ? { onConflict: 'course_id,user_id' } : undefined;

const executeAssignmentsMutation = async <T>(
  label: string,
  operation: (includeProgressField: boolean) => Promise<T>,
) => {
  try {
    return await operation(!assignmentsProgressColumnMissing);
  } catch (error) {
    if (handleAssignmentsProgressColumnMissing(label, error)) {
      return operation(false);
    }
    throw error;
  }
};

const syncLocalAssignmentsToSupabase = async () => {
  if (!supabaseReady()) {
    return;
  }

  if (inflightLocalSync) {
    return inflightLocalSync;
  }

  inflightLocalSync = (async () => {
    const pending = loadLocalAssignments();
    if (pending.length === 0) {
      inflightLocalSync = null;
      return;
    }

    try {
      const supabase = await getAuthedSupabaseClient();
      if (!supabase) {
        console.info('[assignmentStorage] Skipping Supabase sync (no authenticated session).');
        return;
      }

      const attemptSync = async (includeProgressField: boolean) => {
        const payload = pending.map((assignment) =>
          buildSupabaseAssignmentRecord(assignment, includeProgressField),
        );
        const { error } = await supabase
          .from(ASSIGNMENTS_TABLE)
          .upsert(payload, buildUpsertOptions());
        if (error) throw error;
      };

      await executeAssignmentsMutation('syncLocalAssignments', attemptSync);

      clearLocalAssignments();
    } catch (error) {
      if (handleAssignmentsTableMissing('sync', error)) {
        return;
      }
      console.warn('[assignmentStorage] Failed to sync local assignments to Supabase:', error);
    } finally {
      inflightLocalSync = null;
    }
  })();

  return inflightLocalSync;
};

if (typeof window !== 'undefined') {
  if (supabaseReady()) {
    void syncLocalAssignmentsToSupabase();
  }

  subscribeRuntimeStatus((status) => {
    if (status.supabaseConfigured && status.supabaseHealthy) {
      void syncLocalAssignmentsToSupabase();
    }
  });

  window.addEventListener('online', () => {
    if (supabaseReady()) {
      void syncLocalAssignmentsToSupabase();
    }
  });
}

const emitLocalEvent = (
  type: 'assignment_created' | 'assignment_updated' | 'assignment_deleted',
  assignment: CourseAssignment
) => {
  if (supabaseReady()) return;

  syncService.logSyncEvent({
    type,
    data: assignment,
    courseId: assignment.courseId ?? undefined,
    userId: assignment.userId,
    timestamp: Date.now(),
    source: 'client',
  });
};

const withSupabaseFallback = async <T>(
  supabaseFn: () => Promise<T>,
  localFn: () => Promise<T> | T
): Promise<T> => {
  if (assignmentsTableUnavailable) {
    return await Promise.resolve(localFn());
  }
  if (!supabaseReady()) {
    return await Promise.resolve(localFn());
  }

  try {
    return await supabaseFn();
  } catch (error) {
    console.error('[assignmentStorage] Supabase operation failed, using local fallback:', error);
    return await Promise.resolve(localFn());
  }
};

const buildLocalAssignment = (
  courseId: string,
  userId: string,
  overrides: Partial<CourseAssignment> = {}
): CourseAssignment => {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `assignment-${courseId}-${userId}-${Date.now()}`,
    courseId,
    userId,
    organizationId: overrides.organizationId ?? null,
    status: overrides.status ?? 'assigned',
    progress: overrides.progress ?? 0,
    dueDate: overrides.dueDate ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    assignedBy: overrides.assignedBy ?? null,
    active: overrides.active ?? true,
    metadata: overrides.metadata ?? null,
    assignmentType: overrides.assignmentType ?? 'course',
  };
};

export async function legacyAddAssignments(
  courseId: string,
  userIds: string[],
  options: { dueDate?: string; note?: string; assignedBy?: string; organizationId?: string | null } = {}
): Promise<CourseAssignment[]> {
  const normalizedIds = Array.from(
    new Set(
      userIds
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const now = new Date().toISOString();

  return withSupabaseFallback<CourseAssignment[]>(
    async () => {
      if (normalizedIds.length === 0) return [];

      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');

      const runUpsert = async (includeProgressField: boolean) => {
        const payload = normalizedIds.map((userId) => ({
          course_id: courseId,
          user_id: userId,
          organization_id: options.organizationId ?? null,
          assignment_type: 'course',
          metadata: null,
          status: 'assigned',
          ...(includeProgressField ? { progress: 0 } : {}),
          due_at: options.dueDate ?? null,
          note: options.note ?? null,
          assigned_by: options.assignedBy ?? null,
          created_at: now,
          updated_at: now,
        }));

        const { data, error } = await supabase
          .from(ASSIGNMENTS_TABLE)
          .upsert(payload, buildUpsertOptions())
          .select();
        if (error) throw error;
        return data;
      };

      try {
        const data = await executeAssignmentsMutation('legacyAddAssignments', runUpsert);
        return (data ?? []).map(mapSupabaseAssignment);
      } catch (error) {
        handleAssignmentsTableMissing('legacyAddAssignments', error);
        throw error;
      }
    },
    () => {
      const existing = loadLocalAssignments();
      const results: CourseAssignment[] = [];

      normalizedIds.forEach((userId) => {
        const existingIndex = existing.findIndex(
          (record) => record.courseId === courseId && record.userId === userId
        );

        const assignment = buildLocalAssignment(courseId, userId, {
          dueDate: options.dueDate ?? null,
          note: options.note ?? null,
          organizationId: options.organizationId ?? null,
        });

        if (existingIndex !== -1) {
          const merged: CourseAssignment = {
            ...existing[existingIndex],
            ...assignment,
            id: existing[existingIndex].id,
            createdAt: existing[existingIndex].createdAt,
            updatedAt: now,
          };
          existing[existingIndex] = merged;
          results.push(merged);
        } else {
          existing.push(assignment);
          results.push(assignment);
        }
      });

      persistLocalAssignments(existing);
      results.forEach((assignment) => emitLocalEvent('assignment_created', assignment));
      return results;
    }
  );
}

export { legacyAddAssignments as addAssignments };

export const mapAssignmentsFromApiRows = (rows: any[]): CourseAssignment[] => {
  return rows
    .map((row) => {
      try {
        const courseId = row.course_id ?? row.courseId;
        const userIdRaw = row.user_id ?? row.userId ?? row.user_id_uuid ?? row.userIdUuid ?? '';
        const dueDate = row.due_date ?? row.dueAt ?? row.due_at ?? null;
  const organizationId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
        return mapSupabaseAssignment({
          id: row.id,
          course_id: courseId,
          user_id: typeof userIdRaw === 'string' ? userIdRaw.toLowerCase() : '',
          status: row.status ?? 'assigned',
          progress: row.progress ?? 0,
          due_date: dueDate,
          note: row.note ?? null,
          assigned_by: row.assigned_by ?? null,
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.updated_at ?? new Date().toISOString(),
          organization_id: organizationId,
          metadata: row.metadata ?? null,
          assignment_type: row.assignment_type ?? null,
          survey_id: row.survey_id ?? row.surveyId ?? null,
        } as SupabaseAssignmentRow);
      } catch (error) {
        console.warn('[assignmentStorage] Skipping malformed assignment row from API response:', error);
        return null;
      }
    })
    .filter((row): row is CourseAssignment => Boolean(row));
};

const fetchAssignmentsViaApi = async (): Promise<{ rows: CourseAssignment[]; failed: boolean }> => {
  const sessionUserId = getSessionUserId();
  if (!sessionUserId) {
    console.info('[assignmentStorage] Cannot fetch assignments via API without an authenticated session.');
    return { rows: [], failed: true };
  }
  try {
    const params = new URLSearchParams({
      include_completed: 'true',
    });
    const response = await apiRequest<{ data?: any[] }>(`/api/client/assignments?${params.toString()}`);
    const rows = Array.isArray(response?.data) ? response.data : [];
    if (!rows.length) {
      return { rows: [], failed: false };
    }
    return { rows: mapAssignmentsFromApiRows(rows), failed: false };
  } catch (error) {
    if (error instanceof RequestError && (error.status === 401 || error.status === 403)) {
      console.warn('[assignmentStorage] Remote assignments request rejected (unauthorized).');
      return { rows: [], failed: false };
    }
    console.warn('[assignmentStorage] Failed to load assignments via API:', error);
    return { rows: [], failed: true };
  }
};

export const getAssignmentsForUser = async (userId?: string | null): Promise<CourseAssignment[]> => {
  const normalized = normalizeUserId(userId) ?? null;
  if (!normalized) {
    console.warn('[assignmentStorage] getAssignmentsForUser called without a valid user id. Returning empty assignments.');
    return [];
  }

  const sessionUserId = getSessionUserId();
  const loadLocalForUser = () => loadLocalAssignments().filter((record) => record.userId === normalized);

  if (!sessionUserId) {
    console.info('[assignmentStorage] Skipping remote assignment fetch (no authenticated session).');
    return loadLocalForUser();
  }

  if (sessionUserId !== normalized) {
    // The secureStorage session can momentarily lag behind the live React auth
    // state (e.g. right after login when setUserSession hasn't flushed yet).
    // Before assuming a genuine mismatch, check if the Supabase live session
    // confirms the requested user — if so, treat it as a match.
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const liveId = data?.session?.user?.id
          ? data.session.user.id.toLowerCase()
          : null;
        if (liveId && liveId === normalized) {
          // Live session confirms this is the correct user — proceed normally.
        } else {
          console.warn('[assignmentStorage] Requested user does not match authenticated session; using local fallback.');
          return loadLocalForUser();
        }
      } else {
        console.warn('[assignmentStorage] Requested user does not match authenticated session; using local fallback.');
        return loadLocalForUser();
      }
    } catch {
      console.warn('[assignmentStorage] Requested user does not match authenticated session; using local fallback.');
      return loadLocalForUser();
    }
  }

  const { rows, failed } = await fetchAssignmentsViaApi();
  if (!failed) {
    const filtered = rows.filter((record) => (record.assignmentType ?? 'course') === 'course');
    if (filtered.length) {
      persistLocalAssignments(filtered);
      filtered.forEach((assignment) => emitLocalEvent('assignment_updated', assignment));
    }
    return filtered.filter((record) => record.userId === normalized);
  }

  return loadLocalForUser();
};

export const getAssignment = async (
  courseId: string,
  userId: string
): Promise<CourseAssignment | undefined> => {
  const assignments = await getAssignmentsForUser(userId);
  return assignments.find((record) => record.courseId === courseId);
};

export const updateAssignmentProgress = async (
  courseId: string,
  userId: string,
  progress: number
): Promise<CourseAssignment | undefined> => {
  const normalized = userId.toLowerCase();
  const now = new Date().toISOString();
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const status: CourseAssignmentStatus =
    clampedProgress >= 100 ? 'completed' : clampedProgress > 0 ? 'in-progress' : 'assigned';

  return withSupabaseFallback<CourseAssignment | undefined>(
    async () => {
      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');

      const runUpdate = async (includeProgressField: boolean) => {
        const { data, error } = await supabase
          .from(ASSIGNMENTS_TABLE)
          .update({
            ...(includeProgressField ? { progress: clampedProgress } : {}),
            status,
            updated_at: now,
          })
          .eq('course_id', courseId)
          .eq('user_id', normalized)
          .select();
        if (error) throw error;
        return data;
      };

      try {
        const data = await executeAssignmentsMutation('updateAssignmentProgress', runUpdate);

        const record = Array.isArray(data) ? data[0] : data;
        const assignment = record ? mapSupabaseAssignment(record as SupabaseAssignmentRow) : undefined;
        return assignment;
      } catch (error) {
        if (handleAssignmentsTableMissing('updateAssignmentProgress', error)) {
          const localAssignments = loadLocalAssignments();
          const index = localAssignments.findIndex(
            (record) => record.courseId === courseId && record.userId === normalized,
          );
          if (index !== -1) {
            const updated: CourseAssignment = {
              ...localAssignments[index],
              progress: clampedProgress,
              status,
              updatedAt: now,
            };
            localAssignments[index] = updated;
            persistLocalAssignments(localAssignments);
            emitLocalEvent('assignment_updated', updated);
            return updated;
          }
          return undefined;
        }
        throw error;
      }
    },
    () => {
      const assignments = loadLocalAssignments();
      const index = assignments.findIndex(
        (record) => record.courseId === courseId && record.userId === normalized
      );

      if (index === -1) return undefined;

      const updated: CourseAssignment = {
        ...assignments[index],
        progress: clampedProgress,
        status,
        updatedAt: now,
      };

      assignments[index] = updated;
      persistLocalAssignments(assignments);
      emitLocalEvent('assignment_updated', updated);
      void syncLocalAssignmentsToSupabase();
      return updated;
    }
  );
};

export const markAssignmentComplete = async (
  courseId: string,
  userId: string
): Promise<CourseAssignment | undefined> => updateAssignmentProgress(courseId, userId, 100);
