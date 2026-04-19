import { syncService } from '../dal/sync';
import type { AssignmentKind, CourseAssignment, CourseAssignmentStatus } from '../types/assignment';
import { getUserSession, getActiveOrgPreference, secureGet, secureSet, secureRemove } from '../lib/secureStorage';
import { readBridgeSnapshot } from '../store/courseStoreOrgBridge';
import apiRequest, { ApiError as RequestError } from './apiClient';

const STORAGE_KEY = 'huddle_course_assignments_v1';
const ASSIGNMENTS_API_CACHE_TTL_MS = 10_000;
// Maximum allowed JSON payload bytes per secure storage key. Guard against
// oversized writes that would trigger QuotaExceededError in some browsers.
const MAX_PERSIST_KEY_BYTES = (() => {
  try {
    const meta = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_ASSIGNMENT_MAX_KEY_BYTES : undefined;
    const proc = typeof process !== 'undefined' ? process.env?.ASSIGNMENT_MAX_KEY_BYTES : undefined;
    const parsed = Number(meta ?? proc ?? 500_000);
    return Number.isFinite(parsed) && parsed > 16_384 ? parsed : 500_000;
  } catch {
    return 500_000;
  }
})();

// Backwards-compatible threshold which controls whether we chunk by index.
const ASSIGNMENT_PERSIST_SIZE_THRESHOLD = (() => {
  try {
    const metaValue =
      typeof import.meta !== 'undefined'
        ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_ASSIGNMENT_PERSIST_SIZE_THRESHOLD
        : undefined;
    const processValue =
      typeof process !== 'undefined' ? process.env?.ASSIGNMENT_PERSIST_SIZE_THRESHOLD : undefined;
    const parsed = Number(metaValue ?? processValue ?? 200_000);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 200_000;
  } catch {
    return 200_000;
  }
})();
let assignmentsApiCache:
  | {
      expiresAt: number;
      orgId: string | null;
      rows: CourseAssignment[];
    }
  | null = null;
let assignmentsApiInflight: Promise<{ rows: CourseAssignment[]; failed: boolean }> | null = null;

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

const getSessionUserEmail = (): string | null => {
  try {
    const session = getUserSession();
    return session?.email ? session.email.toLowerCase() : null;
  } catch (error) {
    console.warn('[assignmentStorage] Unable to resolve authenticated session email:', error);
    return null;
  }
};

const hasAuthenticatedSessionSnapshot = (): boolean => {
  try {
    const bridge = readBridgeSnapshot();
    if (bridge && (bridge.userId || bridge.status === 'ready')) return true;
  } catch {
    // ignore and fall back to secureStorage
  }
  return Boolean(getSessionUserId() || getSessionUserEmail());
};

const resolveAssignmentOrgId = (explicitOrgId?: string | null): string | null => {
  const normalizedExplicit = normalizeUserId(explicitOrgId);
  if (normalizedExplicit) return normalizedExplicit;
  try {
    const bridge = readBridgeSnapshot();
    const bridgeOrgId = normalizeUserId(bridge?.activeOrgId ?? bridge?.orgId ?? null);
    if (bridgeOrgId) return bridgeOrgId;
  } catch {
    // ignore
  }
  try {
    const session = getUserSession();
    const sessionOrgId = normalizeUserId(session?.activeOrgId ?? session?.organizationId ?? null);
    if (sessionOrgId) return sessionOrgId;
  } catch {
    // ignore
  }
  return normalizeUserId(getActiveOrgPreference());
};

