import { getSupabase, hasSupabaseConfig } from '../lib/supabase';
import { request } from './http';
const mapSurveyRecord = (record) => ({
    id: record.id,
    title: record.title,
    description: record.description ?? '',
    status: record.status ?? 'draft',
    sections: record.sections ?? [],
    branding: record.branding ?? {},
    settings: record.settings ?? {},
    assignedTo: record.assigned_to && typeof record.assigned_to === 'object'
        ? record.assigned_to
        : { organizationIds: [], userIds: [], cohortIds: [] },
    createdBy: record.created_by ?? 'system',
    createdAt: record.created_at ?? new Date().toISOString(),
    updatedAt: record.updated_at ?? new Date().toISOString(),
    blocks: record.blocks ?? [],
    defaultLanguage: record.default_language ?? 'en',
    supportedLanguages: record.supported_languages ?? ['en'],
    completionSettings: record.completion_settings ?? {
        thankYouMessage: 'Thank you for completing our survey!',
        showResources: true,
        recommendedCourses: [],
    },
    reflectionPrompts: record.reflection_prompts ?? [],
});
export async function getAssignments(surveyId) {
    try {
        if (!hasSupabaseConfig)
            return null;
        const supabase = await getSupabase();
        if (!supabase)
            return null;
        const { data, error } = await supabase
            .from('survey_assignments')
            .select('*')
            .eq('survey_id', surveyId)
            .limit(1)
            .single();
        if (error) {
            console.warn('getAssignments supabase error:', error.message || error);
            return null;
        }
        return data;
    }
    catch (err) {
        console.warn('getAssignments exception:', err);
        return null;
    }
}
export async function saveAssignments(surveyId, organizationIds) {
    try {
        if (!hasSupabaseConfig)
            return null;
        const supabase = await getSupabase();
        if (!supabase)
            return null;
        const payload = {
            survey_id: surveyId,
            organization_ids: organizationIds,
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('survey_assignments').upsert(payload).select();
        if (error) {
            console.warn('saveAssignments supabase error:', error.message || error);
            return null;
        }
        return data;
    }
    catch (err) {
        console.warn('saveAssignments exception:', err);
        return null;
    }
}
// Mock analytics; replace with real aggregation queries later
export async function getAnalytics(surveyId) {
    return {
        surveyId,
        title: 'Mock Survey Analytics',
        totalResponses: 180,
        completionRate: 78,
        avgCompletionTime: 13,
        questionSummaries: [
            { questionId: 'belonging-1', avgScore: 3.8 },
            { questionId: 'safety-1', avgScore: 3.6 },
        ],
        insights: [
            'Belonging scores above average in Engineering',
            'New hires report lower psychological safety',
        ],
    };
}
export async function saveSurvey(survey) {
    const payload = {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        sections: survey.sections,
        branding: survey.branding,
        settings: survey.settings,
        assignedTo: survey.assignedTo ?? [],
    };
    const json = await request('/api/admin/surveys', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return mapSurveyRecord(json.data);
}
// Batched save queue: collects surveys and flushes periodically
const saveQueue = [];
let flushTimer = null;
const FLUSH_INTERVAL = 3000; // ms
const scheduleFlush = () => {
    if (flushTimer)
        return;
    flushTimer = window.setTimeout(async () => {
        flushTimer = null;
        await flushQueue();
    }, FLUSH_INTERVAL);
};
const flushQueue = async () => {
    if (saveQueue.length === 0)
        return;
    const itemsToFlush = saveQueue.splice(0, saveQueue.length);
    try {
        await Promise.all(itemsToFlush.map(saveSurvey));
        lastFlushAt = new Date().toISOString();
        surveyQueueEvents.dispatchEvent(new CustomEvent('flush', { detail: { count: itemsToFlush.length, at: lastFlushAt } }));
    }
    catch (err) {
        console.warn('flushQueue exception:', err);
    }
};
export async function queueSaveSurvey(survey) {
    try {
        const idx = saveQueue.findIndex((s) => s.id === survey.id);
        if (idx >= 0)
            saveQueue[idx] = survey;
        else
            saveQueue.push(survey);
        surveyQueueEvents.dispatchEvent(new CustomEvent('queuechange'));
        scheduleFlush();
        return survey;
    }
    catch (err) {
        console.warn('queueSaveSurvey error:', err);
        return null;
    }
}
let lastFlushAt = null;
export const surveyQueueEvents = new EventTarget();
export const getQueueSnapshot = () => {
    return [...saveQueue];
};
export const getQueueLength = () => saveQueue.length;
export const getLastFlushTime = () => lastFlushAt;
export const flushNow = async () => {
    if (flushTimer) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
    }
    await flushQueue();
};
export async function getSurveyById(id) {
    try {
        const json = await request(`/api/admin/surveys/${id}`);
        return json.data ? mapSurveyRecord(json.data) : null;
    }
    catch (err) {
        console.warn('getSurveyById error:', err);
        return null;
    }
}
