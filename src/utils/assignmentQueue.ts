import { config } from '../config/env';
import type { CourseAssignment } from '../types/assignment';
import { legacyAddAssignments, mapAssignmentsFromApiRows } from './assignmentStorage';
import { adminAssignCourse } from '../dal/adminCourses';
import { ApiError } from './apiClient';
import { secureGet, secureSet } from '../lib/secureStorage';
import { createActionIdentifiers } from './idempotency';

export type AssignmentRequestMode = 'learners' | 'organization';

export interface AssignmentRequestInput {
  courseId: string;
  organizationId: string;
  userIds?: string[];
  dueDate?: string | null;
  note?: string | null;
  assignedBy?: string | null;
  mode: AssignmentRequestMode;
  metadata?: Record<string, unknown>;
}

export interface AssignmentQueueItem extends AssignmentRequestInput {
  id: string;
  userIds: string[];
  status: 'pending' | 'retrying' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
  clientRequestId: string;
}

export interface AssignmentSubmissionResult {
  status: 'sent' | 'queued';
  requestId: string;
  count: number;
  assignments?: CourseAssignment[];
}

const STORAGE_KEY = 'assignment_queue_v1';
let assignmentQueue: AssignmentQueueItem[] = [];

const loadQueue = () => {
  try {
    assignmentQueue = secureGet<AssignmentQueueItem[]>(STORAGE_KEY) ?? [];
  } catch (error) {
    console.warn('[assignmentQueue] Failed to load queue from storage:', error);
    assignmentQueue = [];
  }
};

loadQueue();

const persistQueue = () => {
  secureSet(STORAGE_KEY, assignmentQueue);
};

const listeners = new Set<(items: AssignmentQueueItem[]) => void>();
const notify = () => {
  const snapshot = assignmentQueue.map((item) => ({ ...item }));
  listeners.forEach((listener) => listener(snapshot));
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeUserIds = (userIds?: string[]): string[] => {
  if (!Array.isArray(userIds)) return [];
  return Array.from(
    new Set(
      userIds
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

const shouldQueueError = (error: unknown): boolean => {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline) return true;
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === 'timeout') {
      return true;
    }
    return false;
  }
  // Network-level failures bubble up as TypeErrors
  return true;
};

const enqueueAssignmentRequest = (input: Omit<AssignmentQueueItem, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'lastError'>): AssignmentQueueItem => {
  const item: AssignmentQueueItem = {
    ...input,
    id: generateId(),
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assignmentQueue = [...assignmentQueue, item];
  persistQueue();
  notify();
  return item;
};

export const getAssignmentQueue = (): AssignmentQueueItem[] => assignmentQueue.map((item) => ({ ...item }));

export const subscribeToAssignmentQueue = (listener: (items: AssignmentQueueItem[]) => void): (() => void) => {
  listeners.add(listener);
  listener(getAssignmentQueue());
  return () => {
    listeners.delete(listener);
  };
};

const updateQueue = (updater: (items: AssignmentQueueItem[]) => AssignmentQueueItem[]) => {
  assignmentQueue = updater(assignmentQueue).map((item) => ({ ...item }));
  persistQueue();
  notify();
};

let processing = false;

export const processAssignmentQueue = async (): Promise<void> => {
  if (processing || assignmentQueue.length === 0) return;
  if (!config.features.useAssignmentsApi) {
    // Legacy mode leaves queue management to other paths
    return;
  }

  processing = true;
  try {
    for (const item of assignmentQueue) {
      if (item.status === 'pending' || item.status === 'retrying') {
        try {
          updateQueue((items) =>
            items.map((queued) =>
              queued.id === item.id
                ? { ...queued, status: 'retrying', attempts: queued.attempts + 1, updatedAt: new Date().toISOString(), lastError: undefined }
                : queued
            )
          );

          await adminAssignCourse(item.courseId, {
            organizationId: item.organizationId,
            userIds: item.userIds,
            dueAt: item.dueDate ?? null,
            note: item.note ?? null,
            assignedBy: item.assignedBy ?? null,
            idempotencyKey: item.idempotencyKey,
            clientRequestId: item.clientRequestId,
            metadata: {
              ...item.metadata,
              mode: item.mode,
              replayedAt: new Date().toISOString(),
            },
          });

          updateQueue((items) => items.filter((queued) => queued.id !== item.id));
        } catch (error) {
          updateQueue((items) =>
            items.map((queued) =>
              queued.id === item.id
                ? {
                    ...queued,
                    status: 'failed',
                    lastError: error instanceof Error ? error.message : 'Unknown error',
                    updatedAt: new Date().toISOString(),
                  }
                : queued
            )
          );

          if (!shouldQueueError(error)) {
            console.error('[assignmentQueue] Failed processing assignment request:', error);
          } else {
            break; // stop processing if we detect offline state again
          }
        }
      }
    }
  } finally {
    processing = false;
  }
};

export const retryAssignmentRequest = (id: string) => {
  updateQueue((items) =>
    items.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'pending',
            updatedAt: new Date().toISOString(),
            lastError: undefined,
          }
        : item
    )
  );
  void processAssignmentQueue();
};

export const removeAssignmentRequest = (id: string) => {
  updateQueue((items) => items.filter((item) => item.id !== id));
};

const buildRequestIdentifiers = (input: AssignmentRequestInput) =>
  createActionIdentifiers('course.assign', {
    courseId: input.courseId,
    orgId: input.organizationId,
    attempt: assignmentQueue.length + 1,
  });

export const submitAssignmentRequest = async (
  input: AssignmentRequestInput
): Promise<AssignmentSubmissionResult> => {
  const normalizedUserIds = normalizeUserIds(input.userIds);
  const totalTargets = Math.max(normalizedUserIds.length, 1);

  if (!config.features.useAssignmentsApi) {
    const assignments = await legacyAddAssignments(input.courseId, normalizedUserIds, {
      dueDate: input.dueDate ?? undefined,
      note: input.note ?? undefined,
      assignedBy: input.assignedBy ?? undefined,
      organizationId: input.organizationId,
    });
    return { status: 'sent', requestId: 'legacy-direct-write', count: assignments.length, assignments };
  }

  const identifiers = buildRequestIdentifiers(input);

  try {
    const serverRows = await adminAssignCourse(input.courseId, {
      organizationId: input.organizationId,
      userIds: normalizedUserIds,
      dueAt: input.dueDate ?? null,
      note: input.note ?? null,
      assignedBy: input.assignedBy ?? null,
      idempotencyKey: identifiers.idempotencyKey,
      clientRequestId: identifiers.clientRequestId,
      metadata: {
        ...input.metadata,
        mode: input.mode,
        source: input.metadata?.source ?? 'admin_modal',
      },
    });
    const assignments = mapAssignmentsFromApiRows(Array.isArray(serverRows) ? serverRows : []);
    const count = assignments.length > 0 ? assignments.length : totalTargets;
    return { status: 'sent', requestId: identifiers.idempotencyKey, count, assignments };
  } catch (error) {
    if (!shouldQueueError(error)) {
      throw error;
    }

    const queued = enqueueAssignmentRequest({
      ...input,
      userIds: normalizedUserIds,
      idempotencyKey: identifiers.idempotencyKey,
      clientRequestId: identifiers.clientRequestId,
    });
    return { status: 'queued', requestId: queued.id, count: totalTargets };
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processAssignmentQueue();
  });

  if (assignmentQueue.length > 0) {
    // Process any previously queued requests shortly after hydration
    setTimeout(() => {
      void processAssignmentQueue();
    }, 1000);
  }
}
