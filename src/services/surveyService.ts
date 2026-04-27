import type { Survey } from '../types/survey';
import apiRequest from '../utils/apiClient';
import { getAnalytics as getSurveyAnalyticsFromDal } from '../dal/surveys';
import { getGlobalActiveOrgIdForApi, buildScopedApiUrl } from '../lib/orgContext';
import { GLOBAL_ORG_ID } from '../constants/org';

const apiFetch = async <T>(path: string, options: any = {}) => apiRequest<T>(path, options);

const mapSurveyRecord = (record: any): Survey => ({
  id: record.id,
  title: record.title,
  description: record.description ?? '',
  status: record.status ?? 'draft',
  version: record.version ?? 1,
  createdBy: record.createdBy ?? '',
  createdAt: record.createdAt ?? new Date().toISOString(),
  updatedAt: record.updatedAt ?? new Date().toISOString(),
  blocks: record.blocks ?? [],
  sections: record.sections ?? [],
  settings: record.settings ?? {
    anonymityMode: 'anonymous',
    anonymityThreshold: 1,
    allowMultipleResponses: false,
    showProgressBar: false,
    consentRequired: false,
    allowAnonymous: false,
    allowSaveAndContinue: false,
    randomizeQuestions: false,
    randomizeOptions: false,
  },
  branding: record.branding ?? {
    primaryColor: '',
    secondaryColor: '',
    logo: ''
  },
  defaultLanguage: record.defaultLanguage ?? 'en',
  supportedLanguages: record.supportedLanguages ?? ['en'],
  completionSettings: record.completionSettings ?? {
    thankYouMessage: '',
    showResources: false,
    recommendedCourses: []
  },
  assignedTo: record.assignedTo ?? {},
  reflectionPrompts: record.reflectionPrompts ?? []
});

export interface FetchAssignedSurveysOptions {
  status?: 'published' | 'draft';
  userId?: string;
}

export interface SurveyAssignment {
  id?: string;
  survey_id: string;
  organization_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export const getAssignments = async (surveyId: string): Promise<SurveyAssignment | null> => {
  try {
    // Read assignments via backend API (server is the single source of truth and enforces RLS/claims).
    const json = await apiRequest<{ data?: any[] }>(`/api/admin/surveys/${surveyId}/assignments`);
    const rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length === 0) return null;
    return rows[0] as SurveyAssignment;
  } catch (err) {
    console.warn('getAssignments exception:', err);
    return null;
  }
};

export const saveAssignments = async (surveyId: string, organizationIds: string[]) => {
  try {
    // Persist assignments via backend API so server-side policies and auditing run.
    const body = {
      organizationIds: Array.isArray(organizationIds) ? organizationIds : [],
    };
    const json = await apiRequest<{ data?: any[] }>(`/api/admin/surveys/${surveyId}/assign`, {
      method: 'POST',
      body,
    });
    return json.data ?? null;
  } catch (err) {
    console.warn('saveAssignments exception:', err);
    return null;
  }
};

export const getAnalytics = async (surveyId: string, options: { organizationId?: string } = {}) =>
  getSurveyAnalyticsFromDal(surveyId, options);

export const saveSurvey = async (survey: Survey) => {
  const payload = {
    id: survey.id,
    title: survey.title,
    description: survey.description,
  // type: survey.type,
    status: survey.status,
    sections: survey.sections,
    branding: survey.branding,
    settings: survey.settings,
    assignedTo: survey.assignedTo ?? []
  };

  const json = await apiFetch<{ data: any }>('/api/admin/surveys', {
    method: 'POST',
    body: payload
  });

  return mapSurveyRecord(json.data);
};

// Batched save queue: collects surveys and flushes to Supabase periodically when configured.
const saveQueue: Survey[] = [];
let flushTimer: number | null = null;
const FLUSH_INTERVAL = 3000; // ms

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    await flushQueue();
  }, FLUSH_INTERVAL) as unknown as number;
};