const resolveLiveSessionContext = async (): Promise<{ id: string | null; email: string | null }> => {
  try {
    // Prefer the bridge snapshot (written by SecureAuthContext) when available
    try {
      const bridge = readBridgeSnapshot();
      if (bridge && bridge.userId) {
        return { id: bridge.userId.toLowerCase(), email: null };
      }
    } catch {
      // ignore and fall back to Supabase
    }
    // Prefer canonical in-memory session (set by SecureAuthContext). This
    // avoids direct Supabase session reads from arbitrary modules.
    try {
      const { getCanonicalSession } = await import('../lib/canonicalAuth');
      const cs = getCanonicalSession();
      if (cs && cs.userId) {
        return { id: cs.userId.toLowerCase(), email: cs.userEmail ?? null };
      }
      // If canonical not ready, wait briefly for auth ready if possible.
      const { waitForAuthReady } = await import('../lib/canonicalAuth');
      const ready = await waitForAuthReady(2000).catch(() => null);
      if (ready && ready.userId) return { id: ready.userId.toLowerCase(), email: ready.userEmail ?? null };
    } catch (e) {
      // fall through to safe null result
    }
    return { id: null, email: null };
  } catch (error) {
    console.warn('[assignmentStorage] Unable to resolve live Supabase session:', error);
    return { id: null, email: null };
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
    let parsed = secureGet<CourseAssignment[]>(STORAGE_KEY) ?? [];
    // If grouped payload missing or empty, attempt chunked load
    if ((!parsed || parsed.length === 0) && secureGet<string[]>(STORAGE_INDEX_KEY)) {
      const ids = secureGet<string[]>(STORAGE_INDEX_KEY) ?? [];
      const reconstructed: CourseAssignment[] = [];
      for (const id of ids) {
        try {
          const rec = secureGet<CourseAssignment>(`${STORAGE_KEY}_${id}`);
          if (rec) reconstructed.push(rec);
        } catch (e) {
          console.warn('[assignmentStorage] Failed to load individual assignment', id, e);
        }
      }
      parsed = reconstructed;
    }
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
      // Attempt to persist a cleaned serialization as a best-effort repair.
      try {
        persistLocalAssignments(sanitized);
      } catch (e) {
        // Non-fatal: do not allow persistence repairs to throw during load.
        console.warn('[assignmentStorage] Non-fatal persist during load failed', e);
      }
    }
    return sanitized;
  } catch (error) {
    console.warn('Failed to load assignments:', error);
    return [];
  }
};

const STORAGE_INDEX_KEY = STORAGE_KEY + '_index';

const minimalizeAssignment = (rec: CourseAssignment) => ({
  id: rec.id,
  courseId: rec.courseId ?? null,
  surveyId: rec.surveyId ?? null,
  userId: rec.userId,
  status: rec.status ?? 'assigned',
  progress: typeof rec.progress === 'number' ? rec.progress : 0,
  dueDate: rec.dueDate ?? null,
  updatedAt: rec.updatedAt ?? rec.createdAt ?? new Date().toISOString(),
});

const bytesOf = (s: string) => new TextEncoder().encode(s).length;

const pruneRecordsToFit = (records: CourseAssignment[], maxBytes: number): CourseAssignment[] => {
  // Attempt minimalization first
  let simplified = records.map((r) => minimalizeAssignment(r) as unknown as CourseAssignment);
  let serialized = JSON.stringify(simplified);
  let size = bytesOf(serialized);
  if (size <= maxBytes) return simplified;

  // Apply LRU-ish prune by updatedAt ascending (oldest removed first)
  simplified.sort((a, b) => {
    const ta = Date.parse(a.updatedAt ?? '') || 0;
    const tb = Date.parse(b.updatedAt ?? '') || 0;
    return ta - tb;
  });

  while (simplified.length > 0 && size > maxBytes) {
    simplified.shift();
    serialized = JSON.stringify(simplified);
    size = bytesOf(serialized);
  }
  return simplified;
};

