import apiRequest, { ApiError } from '../../utils/apiClient';
import type { AnalyticsEvent, LearnerJourney } from '../analyticsService';
import { getAccessToken, getUserSession, getActiveOrgPreference } from '../../lib/secureStorage';

const parseEnvAnalyticsFlag = (): boolean => {
  try {
    const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ENABLE_ANALYTICS : undefined;
    if (raw === undefined || raw === null || raw === '') {
      return true;
    }
    const normalized = String(raw).trim().toLowerCase();
    return !['false', '0', 'off', 'disabled', 'no'].includes(normalized);
  } catch {
    return true;
  }
};

let analyticsEnabled = true;
let analyticsDisabledReason: string | null = null;
let disableLogEmitted = false;
let authWarningLogged = false;
let validationWarningLogged = false;

const disableAnalytics = (reason: string) => {
  if (!analyticsEnabled) {
    analyticsDisabledReason = analyticsDisabledReason ?? reason;
    return;
  }
  analyticsEnabled = false;
  analyticsDisabledReason = reason;
  if (import.meta.env?.DEV) {
    console.info(`[analyticsApiClient] Analytics disabled (${reason}).`);
  }
};

if (!parseEnvAnalyticsFlag()) {
  disableAnalytics('env_override');
}

const hasAuthSession = () => {
  if (typeof window === 'undefined') return false;
  try {
    const token = getAccessToken();
    const session = getUserSession();
    return Boolean(token || session?.id);
  } catch {
    return false;
  }
};

const resolveOrgId = (): string | null => {
  try {
    const preference = getActiveOrgPreference();
    if (preference) {
      return preference;
    }
    const session = getUserSession();
    return session?.activeOrgId || session?.organizationId || null;
  } catch {
    return null;
  }
};

const ensureAnalyticsReady = () => {
  if (!analyticsEnabled) {
    if (import.meta.env?.DEV && !disableLogEmitted) {
      const reason = analyticsDisabledReason ? ` (${analyticsDisabledReason})` : '';
      console.info(`[analyticsApiClient] Analytics disabled${reason}. Skipping network calls.`);
      disableLogEmitted = true;
    }
    return false;
  }
  if (hasAuthSession()) return true;
  if (import.meta.env?.DEV) {
    console.info('[analyticsApiClient] Skipping analytics network call because no authenticated session is available.');
  }
  return false;
};

const logAuthWarning = (status: number, context: string) => {
  if (authWarningLogged) {
    return;
  }
  authWarningLogged = true;
  console.info(
    `[analyticsApiClient] ${context} requires authentication (status ${status}). Events will remain queued locally until a session is available.`,
  );
};

const logValidationWarning = (context: string, payloadSummary?: string) => {
  if (validationWarningLogged) {
    return;
  }
  validationWarningLogged = true;
  const summary = payloadSummary ? `payloadKeys=${payloadSummary}` : 'payloadKeys=none';
  console.warn(`[analyticsApiClient] ${context} payload rejected (400). ${summary}`);
};

const handleAnalyticsFailure = <T>(
  error: unknown,
  fallback: T,
  context: string,
  options?: { payloadSummary?: string },
): T => {
  if (error instanceof ApiError) {
    const status = error.status;
    if (status === 404) {
      disableAnalytics(`${context}:not_found`);
      return fallback;
    }
    if (status === 501 || status === 503) {
      disableAnalytics(`${context}:unavailable_${status}`);
      return fallback;
    }
    if (status === 401 || status === 403) {
      logAuthWarning(status, context);
      return fallback;
    }
    if (status === 400) {
      logValidationWarning(context, options?.payloadSummary);
      return fallback;
    }
  }
  throw error;
};

const summarizePayloadKeys = (payload: Record<string, any> | undefined): string => {
  if (!payload) {
    return 'none';
  }
  const keys = Object.keys(payload);
  if (!keys.length) {
    return 'none';
  }
  return keys.slice(0, 10).join(',');
};

export const isAnalyticsEnabled = (): boolean => analyticsEnabled;

export const analyticsApiClient = {
  fetchEvents: async () => {
    if (!ensureAnalyticsReady()) return { data: [] };
    try {
      return await apiRequest<{ data: any[] }>('/api/analytics/events');
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchEvents');
    }
  },
  fetchJourneys: async () => {
    if (!ensureAnalyticsReady()) return { data: [] };
    try {
      return await apiRequest<{ data: any[] }>('/api/analytics/journeys');
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchJourneys');
    }
  },
  persistEvent: async (event: AnalyticsEvent) => {
    if (!ensureAnalyticsReady()) return;
    try {
      const derivedOrgId = event.orgId ?? resolveOrgId();
      const headers: Record<string, string> | undefined = derivedOrgId
        ? { 'X-Org-Id': derivedOrgId }
        : undefined;

      await apiRequest('/api/analytics/events', {
        method: 'POST',
        headers,
        body: {
          // Server expects org-scoped analytics payloads. Keys map directly
          // onto the analytics_events table: id -> client_event_id, *_id fields,
          // event_type, session_id, user_agent, and payload (arbitrary JSON).
          // Optional fields may be null when not applicable.
          id: event.id,
          user_id: event.userId && event.userId !== 'system' ? event.userId : null,
          org_id: derivedOrgId ?? null,
          course_id: event.courseId ?? null,
          lesson_id: event.lessonId ?? null,
          module_id: event.moduleId ?? null,
          event_type: event.type,
          session_id: event.sessionId,
          user_agent: event.userAgent,
          payload: event.data,
        },
      });
    } catch (error) {
      handleAnalyticsFailure(error, { skipped: true }, 'persistEvent', {
        payloadSummary: summarizePayloadKeys(event.data),
      });
    }
  },
  persistJourney: async (journey: LearnerJourney) => {
    if (!ensureAnalyticsReady()) return;
    try {
      await apiRequest('/api/analytics/journeys', {
        method: 'POST',
        body: {
          user_id: journey.userId,
          course_id: journey.courseId,
          journey: {
            startedAt: journey.startedAt,
            lastActiveAt: journey.lastActiveAt,
            completedAt: journey.completedAt,
            totalTimeSpent: journey.totalTimeSpent,
            sessionsCount: journey.sessionsCount,
            progressPercentage: journey.progressPercentage,
            engagementScore: journey.engagementScore,
            milestones: journey.milestones,
            dropOffPoints: journey.dropOffPoints,
            pathTaken: journey.pathTaken,
          },
        },
      });
    } catch (error) {
      handleAnalyticsFailure(error, { skipped: true }, 'persistJourney', {
        payloadSummary: summarizePayloadKeys(journey ? (journey as Record<string, any>) : undefined),
      });
    }
  },
  fetchCourseEngagement: async () => {
    if (!ensureAnalyticsReady()) return { data: [] };
    try {
      return await apiRequest<{ data: { course_id: string; avg_progress: number; active_users: number }[] }>(
        '/api/analytics/course-engagement'
      );
    } catch (error) {
      return handleAnalyticsFailure(error, { data: [] }, 'fetchCourseEngagement');
    }
  },
};
