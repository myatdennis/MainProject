import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import type { Survey } from '../types/survey';
import apiRequest, { type ApiRequestOptions } from '../utils/apiClient';

const apiFetch = async <T>(path: string, options: ApiRequestOptions = {}) =>
  apiRequest<T>(path, options);

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
    if (!hasSupabaseConfig) return null;
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from('survey_assignments').select('*').eq('survey_id', surveyId).limit(1).single();
    if (error) {
      console.warn('getAssignments supabase error:', error.message || error);
      return null;
    }
    return data as SurveyAssignment;
  } catch (err) {
    console.warn('getAssignments exception:', err);
    return null;
  }
};

export const saveAssignments = async (surveyId: string, organizationIds: string[]) => {
  try {
    if (!hasSupabaseConfig) return null;
    const supabase = await getSupabase();
    if (!supabase) return null;
    const payload = {
      survey_id: surveyId,
      organization_ids: organizationIds,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('survey_assignments').upsert(payload).select();
    if (error) {
      console.warn('saveAssignments supabase error:', error.message || error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('saveAssignments exception:', err);
    return null;
  }
};

// Mock analytics; later replace with real aggregation queries
export const getAnalytics = async (surveyId: string) => {
  // If supabase is configured, you would query response tables and aggregate.
  // For now, return a mocked analytics object.
  return {
    surveyId,
    title: 'Mock Survey Analytics',
    totalResponses: 180,
    completionRate: 78,
    avgCompletionTime: 13,
    questionSummaries: [
      { questionId: 'belonging-1', avgScore: 3.8 },
      { questionId: 'safety-1', avgScore: 3.6 }
    ],
    insights: [
      'Belonging scores above average in Engineering',
      'New hires report lower psychological safety'
    ]
  };
};

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
    body: JSON.stringify(payload)
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
  orgId: string,
  options: FetchAssignedSurveysOptions = {}
): Promise<Survey[]> => {
  if (!orgId) {
    throw new Error('orgId is required to fetch assigned surveys');
  }

  const params = new URLSearchParams();
  params.set('orgId', orgId);
  if (options.status) {
    params.set('status', options.status);
  }
  if (options.userId) {
    params.set('userId', options.userId);
  }

  const path = `/api/client/surveys?${params.toString()}`;
  try {
    const json = await apiFetch<{ data: any[] }>(path, { noTransform: true });
    const surveys = (json.data || []).map(mapSurveyRecord);
    return surveys.filter((survey) => {
      const assignments = survey.assignedTo;
      if (assignments?.organizationIds?.length && !assignments.organizationIds.includes(orgId)) {
        return false;
      }
      if (options.userId && assignments?.userIds?.length && !assignments.userIds.includes(options.userId)) {
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('[surveyService.fetchAssignedSurveys] Failed to load surveys for org:', error);
    return [];
  }
};
