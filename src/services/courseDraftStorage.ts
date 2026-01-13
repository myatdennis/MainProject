import type { Course } from '../types/courseTypes';
import { getUserSession } from '../lib/secureStorage';
import { getRuntimeStatus, type RuntimeStatus } from '../state/runtimeStatus';

export interface DraftSnapshot {
  id: string;
  course: Course;
  updatedAt: number;
  dirty: boolean;
  persistedAt?: number | null;
  userId?: string | null;
  orgId?: string | null;
  runtimeStatus?: Pick<RuntimeStatus, 'statusLabel' | 'apiHealthy' | 'supabaseHealthy' | 'lastChecked' | 'offlineQueueBacklog'>;
  cause?: string;
  metadata?: Record<string, unknown>;
}

export interface SaveDraftOptions {
  dirty?: boolean;
  cause?: string;
  runtimeStatus?: DraftSnapshot['runtimeStatus'];
  metadata?: Record<string, unknown>;
}

export interface DraftFilter {
  dirtyOnly?: boolean;
}

const DB_NAME = 'huddle_course_drafts';
const STORE_NAME = 'course_drafts';
const DB_VERSION = 1;

const memoryDrafts = new Map<string, DraftSnapshot>();
let dbPromise: Promise<IDBDatabase> | null = null;

const hasIndexedDb = () => typeof indexedDB !== 'undefined' && typeof window !== 'undefined';

const getDb = (): Promise<IDBDatabase> => {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open drafts database'));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return dbPromise;
};

const isFileLike = (value: unknown): boolean => {
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (typeof FileList !== 'undefined' && value instanceof FileList) return true;
  return false;
};

const sanitizeValue = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (isFileLike(value)) return undefined;

  if (Array.isArray(value)) {
    const next = value
      .map((entry) => sanitizeValue(entry))
      .filter((entry) => entry !== undefined);
    return next;
  }

  if (typeof value === 'object') {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      const sanitized = sanitizeValue(val);
      if (sanitized !== undefined) {
        next[key] = sanitized;
      }
    });
    return next;
  }

  return undefined;
};

const sanitizeCourse = (course: Course): Course => sanitizeValue(course) as Course;

const getOwnerContext = () => {
  try {
    const session = getUserSession();
    return {
      userId: session?.id ?? null,
      orgId: session?.activeOrgId ?? session?.organizationId ?? null,
    };
  } catch {
    return { userId: null, orgId: null };
  }
};

const snapshotRuntimeStatus = (): DraftSnapshot['runtimeStatus'] => {
  try {
    const status = getRuntimeStatus();
    return {
      statusLabel: status.statusLabel,
      apiHealthy: status.apiHealthy,
      supabaseHealthy: status.supabaseHealthy,
      lastChecked: status.lastChecked,
      offlineQueueBacklog: status.offlineQueueBacklog,
    };
  } catch {
    return undefined;
  }
};

const writeRecord = async (record: DraftSnapshot): Promise<void> => {
  memoryDrafts.set(record.id, record);

  if (!hasIndexedDb()) {
    return;
  }

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record, record.id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to persist draft snapshot'));
    });
  } catch (error) {
    console.warn('[courseDraftStorage] Failed to persist draft snapshot:', error);
  }
};

const readRecord = async (courseId: string): Promise<DraftSnapshot | null> => {
  if (memoryDrafts.has(courseId)) {
    return memoryDrafts.get(courseId) ?? null;
  }

  if (!hasIndexedDb()) {
    return null;
  }

  try {
    const db = await getDb();
    return await new Promise<DraftSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(courseId);
      request.onsuccess = () => {
        const value = request.result as DraftSnapshot | undefined;
        if (value) {
          memoryDrafts.set(courseId, value);
        }
        resolve(value ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read draft snapshot'));
    });
  } catch (error) {
    console.warn('[courseDraftStorage] Failed to read draft snapshot:', error);
    return null;
  }
};

const deleteRecord = async (courseId: string): Promise<void> => {
  memoryDrafts.delete(courseId);

  if (!hasIndexedDb()) {
    return;
  }

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(courseId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to delete draft snapshot'));
    });
  } catch (error) {
    console.warn('[courseDraftStorage] Failed to delete draft snapshot:', error);
  }
};

export const saveDraftSnapshot = async (course: Course, options: SaveDraftOptions = {}): Promise<void> => {
  if (!course?.id) return;

  const sanitizedCourse = sanitizeCourse(course);
  const owner = getOwnerContext();
  const record: DraftSnapshot = {
    id: course.id,
    course: sanitizedCourse,
    updatedAt: Date.now(),
    dirty: options.dirty ?? true,
    persistedAt: null,
    userId: owner.userId,
    orgId: owner.orgId,
    runtimeStatus: options.runtimeStatus ?? snapshotRuntimeStatus(),
    cause: options.cause,
    metadata: options.metadata,
  };

  await writeRecord(record);
};

export const markDraftSynced = async (courseId: string, course?: Course): Promise<void> => {
  if (!courseId) return;
  const existing = (await readRecord(courseId)) ?? undefined;
  if (!existing && !course) {
    return;
  }

  const record: DraftSnapshot = {
    ...(existing ?? {
      id: courseId,
      course: sanitizeCourse(course as Course),
      updatedAt: Date.now(),
      dirty: false,
    }),
    dirty: false,
    persistedAt: Date.now(),
    course: course ? sanitizeCourse(course) : existing!.course,
  };

  await writeRecord(record);
};

export const deleteDraftSnapshot = async (courseId: string): Promise<void> => {
  if (!courseId) return;
  await deleteRecord(courseId);
};

export const getDraftSnapshot = async (courseId: string, filter?: DraftFilter): Promise<DraftSnapshot | null> => {
  if (!courseId) return null;
  const owner = getOwnerContext();
  const record = await readRecord(courseId);
  if (!record) return null;

  if (record.userId && owner.userId && record.userId !== owner.userId) {
    return null;
  }

  if (filter?.dirtyOnly && !record.dirty) {
    return null;
  }

  return record;
};

export const listDraftSnapshots = async (filter?: DraftFilter): Promise<DraftSnapshot[]> => {
  const owner = getOwnerContext();
  if (!hasIndexedDb()) {
    return Array.from(memoryDrafts.values()).filter((record) => {
      if (record.userId && owner.userId && record.userId !== owner.userId) {
        return false;
      }
      if (filter?.dirtyOnly && !record.dirty) {
        return false;
      }
      return true;
    });
  }

  try {
    const db = await getDb();
    return await new Promise<DraftSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = (request.result as DraftSnapshot[]) || [];
        rows.forEach((row) => memoryDrafts.set(row.id, row));
        resolve(
          rows.filter((record) => {
            if (record.userId && owner.userId && record.userId !== owner.userId) {
              return false;
            }
            if (filter?.dirtyOnly && !record.dirty) {
              return false;
            }
            return true;
          }),
        );
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to list draft snapshots'));
    });
  } catch (error) {
    console.warn('[courseDraftStorage] Failed to list draft snapshots:', error);
    return [];
  }
};
