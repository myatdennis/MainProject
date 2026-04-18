import { wsClient } from './wsClient';
import { getActiveSession } from '../lib/sessionGate';
import {
  invalidateAssignedSurveysForLearnerCache,
  fetchAssignedSurveysForLearner,
} from '../dal/surveys';
import orgService from './orgService';
import { debounce } from '../utils/debounce';

// Lightweight realtime handler to keep learner/admin surfaces fresh.
// - Subscribes to assignment and course topics relevant to the current session.
// - On assignment events: invalidate learner assigned-surveys cache and trigger a refresh.
// - On course/assignment org-level events: invalidate org list cache so admin pages refresh.

let initialized = false;

// Debounced, centralized refresh to avoid UI thrash when many realtime events arrive.
const debouncedSurveyRefresh = debounce(() => {
  try {
    invalidateAssignedSurveysForLearnerCache();
    // fire-and-forget; caller doesn't need to await
    void fetchAssignedSurveysForLearner({ forceRefresh: true }).catch(() => {});
  } catch (err) {
    // swallow errors here; callers should not be blocked by refresh failures
    console.warn('[realtimeHandlers] debouncedSurveyRefresh failed', err);
  }
}, 300);

// Lightweight burst protection to dedupe micro-bursts of identical events
let lastAssignmentEventTs = 0;
function handleAssignmentEvent(_event?: any) {
  const now = Date.now();
  // If events arrive within 100ms of each other, ignore the later ones
  if (now - lastAssignmentEventTs < 100) return;
  lastAssignmentEventTs = now;
  debouncedSurveyRefresh();
}

export function initRealtimeHandlers() {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  const session = getActiveSession();
  const userId = session?.id ? String(session.id).trim().toLowerCase() : null;
  const orgCandidates: string[] = [];
  if (session && (session as any).activeOrgId) orgCandidates.push(String((session as any).activeOrgId));
  if (session && Array.isArray((session as any).organizationIds)) {
    for (const o of (session as any).organizationIds) {
      if (o) orgCandidates.push(String(o));
    }
  }

  try {
    wsClient.connect();
  } catch (err) {
    console.warn('[realtimeHandlers] ws connect failed', err);
  }

  // Subscribe to per-user assignment topics so learners get immediate updates
  if (userId) {
    const topic = `assignment:user:${userId}`;
    try {
      wsClient.subscribeTopic(topic);
    } catch (err) {
      console.warn('[realtimeHandlers] subscribeTopic failed', topic, err);
    }
  }

  // Subscribe to org-scoped topics
  for (const orgId of orgCandidates) {
    if (!orgId) continue;
    try {
      wsClient.subscribeTopic(`assignment:org:${orgId}`);
      wsClient.subscribeTopic(`course:updates:${orgId}`);
      wsClient.subscribeTopic(`notifications:org:${orgId}`);
    } catch (err) {
      console.warn('[realtimeHandlers] subscribeTopic failed for org', orgId, err);
    }
  }

  // Global handlers
  wsClient.on('event', (payload: any) => {
    if (!payload || typeof payload !== 'object') return;
    const { type, topic } = payload as { type?: string; topic?: string };

    // Assignment created/updated -> refresh learner assigned surveys
    if (type && typeof type === 'string' && type.startsWith('assignment_')) {
      try {
        handleAssignmentEvent(payload);
      } catch (err) {
        console.warn('[realtimeHandlers] assignment event handler failed', err);
      }
    }

    // Course updates or org-level assignment broadcasts should cause admin org list to refresh
    if (type === 'course_updated' || (topic && typeof topic === 'string' && topic.startsWith('course:updates')) || (topic && topic.startsWith('assignment:org'))) {
      try {
        // Naive: invalidate all org list cache keys so admin pages refetch their data
        orgService.invalidateOrgListCache();
      } catch (err) {
        console.warn('[realtimeHandlers] org invalidation failed', err);
      }
    }
  });

  // Also listen for direct typed events if some handlers prefer them
  wsClient.on('assignment_created', (_payload: any) => {
    try {
      handleAssignmentEvent(_payload);
    } catch (err) {
      console.warn('[realtimeHandlers] assignment_created listener failed', err);
    }
  });

  wsClient.on('assignment_updated', (_payload: any) => {
    try {
      handleAssignmentEvent(_payload);
    } catch (err) {
      console.warn('[realtimeHandlers] assignment_updated listener failed', err);
    }
  });

  wsClient.on('course_updated', (_payload: any) => {
    try {
      orgService.invalidateOrgListCache();
    } catch (err) {
      console.warn('[realtimeHandlers] course_updated listener failed', err);
    }
  });

  // When wsClient disables realtime (e.g., backend unavailable), we fall back to periodic polling elsewhere in the app.
}

export default {
  initRealtimeHandlers,
};