/** One-time cleanup of legacy/oversized secure storage keys for assignments. */
const cleanupLegacyOversizedKeys = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    const prefix = 'secure_' + STORAGE_KEY;
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (key === `secure_${STORAGE_KEY}` || key === `secure_${STORAGE_INDEX_KEY}` || key.startsWith(prefix + '_')) {
        const raw = storage.getItem(key) ?? '';
        const encBytes = raw.length;
        // Heuristic: encrypted payloads larger than twice max key bytes are likely problematic legacy items.
        if (encBytes > MAX_PERSIST_KEY_BYTES * 2) {
          toRemove.push(key);
        }
      }
    }
    toRemove.forEach((k) => {
      try {
        storage.removeItem(k);
        console.info('[assignmentStorage] legacy_key_removed', { key: k });
      } catch (e) {
        console.warn('[assignmentStorage] failed_remove_legacy_key', { key: k, error: e });
      }
    });
  } catch (err) {
    console.warn('[assignmentStorage] cleanupLegacyOversizedKeys failed', err);
  }
};

// run cleanup at module load (best-effort)
try {
  cleanupLegacyOversizedKeys();
} catch {
  // ignore
}

const persistLocalAssignments = (records: CourseAssignment[]) => {
  try {
    const serialized = JSON.stringify(records || []);
    const size = bytesOf(serialized);
    console.info('[assignmentStorage] payload_size', { key: STORAGE_KEY, bytes: size });

    // Fast path: if already small enough to fit a single key and below strict cap
    if (size <= Math.min(ASSIGNMENT_PERSIST_SIZE_THRESHOLD, MAX_PERSIST_KEY_BYTES)) {
      try {
        secureSet(STORAGE_KEY, records);
        return;
      } catch (err) {
        console.warn('[assignmentStorage] storage_write_failed', { key: STORAGE_KEY, bytes: size, error: err });
      }
    }

    // If payload exceeds per-key cap, reduce to minimal schema and prune until fits
    if (size > MAX_PERSIST_KEY_BYTES) {
      const pruned = pruneRecordsToFit(records, MAX_PERSIST_KEY_BYTES);
      const prunedSerialized = JSON.stringify(pruned);
      const prunedSize = bytesOf(prunedSerialized);
      console.warn('[assignmentStorage] storage_pruned', { originalBytes: size, prunedBytes: prunedSize, originalCount: records.length, prunedCount: pruned.length });
      try {
        secureSet(STORAGE_KEY, pruned);
        return;
      } catch (err) {
        console.warn('[assignmentStorage] storage_write_failed_after_prune', { key: STORAGE_KEY, prunedSize, error: err });
      }
    }

    // If still too big for single-key but below chunk threshold, attempt chunked write.
    if (size > ASSIGNMENT_PERSIST_SIZE_THRESHOLD) {
      try {
        const ids = records.map((r) => r.id);
        try {
          secureSet(STORAGE_INDEX_KEY, ids);
        } catch (err) {
          console.warn('[assignmentStorage] storage_write_failed', { key: STORAGE_INDEX_KEY, error: err });
        }
        for (const rec of records) {
          try {
            const recSerialized = JSON.stringify(rec);
            const recBytes = bytesOf(recSerialized);
            if (recBytes > MAX_PERSIST_KEY_BYTES) {
              // if an individual record is too big, persist a minimalized version
              const minimal = minimalizeAssignment(rec);
              try {
                secureSet(`${STORAGE_KEY}_${rec.id}`, minimal);
                console.warn('[assignmentStorage] individual_record_minimalized', { id: rec.id, originalBytes: recBytes, minimalBytes: bytesOf(JSON.stringify(minimal)) });
              } catch (err) {
                console.warn('[assignmentStorage] storage_write_failed', { key: `${STORAGE_KEY}_${rec.id}`, error: err });
              }
            } else {
              try {
                secureSet(`${STORAGE_KEY}_${rec.id}`, rec);
              } catch (err) {
                console.warn('[assignmentStorage] storage_write_failed', { key: `${STORAGE_KEY}_${rec.id}`, id: rec.id, error: err });
              }
            }
          } catch (inner) {
            console.warn('[assignmentStorage] Failed to serialize individual record', rec.id, inner);
          }
        }
        // attempt to remove grouped key
        try { secureRemove(STORAGE_KEY); } catch (e) { /* non-fatal */ }
        return;
      } catch (e) {
        console.warn('[assignmentStorage] Chunked persist failed, falling back to single-key persist', e);
      }
    }

    // final attempt: write single-key (may be slightly above threshold)
    try {
      secureSet(STORAGE_KEY, records);
    } catch (error) {
      console.warn('[assignmentStorage] storage_write_failed', { key: STORAGE_KEY, bytes: size, error });
    }
  } catch (error) {
    console.warn('[assignmentStorage] Failed to persist assignments to secure storage (outer):', error);
  }
};

