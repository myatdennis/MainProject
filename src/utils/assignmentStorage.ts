import apiRequest, { ApiError } from '../utils/apiClient';
import { getUserSession, secureGet } from '../lib/secureStorage';
import { buildScopedApiUrl } from '../lib/orgContext';
import { getSupabase } from '../lib/supabaseClient';

// In-flight dedupe cache for identical assignment reads
const IN_FLIGHT = new Map<string, Promise<any>>();

const inFlightKeyForUrl = (url: string) => url;

const bytesOf = (s: string) => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  // Fallback for older Node environments (approximate)
  return Buffer.byteLength(s, 'utf8');
};

const pruneRecordsToFit = (records: any[], capBytes: number) => {
  if (!Array.isArray(records)) return [];
  if (bytesOf(JSON.stringify(records)) <= capBytes) return records;
  // Simple heuristic: remove from the end until it fits.
  const copy = records.slice();
  while (copy.length > 0 && bytesOf(JSON.stringify(copy)) > capBytes) {
    copy.pop();
  }
  return copy;
};


export const __assignmentStorageInternals = {
  IN_FLIGHT,
  inFlightKeyForUrl,
  bytesOf,
  pruneRecordsToFit,
};

export async function updateAssignmentProgress(courseId: string, userId: string, progress: number) {
  const payload = { courseId, userId, progress };
  const res = await apiRequest(`/api/learner/assignments/progress`, { method: 'POST', body: payload });
  const rows = (res && (res as any).data) || res || null;
  const mapped = Array.isArray(rows) && rows.length > 0 ? mapAssignmentsFromApiRows(rows)[0] : null;
  return mapped;
}

export async function getAssignment(_id?: string) {
  // Legacy behavior removed; keep contract by returning null when not implemented.
  return null;
}

