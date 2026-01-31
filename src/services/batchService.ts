import apiRequest from '../utils/apiClient';

// Types for progress and analytics events
export type ProgressEvent = {
  type: 'lesson_progress' | 'lesson_completed' | 'course_progress' | 'course_completed';
  courseId?: string;
  courseSlug?: string;
  lessonId?: string;
  userId: string;
  percent?: number; // 0..100
  position?: number; // seconds
  status?: string;
  time_spent_s?: number;
  clientEventId: string;
  timestamp: number;
};

export type AnalyticsEvent = {
  type: string;
  courseId?: string;
  userId?: string;
  data?: any;
  clientEventId: string;
  timestamp: number;
};

// Internal queues
const progressQueue: ProgressEvent[] = [];
const analyticsQueue: AnalyticsEvent[] = [];

// Timers
let progressTimer: number | null = null;
let analyticsTimer: number | null = null;

// Backoff state
let progressBackoffMs = 0;
let analyticsBackoffMs = 0;

const now = () => Date.now();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `evt_${now()}_${Math.random().toString(36).slice(2)}`);

export function enqueueProgress(input: Omit<ProgressEvent, 'clientEventId' | 'timestamp'> & { clientEventId?: string; timestamp?: number }) {
  const evt: ProgressEvent = {
    ...input,
    clientEventId: input.clientEventId || uid(),
    timestamp: input.timestamp || now(),
    percent: typeof input.percent === 'number' ? Math.min(100, Math.max(0, Math.round(input.percent))) : input.percent,
  };
  progressQueue.push(evt);
  scheduleProgressFlush();
  return evt.clientEventId;
}

export function enqueueAnalytics(input: Omit<AnalyticsEvent, 'clientEventId' | 'timestamp'> & { clientEventId?: string; timestamp?: number }) {
  const evt: AnalyticsEvent = {
    ...input,
    clientEventId: input.clientEventId || uid(),
    timestamp: input.timestamp || now(),
  };
  analyticsQueue.push(evt);
  scheduleAnalyticsFlush();
  return evt.clientEventId;
}

function scheduleProgressFlush() {
  if (typeof window === 'undefined') return;
  if (progressQueue.length >= 10) {
    void flushProgress();
    return;
  }
  if (progressTimer) window.clearTimeout(progressTimer);
  const delay = progressBackoffMs > 0 ? progressBackoffMs : 5000; // 5s default
  progressTimer = window.setTimeout(() => {
    progressTimer = null;
    void flushProgress();
  }, delay);
}

function scheduleAnalyticsFlush() {
  if (typeof window === 'undefined') return;
  if (analyticsQueue.length >= 8) {
    void flushAnalytics();
    return;
  }
  if (analyticsTimer) window.clearTimeout(analyticsTimer);
  const delay = analyticsBackoffMs > 0 ? analyticsBackoffMs : 3000; // 3s default
  analyticsTimer = window.setTimeout(() => {
    analyticsTimer = null;
    void flushAnalytics();
  }, delay);
}

export async function flushProgress() {
  if (progressQueue.length === 0) return;
  const batch = progressQueue.splice(0, Math.min(progressQueue.length, 25));
  try {
    const res = await apiRequest<{ accepted: string[]; duplicates?: string[]; failed?: Array<{ id: string; reason: string }> }>(
      '/api/client/progress/batch',
      { method: 'POST', body: { events: batch }, timeoutMs: 10000 }
    );
    // On partial failure, requeue failed items with backoff
    const failed = (res.failed || []).map((f) => f.id);
    if (failed.length > 0) {
      const map = new Map(batch.map((e) => [e.clientEventId, e] as const));
      failed.forEach((id) => {
        const evt = map.get(id);
        if (evt) progressQueue.unshift(evt);
      });
      progressBackoffMs = nextBackoff(progressBackoffMs);
      scheduleProgressFlush();
    } else {
      progressBackoffMs = 0; // reset on success
    }
  } catch (err) {
    // Network or server error: requeue and backoff
    progressQueue.unshift(...batch);
    progressBackoffMs = nextBackoff(progressBackoffMs);
    scheduleProgressFlush();
  }
}

export async function flushAnalytics() {
  if (analyticsQueue.length === 0) return;
  const batch = analyticsQueue.splice(0, Math.min(analyticsQueue.length, 50));
  try {
    const res = await apiRequest<{ accepted: string[]; duplicates?: string[]; failed?: Array<{ id: string; reason: string }> }>(
      '/api/analytics/events/batch',
      { method: 'POST', body: { events: batch }, timeoutMs: 10000 }
    );
    const failed = (res.failed || []).map((f) => f.id);
    if (failed.length > 0) {
      const map = new Map(batch.map((e) => [e.clientEventId, e] as const));
      failed.forEach((id) => {
        const evt = map.get(id);
        if (evt) analyticsQueue.unshift(evt);
      });
      analyticsBackoffMs = nextBackoff(analyticsBackoffMs);
      scheduleAnalyticsFlush();
    } else {
      analyticsBackoffMs = 0;
    }
  } catch (err) {
    analyticsQueue.unshift(...batch);
    analyticsBackoffMs = nextBackoff(analyticsBackoffMs);
    scheduleAnalyticsFlush();
  }
}

function nextBackoff(current: number) {
  const base = current > 0 ? Math.min(current * 2, 30000) : 2000; // cap at 30s
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

// Visibility/unload flush
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushProgress();
      void flushAnalytics();
    }
  });
  window.addEventListener('beforeunload', () => {
    // Fire-and-forget; best-effort flush
    void flushProgress();
    void flushAnalytics();
  });
}

export const batchService = {
  enqueueProgress,
  enqueueAnalytics,
  flushProgress,
  flushAnalytics,
};