// Export internals for unit testing / diagnostics
export const __assignmentStorageInternals = {
  minimalizeAssignment,
  pruneRecordsToFit,
  bytesOf,
};

const clearLocalAssignments = () => {
  invalidateAssignmentsApiCache();
  let ids: string[] = [];
  try {
    // best-effort remove grouped key and index
    // First gather chunk ids (if any) so we can remove individual keys.
    try {
      ids = secureGet<string[]>(STORAGE_INDEX_KEY) ?? [];
    } catch {
      ids = [];
    }
    secureRemove(STORAGE_KEY);
  } catch (err) {
    console.warn('[assignmentStorage] clearLocalAssignments failed to remove grouped key', err);
  }
  try {
    secureRemove(STORAGE_INDEX_KEY);
  } catch (err) {
    // ignore
  }
  // attempt to remove chunked keys if any
  try {
    const idsToRemove = Array.isArray(ids) ? ids : [];
    for (const id of idsToRemove) {
      try {
        secureRemove(`${STORAGE_KEY}_${id}`);
      } catch (e) {
        // non-fatal
      }
    }
  } catch (err) {
    // non-fatal
  }
};

const invalidateAssignmentsApiCache = () => {
  assignmentsApiCache = null;
};

let inflightLocalSync: Promise<void> | null = null;

const syncLocalAssignmentsToSupabase = async () => {
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
        // Group pending assignments by course and call the backend admin assign
        // endpoint for each course so the browser never writes directly.
        const byCourse = new Map<string, CourseAssignment[]>();
        for (const asn of pending) {
          const key = asn.courseId ?? '__org__';
          const list = byCourse.get(key) ?? [];
          list.push(asn);
          byCourse.set(key, list);
        }

        for (const [courseId, rows] of byCourse.entries()) {
          const userIds = rows.map((r) => r.userId).filter(Boolean);
          const orgId = resolveAssignmentOrgId(rows.find((r) => r.organizationId)?.organizationId ?? null);
          if (userIds.length === 0) continue;
          if (!orgId) {
            console.warn('[assignmentStorage] Skipping local assignment sync without orgId', {
              courseId,
              queuedAssignments: rows.length,
            });
            continue;
          }
          try {
            const payload: any = { user_ids: Array.from(new Set(userIds)), organization_id: orgId };
            // preserve optional fields if available on the first row
            const first = rows[0];
            if (first.dueDate) payload.due_at = first.dueDate;
            if (first.note) payload.note = first.note;
            await apiRequest(`/api/admin/courses/${encodeURIComponent(courseId)}/assign?orgId=${encodeURIComponent(orgId)}`, { method: 'POST', body: payload });
          } catch (err) {
            console.warn('[assignmentStorage] Failed to sync local assignments to backend API:', err);
          }
        }

        // If we got here without throwing, clear the local queue.
        clearLocalAssignments();
      } catch (error) {
        console.warn('[assignmentStorage] Failed to sync local assignments (outer):', error);
      } finally {
        inflightLocalSync = null;
      }
  })();

  return inflightLocalSync;
};

