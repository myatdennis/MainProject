import type { Survey } from '../types/survey';
import { request } from './http';

type SurveyApiRecord = any;

const ensureStringArray = (value?: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          const possibleId = (entry as Record<string, any>).id ?? (entry as Record<string, any>).value;
          return possibleId ? String(possibleId) : undefined;
        }
        return String(entry);
      })
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  if (typeof value === 'number') {
    return [String(value)];
  }
  return [];
};

const normalizeAssignedTo = (raw: any): NonNullable<Survey['assignedTo']> => ({
  organizationIds: ensureStringArray(raw?.organizationIds ?? raw?.organization_ids),
  userIds: ensureStringArray(raw?.userIds ?? raw?.user_ids),
  departmentIds: ensureStringArray(raw?.departmentIds ?? raw?.department_ids),
  cohortIds: ensureStringArray(raw?.cohortIds ?? raw?.cohort_ids),
});

const mapSurveyRecord = (record: SurveyApiRecord): Survey => ({
  id: record.id,
  title: record.title,
  description: record.description ?? '',
  type: record.type ?? 'custom',
  status: record.status ?? 'draft',
  version: record.version ?? 1,
  sections: record.sections ?? [],
  blocks: record.blocks ?? [],
  branding: record.branding ?? {},
  settings: record.settings ?? {},
  assignedTo: normalizeAssignedTo(record.assignedTo ?? record.assigned_to ?? {}),
  createdBy: record.createdBy ?? record.created_by ?? 'system',
  createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
  updatedAt: record.updatedAt ?? record.updated_at ?? new Date().toISOString(),
  defaultLanguage: record.defaultLanguage ?? record.default_language ?? 'en',
  supportedLanguages: record.supportedLanguages ?? record.supported_languages ?? ['en'],
  completionSettings:
    record.completionSettings ??
    record.completion_settings ?? {
      thankYouMessage: 'Thank you for completing our survey!',
      showResources: true,
      recommendedCourses: [],
    },
  reflectionPrompts: record.reflectionPrompts ?? record.reflection_prompts ?? [],
});

const buildAssignedToPayload = (assignedTo?: Survey['assignedTo']) => ({
  organizationIds: ensureStringArray(assignedTo?.organizationIds),
  userIds: ensureStringArray(assignedTo?.userIds),
  departmentIds: ensureStringArray(assignedTo?.departmentIds),
  cohortIds: ensureStringArray(assignedTo?.cohortIds),
});

const buildSurveyPayload = (survey: Survey) => {
  const assignedTo = buildAssignedToPayload(survey.assignedTo);
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description ?? '',
    type: (survey as any).type ?? 'custom',
    status: survey.status ?? 'draft',
    sections: survey.sections ?? [],
    blocks: survey.blocks ?? [],
    branding: survey.branding ?? {},
    settings: survey.settings ?? {},
    defaultLanguage: (survey as any).defaultLanguage ?? 'en',
    supportedLanguages: (survey as any).supportedLanguages ?? ['en'],
    completionSettings:
      (survey as any).completionSettings ?? {
        thankYouMessage: 'Thank you for completing our survey!',
        showResources: true,
        recommendedCourses: [],
      },
    reflectionPrompts: survey.reflectionPrompts ?? [],
    assignedTo,
    organizationIds: assignedTo.organizationIds,
  };
};

// Mock analytics; replace with real aggregation queries later
export async function getAnalytics(surveyId: string) {
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

export async function listSurveys(): Promise<Survey[]> {
  const json = await request<{ data: SurveyApiRecord[] }>('/api/admin/surveys');
  return (json?.data ?? []).map(mapSurveyRecord);
}

export async function saveSurvey(survey: Survey) {
  const json = await request<{ data: SurveyApiRecord }>('/api/admin/surveys', {
    method: 'POST',
    body: JSON.stringify(buildSurveyPayload(survey)),
  });

  return mapSurveyRecord(json.data);
}

export type SurveyPatch = Partial<Survey> & { organizationIds?: string[] };

export async function updateSurvey(id: string, patch: SurveyPatch) {
  const payload = {
    ...patch,
    organizationIds: patch.organizationIds ?? patch.assignedTo?.organizationIds,
  };

  const json = await request<{ data: SurveyApiRecord }>(`/api/admin/surveys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return mapSurveyRecord(json.data);
}

export async function updateSurveyAssignments(id: string, organizationIds: string[]) {
  return updateSurvey(id, { organizationIds });
}

export async function deleteSurvey(id: string) {
  await request(`/api/admin/surveys/${id}`, { method: 'DELETE' });
}

// Batched save queue: collects surveys and flushes periodically
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
  const itemsToFlush = saveQueue.splice(0, saveQueue.length);
  try {
    await Promise.all(itemsToFlush.map(saveSurvey));
    lastFlushAt = new Date().toISOString();
    surveyQueueEvents.dispatchEvent(
      new CustomEvent('flush', { detail: { count: itemsToFlush.length, at: lastFlushAt } }),
    );
  } catch (err) {
    console.warn('flushQueue exception:', err);
  }
};

export async function queueSaveSurvey(survey: Survey) {
  try {
    const idx = saveQueue.findIndex((s) => s.id === survey.id);
    if (idx >= 0) saveQueue[idx] = survey;
    else saveQueue.push(survey);

    surveyQueueEvents.dispatchEvent(new CustomEvent('queuechange'));
    scheduleFlush();
    return survey;
  } catch (err) {
    console.warn('queueSaveSurvey error:', err);
    return null;
  }
}

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

export async function getSurveyById(id: string) {
  try {
    const json = await request<{ data: any }>(`/api/admin/surveys/${id}`);
    return json.data ? mapSurveyRecord(json.data) : null;
  } catch (err) {
    console.warn('getSurveyById error:', err);
    return null;
  }
}
