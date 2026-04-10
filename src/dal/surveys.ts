import type { Survey } from '../types/survey';
import type { CourseAssignment } from '../types/assignment';
import { request } from './http';
import { mapAssignmentsFromApiRows } from '../utils/assignmentStorage';
import { buildOrgHeaders } from '../utils/orgHeaders';

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
  assignmentRows: mapAssignmentsFromApiRows(record.assignmentRows ?? record.assignment_rows ?? []),
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
    body: buildSurveyPayload(survey),
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
    body: payload,
  });

  return mapSurveyRecord(json.data);
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

export type AssignSurveyPayload = {
  organizationIds?: string[];
  userIds?: string[];
  dueAt?: string | null;
  note?: string | null;
  assignedBy?: string | null;
  metadata?: Record<string, any>;
};

const normalizeIdList = (values?: string[]) =>
  Array.isArray(values)
    ? values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    : [];

export async function assignSurvey(surveyId: string, payload: AssignSurveyPayload) {
  const body: Record<string, unknown> = {};
  const organizationIds = normalizeIdList(payload.organizationIds);
  const userIds = normalizeIdList(payload.userIds);
  if (organizationIds.length) {
    body.organizationIds = organizationIds;
  }
  if (userIds.length) {
    body.userIds = userIds;
  }
  if (payload.dueAt !== undefined) {
    body.dueAt = payload.dueAt;
  }
  if (payload.note !== undefined) {
    body.note = payload.note;
  }
  if (payload.assignedBy) {
    body.assignedBy = payload.assignedBy;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  const json = await request<{ data: any[] }>(`/api/admin/surveys/${surveyId}/assign`, {
    method: 'POST',
    body,
  });
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchSurveyAssignments(
  surveyId: string,
  options: { organizationId?: string; active?: boolean } = {},
): Promise<CourseAssignment[]> {
  const params = new URLSearchParams();
  if (options.organizationId) {
    params.set('orgId', options.organizationId);
  }
  if (typeof options.active === 'boolean') {
    params.set('active', options.active ? 'true' : 'false');
  }
  const path = params.toString()
    ? `/api/admin/surveys/${surveyId}/assignments?${params.toString()}`
    : `/api/admin/surveys/${surveyId}/assignments`;
  const json = await request<{ data: any[] }>(path);
  return mapAssignmentsFromApiRows(json.data ?? []);
}

export async function deleteSurveyAssignment(surveyId: string, assignmentId: string, opts?: { hard?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.hard) params.set('hard', 'true');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  await request(`/api/admin/surveys/${surveyId}/assignments/${assignmentId}${suffix}`, { method: 'DELETE' });
}

export type LearnerSurveyAssignment = {
  assignment: CourseAssignment;
  survey: Survey | null;
};

export async function fetchAssignedSurveysForLearner(): Promise<LearnerSurveyAssignment[]> {
  type AssignedResponse = {
    data: Array<{ assignment: any; survey?: any }>;
    meta?: { hydrationPending?: boolean };
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let lastJson: AssignedResponse | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const json = await request<AssignedResponse>('/api/client/surveys/assigned', {
      headers: buildOrgHeaders(),
    });
    lastJson = json;
    const entries = Array.isArray(json.data) ? json.data : [];
    const hydrationPending = Boolean(json.meta?.hydrationPending);
    if (entries.length > 0 || !hydrationPending) {
      break;
    }
    await sleep(600);
  }

  const entries = Array.isArray(lastJson?.data) ? lastJson!.data : [];
  return entries
    .map((entry) => {
      const assignment = mapAssignmentsFromApiRows(entry.assignment ? [entry.assignment] : [])?.[0];
      const survey = entry.survey ? mapSurveyRecord(entry.survey) : null;
      if (!assignment) return null;
      return { assignment, survey };
    })
    .filter((entry): entry is LearnerSurveyAssignment => Boolean(entry));
}

export async function fetchHdiParticipantReport(
  surveyId: string,
  params: { orgId?: string; participant?: string; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.orgId) query.set('orgId', params.orgId);
  if (params.participant) query.set('participant', params.participant);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request<{ data: any[] }>(`/api/admin/surveys/${surveyId}/hdi/participant-report${suffix}`);
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchHdiCohortAnalytics(
  surveyId: string,
  params: { orgId?: string; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.orgId) query.set('orgId', params.orgId);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request<{ data: any }>(`/api/admin/surveys/${surveyId}/hdi/cohort-analytics${suffix}`);
  return json.data ?? null;
}

export async function fetchHdiPrePostComparison(
  surveyId: string,
  params: { participant: string; orgId?: string },
) {
  const query = new URLSearchParams();
  query.set('participant', params.participant);
  if (params.orgId) query.set('orgId', params.orgId);
  const json = await request<{ data: any }>(
    `/api/admin/surveys/${surveyId}/hdi/pre-post-comparison?${query.toString()}`,
  );
  return json.data ?? null;
}

export async function fetchLearnerSurveyResults(surveyId: string, assignmentId?: string) {
  const query = new URLSearchParams();
  if (assignmentId) query.set('assignmentId', assignmentId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request<{ data: any }>(`/api/client/surveys/${surveyId}/results${suffix}`, {
    headers: buildOrgHeaders(),
  });
  return json.data ?? null;
}

export async function submitLearnerSurveyResponse(
  surveyId: string,
  payload: {
    assignmentId?: string | null;
    responses: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    status?: 'completed' | 'in-progress';
  },
) {
  const body: Record<string, unknown> = {
    responses: payload.responses,
  };
  if (payload.assignmentId) {
    body.assignmentId = payload.assignmentId;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  if (payload.status) {
    body.status = payload.status;
  }
  const json = await request<{ data: any }>(`/api/client/surveys/${surveyId}/submit`, {
    method: 'POST',
    body,
    headers: buildOrgHeaders(),
  });
  return json.data ?? null;
}

export async function saveLearnerSurveyProgress(
  surveyId: string,
  payload: {
    assignmentId?: string | null;
    responses: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  return submitLearnerSurveyResponse(surveyId, {
    ...payload,
    status: 'in-progress',
  });
}

export async function fetchAdminSurveyResults(
  surveyId: string,
  options: { organizationId?: string; userId?: string; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (options.organizationId) query.set('orgId', options.organizationId);
  if (options.userId) query.set('userId', options.userId);
  if (typeof options.limit === 'number') query.set('limit', String(options.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request<{ data: any[] }>(`/api/admin/surveys/${surveyId}/results${suffix}`);
  return Array.isArray(json?.data) ? json.data : [];
}
