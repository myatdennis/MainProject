import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import { syncService } from '../dal/sync';
import type { CourseAssignment, CourseAssignmentStatus } from '../types/assignment';
import { isSupabaseOperational, subscribeRuntimeStatus } from '../state/runtimeStatus';

const STORAGE_KEY = 'huddle_course_assignments_v1';

const supabaseReady = () => hasSupabaseConfig || isSupabaseOperational();

type SupabaseAssignmentRow = {
  id: string;
  course_id: string;
  user_id: string;
  status?: CourseAssignmentStatus | null;
  progress?: number | null;
  due_date?: string | null;
  note?: string | null;
  assigned_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

const mapSupabaseAssignment = (row: SupabaseAssignmentRow): CourseAssignment => {
  const normalizedUserId = normalizeUserId(row.user_id);
  if (!normalizedUserId) {
    throw new Error('Supabase assignment row is missing user_id');
  }
  return {
    id: row.id,
    courseId: row.course_id,
    userId: normalizedUserId,
    status: toAssignmentStatus(row.status),
    progress: Number.isFinite(row.progress) ? Number(row.progress) : 0,
    dueDate: row.due_date || null,
    note: row.note || null,
    assignedBy: row.assigned_by || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
};

const loadLocalAssignments = (): CourseAssignment[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CourseAssignment[];
    if (!Array.isArray(parsed)) return [];
    const sanitized: CourseAssignment[] = [];
    parsed.forEach((record) => {
      const normalizedUserId = normalizeUserId(record?.userId);
      if (!normalizedUserId) {
        console.warn('[assignmentStorage] Dropping assignment with missing userId:', record);
        return;
      }
      sanitized.push({
        ...record,
        userId: normalizedUserId,
        progress: Number.isFinite(record.progress) ? record.progress : 0,
        status: toAssignmentStatus(record.status),
        dueDate: record.dueDate ?? null,
        note: record.note ?? null,
      });
    });

    if (sanitized.length !== parsed.length) {
      try {
        persistLocalAssignments(sanitized);
      } catch (error) {
        console.warn('[assignmentStorage] Failed to rewrite sanitized assignments:', error);
      }
    }
    return sanitized;
  } catch (error) {
    console.warn('Failed to load assignments:', error);
    return [];
  }
};

const persistLocalAssignments = (records: CourseAssignment[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const clearLocalAssignments = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

let inflightLocalSync: Promise<void> | null = null;

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
      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');

      const payload = pending.map((assignment) => ({
        id: assignment.id,
        course_id: assignment.courseId,
        user_id: assignment.userId,
        status: assignment.status,
        progress: assignment.progress ?? 0,
        due_date: assignment.dueDate ?? null,
        note: assignment.note ?? null,
        assigned_by: assignment.assignedBy ?? null,
        created_at: assignment.createdAt ?? new Date().toISOString(),
        updated_at: assignment.updatedAt ?? new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('course_assignments')
        .upsert(payload, { onConflict: 'course_id,user_id' });

      if (error) {
        throw new Error(error.message);
      }

      clearLocalAssignments();
    } catch (error) {
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
    courseId: assignment.courseId,
    userId: assignment.userId,
    timestamp: Date.now(),
    source: 'client',
  });
};

const withSupabaseFallback = async <T>(
  supabaseFn: () => Promise<T>,
  localFn: () => Promise<T> | T
): Promise<T> => {
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
    status: overrides.status ?? 'assigned',
    progress: overrides.progress ?? 0,
    dueDate: overrides.dueDate ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    assignedBy: overrides.assignedBy ?? null,
  };
};

export const addAssignments = async (
  courseId: string,
  userIds: string[],
  options: { dueDate?: string; note?: string; assignedBy?: string } = {}
): Promise<CourseAssignment[]> => {
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

      const payload = normalizedIds.map((userId) => ({
        course_id: courseId,
        user_id: userId,
        status: 'assigned',
        progress: 0,
        due_date: options.dueDate ?? null,
        note: options.note ?? null,
        assigned_by: options.assignedBy ?? null,
        created_at: now,
        updated_at: now,
      }));

      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');
      const { data, error } = await supabase
        .from('course_assignments')
        .upsert(payload, { onConflict: 'course_id,user_id' })
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map(mapSupabaseAssignment);
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
};

const buildAssignmentsFromApiRows = (rows: any[]): CourseAssignment[] => {
  return rows
    .map((row) => {
      try {
        return mapSupabaseAssignment({
          id: row.id,
          course_id: row.course_id,
          user_id: (row.user_id || '').toLowerCase(),
          status: row.status ?? 'assigned',
          progress: row.progress ?? 0,
          due_date: row.due_date ?? row.due_at ?? null,
          note: row.note ?? null,
          assigned_by: row.assigned_by ?? null,
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.updated_at ?? new Date().toISOString(),
        } as SupabaseAssignmentRow);
      } catch (error) {
        console.warn('[assignmentStorage] Skipping malformed assignment row from API response:', error);
        return null;
      }
    })
    .filter((row): row is CourseAssignment => Boolean(row));
};

const fetchAssignmentsFromApi = async (userId: string): Promise<CourseAssignment[]> => {
  if (typeof fetch === 'undefined') return [];
  try {
    const params = new URLSearchParams({ user_id: userId });
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const url = `${base}${base ? '' : ''}/api/client/assignments?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[assignmentStorage] Assignments API responded with', res.status, body || res.statusText);
      return [];
    }
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json?.data) ? json.data : [];
    return buildAssignmentsFromApiRows(rows);
  } catch (error) {
    console.warn('[assignmentStorage] Failed to fetch assignments via API:', error);
    return [];
  }
};

export const getAssignmentsForUser = async (userId?: string | null): Promise<CourseAssignment[]> => {
  const normalized = normalizeUserId(userId) ?? null;
  if (!normalized) {
    console.warn('[assignmentStorage] getAssignmentsForUser called without a valid user id. Returning empty assignments.');
    return [];
  }

  return withSupabaseFallback<CourseAssignment[]>(
    async () => {
      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');
      const { data, error } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('user_id', normalized)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map(mapSupabaseAssignment);
    },
    async () => {
      const apiAssignments = await fetchAssignmentsFromApi(normalized);
      if (apiAssignments.length > 0) {
        return apiAssignments;
      }
      return loadLocalAssignments().filter((record) => record.userId === normalized);
    }
  );
};

export const getAssignment = async (
  courseId: string,
  userId: string
): Promise<CourseAssignment | undefined> => {
  const normalized = userId.toLowerCase();

  return withSupabaseFallback<CourseAssignment | undefined>(
    async () => {
      const supabase = await getSupabase();
      if (!supabase) throw new Error('Supabase unavailable');
      const { data, error } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', normalized);

      if (error) {
        throw new Error(error.message);
      }

      const record = Array.isArray(data) ? data[0] : data;
      return record ? mapSupabaseAssignment(record as SupabaseAssignmentRow) : undefined;
    },
    () => loadLocalAssignments().find(
      (record) => record.courseId === courseId && record.userId === normalized
    )
  );
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
      const { data, error } = await supabase
        .from('course_assignments')
        .update({
          progress: clampedProgress,
          status,
          updated_at: now,
        })
        .eq('course_id', courseId)
        .eq('user_id', normalized)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      const record = Array.isArray(data) ? data[0] : data;
      const assignment = record ? mapSupabaseAssignment(record as SupabaseAssignmentRow) : undefined;
      return assignment;
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
