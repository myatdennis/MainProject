import type { Survey } from '../types/survey';
import type { CourseAssignment } from '../types/assignment';
import { request } from './http';
import { mapAssignmentsFromApiRows } from '../utils/assignmentStorage';
import { buildOrgHeaders } from '../utils/orgHeaders';

type SurveyApiRecord = any;
const LEARNER_ASSIGNED_SURVEYS_CACHE_TTL_MS = 10_000;
let learnerAssignedSurveysCache:
  | { timestamp: number; data: LearnerSurveyAssignment[] }
  | null = null;
let learnerAssignedSurveysInFlight: Promise<LearnerSurveyAssignment[]> | null = null;

const unwrapApiData = <T>(payload: T | { data?: T } | null | undefined): T | null => {
  if (payload == null) return null;
  if (typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? null) as T | null;
  }
  return payload as T;
};

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

export async function getAnalytics(surveyId: string, options: { organizationId?: string } = {}) {
  const [survey, responses] = await Promise.all([
    getSurveyById(surveyId).catch(() => null),
    fetchAdminSurveyResults(surveyId, { organizationId: options.organizationId, limit: 500 }).catch(() => []),
  ]);

  const numericBuckets = new Map<string, { total: number; count: number }>();
  let completedCount = 0;
  let completionMinutesTotal = 0;
  let completionMinutesCount = 0;

  for (const response of responses) {
    const status = String(response?.status ?? '').toLowerCase();
    if (status === 'completed' || response?.completed_at) {
      completedCount += 1;
    }

    const metadata = response?.metadata && typeof response.metadata === 'object' ? response.metadata : {};
    const completionMinutesCandidate =
      Number((metadata as Record<string, unknown>).completionTimeMinutes) ||
      Number((metadata as Record<string, unknown>).completion_time_minutes) ||
      Number((metadata as Record<string, unknown>).completionMinutes);
    if (Number.isFinite(completionMinutesCandidate) && completionMinutesCandidate > 0) {
      completionMinutesTotal += completionMinutesCandidate;
      completionMinutesCount += 1;
    }

    const answerRecord = response?.response && typeof response.response === 'object' ? response.response : {};
    Object.entries(answerRecord as Record<string, unknown>).forEach(([questionId, rawValue]) => {
      const numericValue =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string' && rawValue.trim() !== ''
            ? Number(rawValue)
            : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return;
      }
      const bucket = numericBuckets.get(questionId) ?? { total: 0, count: 0 };
      bucket.total += numericValue;
      bucket.count += 1;
      numericBuckets.set(questionId, bucket);
    });
  }

  const questionSummaries = [...numericBuckets.entries()]
    .map(([questionId, bucket]) => ({
      questionId,
      avgScore: Number((bucket.total / Math.max(bucket.count, 1)).toFixed(1)),
    }))
    .sort((left, right) => right.avgScore - left.avgScore);

  const completionRate = responses.length > 0 ? Math.round((completedCount / responses.length) * 100) : 0;
  const avgCompletionTime =
    completionMinutesCount > 0 ? Number((completionMinutesTotal / completionMinutesCount).toFixed(1)) : 0;

  const insights: string[] = [];
  if (responses.length === 0) {
    insights.push('No survey responses yet. Share the survey and review results after the first submissions arrive.');
  } else {
    insights.push(
      completionRate >= 80
        ? 'Completion is healthy. Respondents are finishing this survey at a strong rate.'
        : 'Completion is below target. Review reminders, deadlines, and survey length.',
    );
    if (questionSummaries.length > 0) {
      const strongest = questionSummaries[0];
      insights.push(`Highest-scoring numeric item: ${strongest.questionId} at ${strongest.avgScore.toFixed(1)}.`);
      const weakest = questionSummaries[questionSummaries.length - 1];
      if (weakest && weakest.questionId !== strongest.questionId) {
        insights.push(`Lowest-scoring numeric item: ${weakest.questionId} at ${weakest.avgScore.toFixed(1)}.`);
      }
    } else {
      insights.push('Responses are available, but there are not enough numeric answers yet to calculate question scores.');
    }
  }

  return {
    surveyId,
    title: survey?.title ?? `Survey ${surveyId}`,
    totalResponses: responses.length,
    completionRate,
    avgCompletionTime,
    questionSummaries,
    insights,
  };
}