export async function getAssignmentsForUser(userIdOrEmail?: string | null) {
  // Gate by active session. If there's no active session, return an empty list (legacy behavior relied on this).
  const session = getUserSession();
  if (!session) return [];

  if (!userIdOrEmail) return [];

  let queryUserId: string | null = null;
  const looksLikeEmail = typeof userIdOrEmail === 'string' && userIdOrEmail.includes && userIdOrEmail.includes('@');
  if (looksLikeEmail) {
    try {
      const supabase = getSupabase();
      const {
        data: { session: supabaseSession },
      } = supabase ? await supabase.auth.getSession() : { data: { session: null } as any };
      if (supabaseSession?.user?.email === userIdOrEmail) {
        queryUserId = supabaseSession.user.id ?? null;
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  } else {
    queryUserId = userIdOrEmail as string;
  }

  if (!queryUserId) return [];

  // Ensure the caller is asking for the current session's assignments only.
  if (!looksLikeEmail && session.id !== queryUserId) return [];

  // We rely on headers for org scoping; avoid appending query params here.
  const url = buildScopedApiUrl(`/learner/assignments?include_completed=true`, undefined);
  const key = inFlightKeyForUrl(url);
  // Dedupe concurrent identical requests.
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<any>;
  }

  const fetchAssignmentsRaw = async () => {
    const res = await apiRequest(url);
    // apiRequest now returns envelopes { ok: true, data }
    const rows = Array.isArray(res)
      ? res
      : res && (res as any).data
      ? (res as any).data
      : [];
    return rows ?? [];
  };

  const prom = (async () => {
    try {
      const rows = await fetchAssignmentsRaw();
  // Server controls org scoping; map rows to client model and return.
  const mapped = mapAssignmentsFromApiRows(rows);
  // If we resolved via email-to-id mapping but the active session id is a
  // different identifier, normalize returned rows to reference the session
  // id so callers receive assignments keyed to the session they expect.
  if (looksLikeEmail && session && session.id && queryUserId && session.id !== queryUserId) {
    mapped.forEach((m: any) => {
      if (m.userId === queryUserId) m.userId = session.id;
    });
  }
  return mapped;
    } catch (err: any) {
      // If unauthenticated (401), swallow and return empty list for the
      // legacy non-outcome API to preserve original behavior expected by
      // callers/tests.
      if (err && (err.status === 401 || (err instanceof ApiError && (err as any).status === 401))) {
        return [];
      }
      // On other errors, fallback to cached secure payload if available.
      try {
        const cached = secureGet<any[]>('huddle_course_assignments_v1');
        if (Array.isArray(cached)) return cached as any[];
      } catch (_) {
        // ignore cache parse errors
      }
      // Re-throw to allow callers/tests to observe errors when desired.
      throw err;
    } finally {
      IN_FLIGHT.delete(key);
    }
  })();

  IN_FLIGHT.set(key, prom);
  return prom;
}

export function legacyAddAssignments(courseId: string, userIds: string[], options?: { organizationId?: string | null }) {
  // Route to admin API. Keep simple shape and return the backend's rows when present.
  const orgId = options?.organizationId ?? '';
  return apiRequest(`/api/admin/courses/${encodeURIComponent(courseId)}/assign`, {
    method: 'POST',
    body: { userIds, organizationId: orgId },
  }).then((res: any) => (res && (res.data ?? res)) || []);
}

export async function getAssignmentsForUserWithOutcome(
  userId?: string | null,
): Promise<{
  outcome: 'success' | 'empty' | 'error' | 'unauthenticated';
  assignments: any[];
  error?: string | null;
}> {
  // Low-level fetch so we can detect 401s explicitly and return unauthenticated outcome.
  const url = buildScopedApiUrl(`/learner/assignments?include_completed=true`, undefined);
  try {
    // Respect session gating similar to getAssignmentsForUser
    const session = getUserSession();
    if (!session) return { outcome: 'unauthenticated', assignments: [], error: 'auth_session_unavailable' };
    if (!userId) return { outcome: 'empty', assignments: [], error: null };
    const looksLikeEmail = typeof userId === 'string' && userId.includes && userId.includes('@');
    let queryUserId: string | null = null;
    if (looksLikeEmail) {
      try {
        const supabase = getSupabase();
        const {
          data: { session: supabaseSession },
        } = supabase ? await supabase.auth.getSession() : { data: { session: null } as any };
        if (supabaseSession?.user?.email === userId) {
          queryUserId = supabaseSession.user.id ?? null;
        } else {
          return { outcome: 'empty', assignments: [], error: null };
        }
      } catch (_) {
        return { outcome: 'empty', assignments: [], error: null };
      }
    } else {
      queryUserId = userId as string;
    }
    if (!queryUserId) return { outcome: 'empty', assignments: [], error: null };
  if (!looksLikeEmail && session.id !== queryUserId) return { outcome: 'empty', assignments: [], error: null };

    const rowsRaw = await apiRequest(url);
    const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw && (rowsRaw as any).data) ? (rowsRaw as any).data : [];
    const assignments = mapAssignmentsFromApiRows(rows ?? []);
    if (looksLikeEmail && session && session.id && queryUserId && session.id !== queryUserId) {
      assignments.forEach((m: any) => {
        if (m.userId === queryUserId) m.userId = session.id;
      });
    }
    if (!assignments || assignments.length === 0) return { outcome: 'empty', assignments: [], error: null };
    return { outcome: 'success', assignments, error: null };
  } catch (err: any) {
    if (err && (err.status === 401 || (err instanceof ApiError && (err as any).status === 401))) {
      return { outcome: 'unauthenticated', assignments: [], error: 'auth_session_unavailable' };
    }
    return { outcome: 'error', assignments: [], error: String(err?.message ?? err) };
  }
}

export function mapAssignmentsFromApiRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const userId = row.user_id ?? row.userId ?? row.user_id_uuid ?? row.userIdUuid ?? null;
    const courseId = row.course_id ?? row.courseId ?? null;
    const surveyId = row.survey_id ?? row.surveyId ?? null;
    const assignmentType = row.assignment_type ?? row.assignmentType ?? (surveyId ? 'survey' : 'course');
    const organizationId = row.organization_id ?? row.organizationId ?? row.org_id ?? row.orgId ?? null;
    return {
      id: row.id,
      courseId,
      surveyId,
      userId,
      organizationId,
      status: row.status ?? 'assigned',
      progress: typeof row.progress === 'number' ? row.progress : 0,
      dueDate: row.due_at ?? row.due_date ?? row.dueAt ?? null,
      note: row.note ?? null,
      assignedBy: row.assigned_by ?? null,
      createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
      active: typeof row.active === 'boolean' ? row.active : true,
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
      assignmentType,
    } as any;
  });
}
