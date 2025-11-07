import { getSupabase, hasSupabaseConfig } from '../lib/supabase';
import { syncService } from '../dal/sync';
import type { CourseAssignment, CourseAssignmentStatus } from '../types/assignment';

const STORAGE_KEY = 'huddle_course_assignments_v1';
const SUPABASE_READY = hasSupabaseConfig;

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

const mapSupabaseAssignment = (row: SupabaseAssignmentRow): CourseAssignment => ({
  id: row.id,
  courseId: row.course_id,
  userId: row.user_id.toLowerCase(),
  status: toAssignmentStatus(row.status),
  progress: Number.isFinite(row.progress) ? Number(row.progress) : 0,
  dueDate: row.due_date || null,
  note: row.note || null,
  assignedBy: row.assigned_by || null,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
});

const loadLocalAssignments = (): CourseAssignment[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CourseAssignment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((record) => ({
      ...record,
      userId: record.userId.toLowerCase(),
      progress: Number.isFinite(record.progress) ? record.progress : 0,
      status: toAssignmentStatus(record.status),
      dueDate: record.dueDate ?? null,
      note: record.note ?? null,
    }));
  } catch (error) {
    console.warn('Failed to load assignments:', error);
    return [];
  }
};

const persistLocalAssignments = (records: CourseAssignment[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const emitLocalEvent = (
  type: 'assignment_created' | 'assignment_updated' | 'assignment_deleted',
  assignment: CourseAssignment
) => {
  if (SUPABASE_READY) return;

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
  if (!SUPABASE_READY) {
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

export const getAssignmentsForUser = async (userId: string): Promise<CourseAssignment[]> => {
  const normalized = userId.toLowerCase();

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
      // Prefer server-side assignments in demo/dev mode over localStorage
      try {
        const params = new URLSearchParams({ user_id: normalized });
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/client/assignments?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const rows = Array.isArray(json?.data) ? json.data : [];
          return rows.map((row: any) => mapSupabaseAssignment({
            id: row.id,
            course_id: row.course_id,
            user_id: (row.user_id || '').toLowerCase(),
            status: row.status ?? 'assigned',
            progress: row.progress ?? 0,
            due_date: row.due_at ?? row.due_date ?? null,
            note: row.note ?? null,
            assigned_by: row.assigned_by ?? null,
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
          } as any));
        }
      } catch (e) {
        // fall back to local if server unavailable
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
      return updated;
    }
  );
};

export const markAssignmentComplete = async (
  courseId: string,
  userId: string
): Promise<CourseAssignment | undefined> => updateAssignmentProgress(courseId, userId, 100);