export async function listSurveys(): Promise<Survey[]> {
  const json = await request<SurveyApiRecord[] | { data?: SurveyApiRecord[] }>('/api/admin/surveys');
  return (unwrapApiData(json) ?? []).map(mapSurveyRecord);
}

export async function saveSurvey(survey: Survey) {
  const json = await request<SurveyApiRecord | { data?: SurveyApiRecord }>('/api/admin/surveys', {
    method: 'POST',
    body: buildSurveyPayload(survey),
  });

  return mapSurveyRecord(unwrapApiData(json));
}

export type SurveyPatch = Partial<Survey> & { organizationIds?: string[] };

export async function updateSurvey(id: string, patch: SurveyPatch) {
  const payload = {
    ...patch,
    organizationIds: patch.organizationIds ?? patch.assignedTo?.organizationIds,
  };

  const json = await request<SurveyApiRecord | { data?: SurveyApiRecord }>(`/api/admin/surveys/${id}`, {
    method: 'PUT',
    body: payload,
  });

  return mapSurveyRecord(unwrapApiData(json));
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
    const json = await request<any | { data?: any }>(`/api/admin/surveys/${id}`);
    const data = unwrapApiData(json);
    return data ? mapSurveyRecord(data) : null;
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
  invalidateAssignedSurveysForLearnerCache();
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
  invalidateAssignedSurveysForLearnerCache();
}

export type LearnerSurveyAssignment = {
  assignment: CourseAssignment;
  survey: Survey | null;
};

export const invalidateAssignedSurveysForLearnerCache = () => {
  learnerAssignedSurveysCache = null;
  learnerAssignedSurveysInFlight = null;
};

export async function fetchAssignedSurveysForLearner(
  options: { forceRefresh?: boolean } = {},
): Promise<LearnerSurveyAssignment[]> {
  if (!options.forceRefresh && learnerAssignedSurveysCache) {
    const age = Date.now() - learnerAssignedSurveysCache.timestamp;
    if (age < LEARNER_ASSIGNED_SURVEYS_CACHE_TTL_MS) {
      return learnerAssignedSurveysCache.data;
    }
  }
  if (!options.forceRefresh && learnerAssignedSurveysInFlight) {
    return learnerAssignedSurveysInFlight;
  }

  type AssignedResponse = {
    data: Array<{ assignment: any; survey?: any }>;
    meta?: { hydrationPending?: boolean };
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const MAX_HYDRATION_RETRIES = 3;
  const HYDRATION_RETRY_MS = 600;

  const run = (async () => {
    let lastJson: AssignedResponse | null = null;
    for (let attempt = 0; attempt < MAX_HYDRATION_RETRIES; attempt += 1) {
      const json = await request<AssignedResponse>('/api/client/surveys/assigned', {
        headers: buildOrgHeaders(),
      });
      lastJson = json;
      const entries = Array.isArray(json.data) ? json.data : [];
      const hydrationPending = Boolean(json.meta?.hydrationPending);
      if (entries.length > 0 || !hydrationPending || attempt === MAX_HYDRATION_RETRIES - 1) {
        break;
      }
      await sleep(HYDRATION_RETRY_MS);
    }

    const entries = Array.isArray(lastJson?.data) ? lastJson!.data : [];
    const normalized = entries
      .map((entry) => {
        const assignment = mapAssignmentsFromApiRows(entry.assignment ? [entry.assignment] : [])?.[0];
        const survey = entry.survey ? mapSurveyRecord(entry.survey) : null;
        if (!assignment) return null;
        return { assignment, survey };
      })
      .filter((entry): entry is LearnerSurveyAssignment => Boolean(entry));
    learnerAssignedSurveysCache = {
      timestamp: Date.now(),
      data: normalized,
    };
    return normalized;
  })();

  learnerAssignedSurveysInFlight = run.finally(() => {
    learnerAssignedSurveysInFlight = null;
  });
  return learnerAssignedSurveysInFlight;
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
  invalidateAssignedSurveysForLearnerCache();
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
