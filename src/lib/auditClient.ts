import authorizedFetch from './authorizedFetch';
import { supabase } from './supabaseClient';

export type AuditEvent = {
  action: string;
  details?: Record<string, any>;
  timestamp?: string;
};

const STORAGE_KEY = 'thc.auditQueue';
let queue: Required<AuditEvent>[] = [];
let loaded = false;
let flushing = false;

const loadQueue = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        queue = parsed.filter((item) => item && typeof item.action === 'string');
      }
    }
  } catch (error) {
    console.warn('[auditClient] Failed to load queue', error);
  }
};

const persistQueue = () => {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      window.sessionStorage?.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.warn('[auditClient] Failed to persist queue', error);
  }
};

export const enqueueAudit = (event: AuditEvent) => {
  if (!event?.action) {
    return;
  }
  loadQueue();
  const payload: Required<AuditEvent> = {
    action: event.action,
    details: event.details ?? {},
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  queue.push(payload);
  persistQueue();
  void flushAuditQueue();
};

export const flushAuditQueue = async (): Promise<void> => {
  loadQueue();
  if (flushing || queue.length === 0) {
    return;
  }

  let sessionReady = false;
  try {
    const { data, error } = await supabase.auth.getSession();
    sessionReady = Boolean(!error && data?.session?.access_token);
  } catch (error) {
    sessionReady = false;
  }

  if (!sessionReady) {
    return;
  }

  flushing = true;
  try {
    while (queue.length > 0) {
      const event = queue[0];
      try {
        await authorizedFetch('/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        queue.shift();
        persistQueue();
      } catch (error) {
        console.warn('[auditClient] Audit send failed', error);
        return;
      }
    }
  } finally {
    flushing = false;
  }
};