if (typeof window !== 'undefined') {
  if (hasAuthenticatedSessionSnapshot()) {
    void syncLocalAssignmentsToSupabase();
  }

  window.addEventListener('online', () => {
    if (hasAuthenticatedSessionSnapshot()) {
      void syncLocalAssignmentsToSupabase();
    }
  });
}

const emitLocalEvent = (
  type: 'assignment_created' | 'assignment_updated' | 'assignment_deleted',
  assignment: CourseAssignment
) => {
  syncService.logSyncEvent({
    type,
    data: assignment,
    courseId: assignment.courseId ?? undefined,
    userId: assignment.userId,
    timestamp: Date.now(),
    source: 'client',
  });
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

  try {
      if (normalizedIds.length === 0) return [];
      const orgId = resolveAssignmentOrgId(options.organizationId ?? null);
      if (!orgId) {
        throw new Error('organization_id_required');
      }
      const payload: any = {
        user_ids: normalizedIds,
        organization_id: orgId,
      };
      if (options.dueDate) payload.due_at = options.dueDate;
      if (options.note) payload.note = options.note;
      if (options.assignedBy) payload.assigned_by = options.assignedBy;

      const response = await apiRequest<{ data?: any }>(
        `/api/admin/courses/${encodeURIComponent(courseId)}/assign?orgId=${encodeURIComponent(orgId)}`,
        { method: 'POST', body: payload },
      );
      const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      invalidateAssignmentsApiCache();
      return mapAssignmentsFromApiRows(rows);
  } catch (error) {
      console.warn('[assignmentStorage] Remote admin assign failed, falling back to local', error);
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

const fetchAssignmentsViaApi = async (orgId: string): Promise<{ rows: CourseAssignment[]; failed: boolean }> => {
  const now = Date.now();
  if (assignmentsApiCache && assignmentsApiCache.expiresAt > now && assignmentsApiCache.orgId === orgId) {
    return { rows: assignmentsApiCache.rows, failed: false };
  }
  if (assignmentsApiInflight) {
    return assignmentsApiInflight;
  }

  const request = (async (): Promise<{ rows: CourseAssignment[]; failed: boolean }> => {
  try {
    const params = new URLSearchParams({
      include_completed: 'true',
      orgId,
    });
    const response = await apiRequest<any[] | { data?: any[] }>(`/api/learner/assignments?${params.toString()}`);
    const rows = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
      ? response.data
      : [];
    if (!rows.length) {
      assignmentsApiCache = {
        expiresAt: Date.now() + ASSIGNMENTS_API_CACHE_TTL_MS,
        orgId,
        rows: [],
      };
      return { rows: [], failed: false };
    }
    const mappedRows = mapAssignmentsFromApiRows(rows);
    assignmentsApiCache = {
      expiresAt: Date.now() + ASSIGNMENTS_API_CACHE_TTL_MS,
      orgId,
      rows: mappedRows,
    };
    return { rows: mappedRows, failed: false };
  } catch (error) {
    if (error instanceof RequestError && (error.status === 401 || error.status === 403)) {
      console.warn('[assignmentStorage] Remote assignments request rejected (unauthorized).');
      return { rows: [], failed: false };
    }
    console.warn('[assignmentStorage] Failed to load assignments via API:', error);
    return { rows: [], failed: true };
  } finally {
    assignmentsApiInflight = null;
  }
  })();

  assignmentsApiInflight = request;
  return request;
};

/**
 * Fetch assignments but return a richer outcome so callers can distinguish
 * between success (remote returned), empty (remote returned empty) and error
 * (remote failed). This helper is intended for callers that must treat a
 * remote failure as an error state instead of silently falling back to
 * local assignments.
 */
export const getAssignmentsForUserWithOutcome = async (
  userId?: string | null,
  orgId?: string | null,
): Promise<{
  outcome: 'success' | 'empty' | 'error' | 'unauthenticated';
  assignments: CourseAssignment[];
  error?: string | null;
}> => {
  const normalized = normalizeUserId(userId) ?? null;
  if (!normalized) {
    return { outcome: 'unauthenticated', assignments: [], error: 'invalid_user' };
  }
  const resolvedOrgId = resolveAssignmentOrgId(orgId);

  const sessionUserId = getSessionUserId();
  const sessionUserEmail = getSessionUserEmail();
  let liveSessionId: string | null = null;
  let liveSessionEmail: string | null = null;
  let sessionUserIdResolved = sessionUserId;

  const loadLocalForUser = (): CourseAssignment[] =>
    loadLocalAssignments().filter((record) => record.userId === normalized);

  const ensureLiveSessionChecked = async () => {
    if (liveSessionId !== null || liveSessionEmail !== null) return;
    const liveContext = await resolveLiveSessionContext();
    liveSessionId = liveContext.id;
    liveSessionEmail = liveContext.email;
    if (!sessionUserIdResolved && liveSessionId) sessionUserIdResolved = liveSessionId;
  };

  const currentSessionMatchesRequestedUser = () =>
    sessionUserIdResolved === normalized ||
    sessionUserEmail === normalized ||
    liveSessionId === normalized ||
    liveSessionEmail === normalized;

  if (!currentSessionMatchesRequestedUser()) {
    await ensureLiveSessionChecked();
  }

  if (!currentSessionMatchesRequestedUser()) {
    // caller requested a user that does not match the authenticated session,
    // return local-only data but mark as unauthenticated so callers can decide.
    return { outcome: 'unauthenticated', assignments: loadLocalForUser(), error: 'session_mismatch' };
  }

  if (!sessionUserIdResolved && !sessionUserEmail && !liveSessionId && !liveSessionEmail) {
    return { outcome: 'unauthenticated', assignments: loadLocalForUser(), error: 'no_authenticated_session' };
  }
  if (!resolvedOrgId) {
    return { outcome: 'unauthenticated', assignments: loadLocalForUser(), error: 'missing_org' };
  }

  try {
    const { rows, failed } = await fetchAssignmentsViaApi(resolvedOrgId);
    if (failed) {
      // Remote call failed — surface as an error outcome but return local fallback
      return { outcome: 'error', assignments: loadLocalForUser(), error: 'remote_failed' };
    }
    const filtered = rows.filter((record) => {
      const assignmentType = (record.assignmentType ?? 'course') as AssignmentKind;
      if (assignmentType !== 'course') return false;
      const sessionJoiningKeys = new Set<string>([normalized]);
      if (sessionUserIdResolved) sessionJoiningKeys.add(sessionUserIdResolved);
      if (sessionUserEmail) sessionJoiningKeys.add(sessionUserEmail);
      if (liveSessionId) sessionJoiningKeys.add(liveSessionId);
      if (liveSessionEmail) sessionJoiningKeys.add(liveSessionEmail);
      return sessionJoiningKeys.has(record.userId);
    });
    if (filtered.length === 0) return { outcome: 'empty', assignments: [], error: null };
    // persist for offline scenarios
    persistLocalAssignments(filtered);
    filtered.forEach((assignment) => emitLocalEvent('assignment_updated', assignment));
    return { outcome: 'success', assignments: filtered, error: null };
  } catch (err) {
    console.warn('[assignmentStorage] getAssignmentsForUserWithOutcome unexpected error:', err);
    return { outcome: 'error', assignments: loadLocalForUser(), error: (err as Error)?.message ?? String(err) };
  }
};

export const getAssignmentsForUser = async (userId?: string | null, orgId?: string | null): Promise<CourseAssignment[]> => {
  const normalized = normalizeUserId(userId) ?? null;
  if (!normalized) {
    console.warn('[assignmentStorage] getAssignmentsForUser called without a valid user id. Returning empty assignments.');
    return [];
  }

  const sessionUserId = getSessionUserId();
  const sessionUserEmail = getSessionUserEmail();
  const resolvedOrgId = resolveAssignmentOrgId(orgId);
  let liveSessionId: string | null = null;
  let liveSessionEmail: string | null = null;
  let sessionUserIdResolved = sessionUserId;

  const loadLocalForUser = (): CourseAssignment[] =>
    loadLocalAssignments().filter((record) => record.userId === normalized);

  const ensureLiveSessionChecked = async () => {
    if (liveSessionId !== null || liveSessionEmail !== null) {
      return;
    }
    const liveContext = await resolveLiveSessionContext();
    liveSessionId = liveContext.id;
    liveSessionEmail = liveContext.email;
    if (!sessionUserIdResolved && liveSessionId) {
      sessionUserIdResolved = liveSessionId;
    }
  };

  const currentSessionMatchesRequestedUser = () =>
    sessionUserIdResolved === normalized ||
    sessionUserEmail === normalized ||
    liveSessionId === normalized ||
    liveSessionEmail === normalized;

  if (!currentSessionMatchesRequestedUser()) {
    await ensureLiveSessionChecked();
  }

  if (!currentSessionMatchesRequestedUser()) {
    console.warn('[assignmentStorage] Requested user does not match authenticated session; using local fallback.');
    return loadLocalForUser();
  }

  const sessionJoiningKeys = new Set<string>([normalized]);
  if (sessionUserIdResolved) sessionJoiningKeys.add(sessionUserIdResolved);
  if (sessionUserEmail) sessionJoiningKeys.add(sessionUserEmail);
  if (liveSessionId) sessionJoiningKeys.add(liveSessionId);
  if (liveSessionEmail) sessionJoiningKeys.add(liveSessionEmail);

  const loadRemoteAssignments = async () => {
    const { rows, failed } = await fetchAssignmentsViaApi(resolvedOrgId);
    if (!failed) {
      const filtered = rows.filter((record) => {
        const assignmentType = (record.assignmentType ?? 'course') as AssignmentKind;
        if (assignmentType !== 'course') return false;
        return sessionJoiningKeys.has(record.userId);
      });
      if (filtered.length) {
        persistLocalAssignments(filtered);
        filtered.forEach((assignment) => emitLocalEvent('assignment_updated', assignment));
      }
      return filtered;
    }

    return loadLocalForUser();
  };

  if (!sessionUserIdResolved && !sessionUserEmail && !liveSessionId && !liveSessionEmail) {
    console.info('[assignmentStorage] Skipping remote assignment fetch (no authenticated session).');
    return loadLocalForUser();
  }
  if (!resolvedOrgId) {
    console.info('[assignmentStorage] Skipping remote assignment fetch (missing org context).');
    return loadLocalForUser();
  }

  return await loadRemoteAssignments();
};

export const getAssignment = async (
  courseId: string,
  userId: string,
  orgId?: string | null,
): Promise<CourseAssignment | undefined> => {
  const assignments = await getAssignmentsForUser(userId, orgId);
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
  const orgId = resolveAssignmentOrgId(null);

  try {
      if (!orgId) {
        throw new Error('organization_id_required');
      }
      const payload = { course_id: courseId, user_id: normalized, progress: clampedProgress };
      const response = await apiRequest<{ data?: any }>(
        `/api/learner/assignments/progress?orgId=${encodeURIComponent(orgId)}`,
        { method: 'POST', body: payload },
      );
      const row = Array.isArray(response) ? response[0] : response?.data ? (Array.isArray(response.data) ? response.data[0] : response.data) : null;
      if (row) {
        invalidateAssignmentsApiCache();
        return mapSupabaseAssignment(row as SupabaseAssignmentRow);
      }
      return undefined;
  } catch (error) {
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
};

export const markAssignmentComplete = async (
  courseId: string,
  userId: string
): Promise<CourseAssignment | undefined> => updateAssignmentProgress(courseId, userId, 100);