const flushQueue = async () => {
  if (saveQueue.length === 0) return;
  // take snapshot
  const itemsToFlush = saveQueue.splice(0, saveQueue.length);

  try {
    await Promise.all(itemsToFlush.map(saveSurvey));
    lastFlushAt = new Date().toISOString();
    surveyQueueEvents.dispatchEvent(new CustomEvent('flush', { detail: { count: itemsToFlush.length, at: lastFlushAt } }));
  } catch (err) {
    console.warn('flushQueue exception:', err);
  }
};

export const queueSaveSurvey = async (survey: Survey) => {
  try {
    // Add to queue (replace if exists)
    const idx = saveQueue.findIndex(s => s.id === survey.id);
    if (idx >= 0) saveQueue[idx] = survey;
    else saveQueue.push(survey);

    scheduleFlush();
    return survey;
  } catch (err) {
    console.warn('queueSaveSurvey error:', err);
    return null;
  }
};

// Queue status helpers & events
let lastFlushAt: string | null = null;
export const surveyQueueEvents = new EventTarget();

export const getQueueSnapshot = () => {
  return [...saveQueue];
};

export const getQueueLength = () => saveQueue.length;

export const getLastFlushTime = () => lastFlushAt;

export const flushNow = async () => {
  if (flushTimer) {
    window.clearTimeout(flushTimer as number);
    flushTimer = null;
  }
  await flushQueue();
};


export const getSurveyById = async (id: string) => {
  try {
    const json = await apiFetch<{ data: any }>(`/api/admin/surveys/${id}`);
    return json.data ? mapSurveyRecord(json.data) : null;
  } catch (err) {
    console.warn('getSurveyById error:', err);
    return null;
  }
};

export const fetchAssignedSurveys = async (
  // Frontend must not supply orgId; server infers org context from session.
  options: FetchAssignedSurveysOptions = {}
): Promise<Survey[]> => {
  const params = new URLSearchParams();
  if (options.status) {
    params.set('status', options.status);
  }
  if (options.userId) {
    params.set('userId', options.userId);
  }

  const path = params.toString() ? `/client/surveys?${params.toString()}` : '/client/surveys';
  try {
    const activeOrgId = getGlobalActiveOrgIdForApi();
    const url = buildScopedApiUrl(path, activeOrgId ?? undefined);
    const json = await apiFetch<{ data: any[] }>(url, { noTransform: true });
    let surveys = (json.data || []).map(mapSurveyRecord);

    // Service-layer filtering: when the client is scoped to a concrete org,
    // the backend may still return platform-wide rows for admin users; ensure
    // non-admin users only see their org's surveys.
    if (activeOrgId && activeOrgId !== GLOBAL_ORG_ID) {
      surveys = surveys.filter((survey) => {
        const assignments = survey.assignedTo || {};
        const orgIds: string[] = (assignments?.organizationIds || (assignments as any)?.organization_ids) ?? [];
        if (Array.isArray(orgIds) && orgIds.length > 0) {
          return orgIds.includes(activeOrgId);
        }
        if (options.userId) {
          const userIds: string[] = (assignments?.userIds || (assignments as any)?.user_ids) ?? [];
          if (Array.isArray(userIds) && userIds.length > 0) {
            return userIds.includes(options.userId!);
          }
        }
        // If no explicit assignment info, exclude to be conservative
        return false;
      });
    } else if (options.userId) {
      surveys = surveys.filter((survey) => {
        const assignments = survey.assignedTo || {};
        const userIds: string[] = (assignments?.userIds || (assignments as any)?.user_ids) ?? [];
        if (Array.isArray(userIds) && userIds.length > 0) {
          return userIds.includes(options.userId!);
        }
        return false;
      });
    }

    return surveys;
  } catch (error) {
    console.error('[surveyService.fetchAssignedSurveys] Failed to load surveys for org:', error);
    return [];
  }
};
