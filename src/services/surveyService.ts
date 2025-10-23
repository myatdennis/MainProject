import { supabase } from '../lib/supabase';
import type { Survey } from '../types/survey';

export interface SurveyAssignment {
  id?: string;
  survey_id: string;
  organization_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export const getAssignments = async (surveyId: string): Promise<SurveyAssignment | null> => {
  try {
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
    const sanitizedIds = Array.from(new Set((organizationIds || []).filter(Boolean)));
    const payload = {
      survey_id: surveyId,
      organization_ids: sanitizedIds,
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
export const getAnalytics = async (surveyId: string, organizationId?: string) => {
  const supabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  if (supabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('fetch_survey_summary', {
        survey_identifier: surveyId,
        target_org: organizationId ?? null,
      });

      if (!error && data) {
        return data;
      }

      if (error) {
        console.warn('fetch_survey_summary rpc error, falling back to local analytics', error);
      }
    } catch (rpcError) {
      console.warn('fetch_survey_summary rpc exception, using fallback analytics', rpcError);
    }
  }

  return {
    surveyId,
    title: 'Mock Survey Analytics',
    totalResponses: 0,
    completionRate: 0,
    avgCompletionTime: 0,
    questionSummaries: [],
    insights: ['Real-time analytics will appear once responses are collected.'],
  };
};

// Local persistence helpers for development when Supabase is not configured
export const saveSurvey = async (survey: Survey) => {
  try {
    const key = 'local_surveys';
    const raw = localStorage.getItem(key);
    const items: Survey[] = raw ? JSON.parse(raw) : [];
    const idx = items.findIndex(s => s.id === survey.id);
    if (idx >= 0) items[idx] = survey;
    else items.push(survey);
    localStorage.setItem(key, JSON.stringify(items));
    return survey;
  } catch (err) {
    console.warn('saveSurvey error:', err);
    return null;
  }
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

  // ensure localStorage is up-to-date
  try {
    const key = 'local_surveys';
    const raw = localStorage.getItem(key);
    const existing: Survey[] = raw ? JSON.parse(raw) : [];
    // merge/replace by id
    itemsToFlush.forEach(survey => {
      const idx = existing.findIndex(e => e.id === survey.id);
      if (idx >= 0) existing[idx] = survey;
      else existing.push(survey);
    });
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.warn('flushQueue local merge failed', err);
  }

  // If Supabase not configured, nothing more to do
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured - flushQueue saved to localStorage only');
    return;
  }

  // Attempt to upsert all surveys to Supabase in a single batch where possible
  try {
    // Supabase upsert supports array of objects
    const upsertPayload = itemsToFlush.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      type: s.type,
      status: s.status,
      sections: s.sections,
      branding: s.branding,
      settings: s.settings,
      assigned_to: s.assignedTo,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('surveys').upsert(upsertPayload);
    if (error) {
      console.warn('flushQueue supabase upsert error:', error);
    } else {
      console.log(`Flushed ${upsertPayload.length} surveys to Supabase`);
    }
    lastFlushAt = new Date().toISOString();
    surveyQueueEvents.dispatchEvent(new CustomEvent('flush', { detail: { count: upsertPayload.length, at: lastFlushAt } }));
  } catch (err) {
    console.warn('flushQueue exception:', err);
  }
};

export const queueSaveSurvey = async (survey: Survey) => {
  try {
    // Immediately write to localStorage for local-first behavior
    await saveSurvey(survey);

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
    const key = 'local_surveys';
    const raw = localStorage.getItem(key);
    const items: Survey[] = raw ? JSON.parse(raw) : [];
    return items.find(s => s.id === id) || null;
  } catch (err) {
    console.warn('getSurveyById error:', err);
    return null;
  }
};
