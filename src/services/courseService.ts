import type { Course, Module, Lesson, LessonContent } from '../types/courseTypes';
import type { NormalizedCourse } from '../utils/courseNormalization';
import {
  normalizeCourse,
  slugify,
  parseDurationToMinutes,
  formatMinutes,
} from '../utils/courseNormalization';
import apiRequest, { ApiError } from '../utils/apiClient';
import {
  moduleSchema,
  modulePatchSchema,
  lessonSchema,
  lessonPatchSchema,
  moduleReorderSchema,
  lessonReorderSchema,
} from '../types/apiSchemas';
import type { Module as ModuleDto, Lesson as LessonDto } from '../types/api';
import type {
  ModuleInput,
  ModulePatchInput,
  LessonInput,
  LessonPatchInput,
  ModuleReorderInput,
  LessonReorderInput,
} from '../types/apiSchemas';
import { CURRENT_CONTENT_SCHEMA_VERSION } from '../schema/contentSchema';
import { ZodError } from 'zod';
import { createActionIdentifiers, type IdempotentAction } from '../utils/idempotency';
import { cloneWithCanonicalOrgId, resolveOrgIdFromCarrier, stampCanonicalOrgId } from '../utils/orgFieldUtils';
import { normalizeLessonForPersistence, canonicalizeLessonContent } from '../utils/lessonContent';
import type { CourseValidationIssue } from '../validation/courseValidation';
import { parseSlugConflictError, SlugConflictError } from '../utils/slugConflict';
import { getSupabase } from '../lib/supabaseClient';
import queryClient from '../lib/queryClient';
import { invalidateCourseQueries } from '../lib/courseQueryKeys';
import isUuid from '../utils/isUuid';
import { upsertRequestBodySchema } from '../contracts/courseWriteContract';
import { appendAdminOrgIdQuery } from '../utils/adminOrgScope';

export type SupabaseCourseRecord = {
  id: string;
  slug?: string | null;
  title: string;
  name?: string | null;
  version?: number | null;
  description?: string | null;
  status?: string | null;
  thumbnail?: string | null;
  duration?: string | null;
  difficulty?: string | null;
  estimated_time?: string | null;
  prerequisites?: string[] | null;
  learning_objectives?: string[] | null;
  key_takeaways?: string[] | null;
  tags?: string[] | null;
  type?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  due_date?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  organizationId?: string | null;
  meta_json?: Record<string, any> | null;
  modules?: SupabaseModuleRecord[];
};

export type SupabaseModuleRecord = {
  id: string;
  course_id?: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  order_index?: number | null;
  metadata?: Record<string, unknown> | null;
  lessons?: SupabaseLessonRecord[];
};

export type SupabaseLessonRecord = {
  id: string;
  module_id?: string;
  title: string;
  description?: string | null;
  type: string;
  duration?: string | null;
  duration_s?: number | null;
  order_index?: number | null;
  content?: any;
  content_json?: any;
  completion_rule_json?: any;
};

export class CourseValidationError extends Error {
  readonly context: string;
  readonly issues: string[];
  readonly details?: CourseValidationIssue[];

  constructor(context: string, issues: string[], details?: CourseValidationIssue[]) {
    super(`${context} validation failed: ${issues.join('; ')}`);
    this.name = 'CourseValidationError';
    this.context = context;
    this.issues = issues;
    this.details = details;
  }
}

// Versioned + environment-scoped key.  The old unscoped key is evicted at startup
// so E2E/test run persisted IDs cannot pollute a production session.
const PERSISTED_COURSE_IDS_STALE_KEY = 'courseService.persistedCourseIds';
const ENV_TAG = import.meta.env.PROD ? 'prod' : 'dev';
const PERSISTED_COURSE_IDS_KEY = `courseService.persistedCourseIds.v2.${ENV_TAG}`;
const persistedCourseIds = new Set<string>();
const supportsLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Evict the old key at module load so stale IDs from a previous (possibly
// E2E-contaminated) session are never read.
if (supportsLocalStorage()) {
  try {
    window.localStorage.removeItem(PERSISTED_COURSE_IDS_STALE_KEY);
  } catch { /* non-fatal */ }
}

const hydratePersistedCourseIds = () => {
  if (!supportsLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(PERSISTED_COURSE_IDS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((value) => {
        if (typeof value === 'string' && value.trim()) {
          persistedCourseIds.add(value.trim());
        }
      });
    }
  } catch (error) {
    console.warn('[CourseService] Failed to hydrate persisted course ids', error);
  }
};

const withSupabaseAuthRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let retried = false;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const isUnauthorized = error instanceof ApiError && error.status === 401;
      if (!retried && isUnauthorized) {
        retried = true;
        try {
          const supabase = await getSupabase();
          await supabase?.auth.refreshSession();
          continue;
        } catch (refreshError) {
          console.warn('[CourseService] Failed to refresh Supabase session after 401', refreshError);
        }
      }
      throw error;
    }
  }
};
const persistCourseIdsSnapshot = () => {
  if (!supportsLocalStorage()) return;
  try {
    window.localStorage.setItem(PERSISTED_COURSE_IDS_KEY, JSON.stringify(Array.from(persistedCourseIds)));
  } catch (error) {
    console.warn('[CourseService] Failed to persist course ids snapshot', error);
  }
};
hydratePersistedCourseIds();
const markCoursePersisted = (id?: string | null) => {
  if (typeof id === 'string' && id.trim()) {
    const trimmed = id.trim();
    if (!persistedCourseIds.has(trimmed)) {
      persistedCourseIds.add(trimmed);
      persistCourseIdsSnapshot();
    }
  }
};
const hasPersistedCourseRecord = (id?: string | null): boolean => {
  if (typeof id !== 'string') return false;
  return persistedCourseIds.has(id.trim());
};
const hasServerAssignedCourseId = (value?: string | null): value is string => {
  if (typeof value !== 'string') return false;
  return isUuid(value);
};

const COURSE_UPSERT_MAX_PAYLOAD_BYTES = Number(import.meta.env.VITE_ADMIN_COURSE_UPSERT_MAX_BYTES ?? 8 * 1024 * 1024);

const estimateJsonPayloadBytes = (value: unknown): number => {
  try {
    const serialized = JSON.stringify(value ?? {});
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(serialized).length;
    }
    return serialized.length;
  } catch {
    return 0;
  }
};

const formatZodIssues = (error: ZodError, context: string): string[] => {
  return error.issues.map((issue) => {
    const path = issue.path && issue.path.length > 0 ? `${context}.${issue.path.join('.')}` : context;
    return `${path}: ${issue.message}`;
  });
};

const parseWithValidation = <T>(schema: { parse: (data: unknown) => T }, data: unknown, context: string): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = formatZodIssues(error, context);
      throw new CourseValidationError(context, issues);
    }
    throw error;
  }
};

const mapLessonTypeFromSupabase = (type: string): Lesson['type'] => {
  switch (type) {
    case 'video':
    case 'quiz':
    case 'text':
    case 'reflection':
    case 'survey':
      return type;
    case 'resource':
      return 'document';
    case 'interactive':
      return 'interactive';
    case 'download':
    case 'document':
      return 'document';
    case 'scenario':
      return 'scenario';
    default:
      return 'interactive';
  }
};

const mapLessonRecord = (lesson: SupabaseLessonRecord): Lesson => {
  const durationValue = lesson.duration ?? (lesson as any).duration_s;
  const estimatedMinutes =
    typeof durationValue === 'number'
      ? Math.round(durationValue / 60)
      : parseDurationToMinutes(typeof durationValue === 'string' ? durationValue : undefined);
  const rawContent = ((lesson as any).content_json ?? lesson.content ?? {}) as LessonContent;
  const content = canonicalizeLessonContent(rawContent);
  const completionRule =
    (lesson as any).completion_rule_json ??
    ((content && typeof content === 'object' && 'completionRule' in content ? (content as any).completionRule : undefined) ??
      undefined);

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description || '',
    type: mapLessonTypeFromSupabase(lesson.type),
    order: lesson.order_index ?? 0,
    estimatedDuration: estimatedMinutes ?? undefined,
    duration:
      typeof durationValue === 'string'
        ? durationValue
        : estimatedMinutes
        ? formatMinutes(estimatedMinutes) ?? undefined
        : undefined,
    content,
    completionRule,
    resources: [],
    chapterId: lesson.module_id,
  };
};

const mapModuleRecord = (module: SupabaseModuleRecord): Module => {
  const lessons = (module.lessons || []).map(mapLessonRecord);
  const moduleMinutes = lessons.reduce((sum, lesson) => sum + (lesson.estimatedDuration ?? 0), 0);

  return {
    id: module.id,
    title: module.title,
    description: module.description || '',
    duration: module.duration || (moduleMinutes ? formatMinutes(moduleMinutes) ?? '' : ''),
    order: module.order_index ?? 0,
    lessons,
    resources: [],
  };
};

export const mapCourseRecord = (course: SupabaseCourseRecord): NormalizedCourse => {
  const modules = (course.modules || []).map(mapModuleRecord);
  const derivedLessonCount = modules.reduce(
    (total, module) => total + (module.lessons ? module.lessons.length : 0),
    0,
  );
  const structureLoaded =
    modules.length > 0 && modules.some((module) => Array.isArray(module.lessons) && module.lessons.length > 0);
  const moduleCountFallback =
    (course as any).module_count ?? (course as any).modules_count ?? (structureLoaded ? modules.length : null);
  const lessonCountFallback =
    (course as any).lesson_count ??
    (course as any).lessons_count ??
    (structureLoaded ? derivedLessonCount : null);
  const meta = course.meta_json || {};
  const resolvedTitle = course.title || course.name || 'Untitled Course';
  const resolvedOrganizationId =
    course.organization_id ??
    (course as any).organizationId ??
    (course as any).org_id ??
    (meta as any)?.organizationId ??
    null;

  const normalizedCourse = normalizeCourse({
    id: course.id,
    version: typeof (course as any).version === 'number' ? (course as any).version : undefined,
    slug: course.slug || slugify(course.id || resolvedTitle || 'course'),
    title: resolvedTitle,
    description: course.description || meta.description || '',
    status: (course.status as Course['status']) || 'draft',
    thumbnail: meta.thumbnail || course.thumbnail || '',
    organizationId: resolvedOrganizationId ?? undefined,
    duration:
      course.duration ||
      meta.duration ||
      formatMinutes(
        modules.reduce((sum, module) => {
          return sum + (module.lessons || []).reduce((innerSum, lesson) => innerSum + (lesson.estimatedDuration ?? 0), 0);
        }, 0),
      ) ||
      '0 min',
    difficulty: (meta.difficulty as Course['difficulty']) || (course.difficulty as Course['difficulty']) || 'Beginner',
    estimatedTime: meta.estimated_time || course.estimated_time || undefined,
    prerequisites: meta.prerequisites || course.prerequisites || [],
    learningObjectives: meta.learning_objectives || course.learning_objectives || [],
    keyTakeaways: meta.key_takeaways || course.key_takeaways || [],
    tags: meta.tags || course.tags || [],
    type: meta.type || course.type || undefined,
    createdBy: meta.created_by || course.created_by || undefined,
    createdDate: course.created_at || undefined,
    lastUpdated: course.updated_at || undefined,
    publishedDate: meta.published_at || course.published_at || undefined,
    dueDate: meta.due_date || course.due_date || undefined,
    modules,
    chapters: [],
    progress: 0,
    rating: 0,
    enrollments: 0,
    completionRate: 0,
    avgRating: 0,
    totalRatings: 0,
  } as Course);

  if (resolvedOrganizationId) {
    (normalizedCourse as Record<string, any>).organizationId = resolvedOrganizationId;
  }
  if (typeof (course as any).version === 'number') {
    (normalizedCourse as Record<string, any>).version = (course as any).version;
  }
  (normalizedCourse as Record<string, any>).structureLoaded = structureLoaded;
  (normalizedCourse as Record<string, any>).structureSource = structureLoaded ? 'full' : 'summary';
  (normalizedCourse as Record<string, any>).moduleCount =
    structureLoaded && modules.length > 0 ? modules.length : moduleCountFallback ?? modules.length ?? null;
  const resolvedLessonCount =
    structureLoaded && derivedLessonCount > 0 ? derivedLessonCount : lessonCountFallback ?? normalizedCourse.lessons ?? null;
  (normalizedCourse as Record<string, any>).lessonCount = resolvedLessonCount;
  if (resolvedLessonCount !== null && typeof resolvedLessonCount !== 'undefined') {
    (normalizedCourse as Record<string, any>).lessons = resolvedLessonCount;
  }
  stampCanonicalOrgId(normalizedCourse as Record<string, any>, resolvedOrganizationId);
  markCoursePersisted(normalizedCourse.id);

  return normalizedCourse;
};

const isFileLike = (value: unknown): boolean => {
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return false;
};

const sanitizeSerializable = (value: unknown): any => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const result = value
      .map((item) => sanitizeSerializable(item))
      .filter((item) => item !== undefined);
    return result;
  }

  if (typeof value === 'object') {
    if (isFileLike(value)) {
      return undefined;
    }

    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      const sanitized = sanitizeSerializable(val);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    });

    if (Object.keys(result).length === 0) {
      return null;
    }

    return result;
  }

  return undefined;
};

const mapLessonTypeForApi = (type: Lesson['type']): LessonDto['type'] => {
  switch (type) {
    case 'video':
      return 'video';
    case 'quiz':
      return 'quiz';
    case 'text':
      return 'text';
    case 'reflection':
      return 'reflection';
    case 'survey':
      return 'survey' as LessonDto['type'];
    case 'scenario':
    case 'interactive':
      return 'resource';
    case 'document':
      return 'resource';
    default:
      return 'text';
  }
};

const buildLessonResources = (lesson: Lesson): { label: string; url: string }[] => {
  const directResources = Array.isArray(lesson.resources) ? lesson.resources : [];
  const normalizedResources = directResources
    .map((resource) => {
      const url = resource.url ?? resource.downloadUrl ?? null;
      if (!url) return null;
      const label = resource.title || resource.description || 'Resource';
      return { label, url };
    })
    .filter((entry): entry is { label: string; url: string } => !!entry);

  return normalizedResources;
};

const buildLessonContent = (lesson: Lesson, apiType: LessonDto['type']): LessonInput['content'] => {
  const canonical = canonicalizeLessonContent(lesson.content ?? {});
  if (apiType === 'quiz') {
    const quizQuestions = Array.isArray(canonical.questions)
      ? canonical.questions
      : Array.isArray((canonical as any)?.quiz?.questions)
      ? (canonical as any).quiz.questions
      : Array.isArray((canonical as any)?.body?.questions)
      ? (canonical as any).body.questions
      : null;
    if (quizQuestions && quizQuestions.length > 0) {
      (canonical as any).body =
        (canonical as any).body && typeof (canonical as any).body === 'object'
          ? { ...((canonical as any).body as Record<string, unknown>), questions: quizQuestions }
          : { questions: quizQuestions };
      (canonical as any).quiz =
        (canonical as any).quiz && typeof (canonical as any).quiz === 'object'
          ? { ...(canonical as any).quiz, questions: quizQuestions }
          : { questions: quizQuestions };
      canonical.questions = quizQuestions as any;
    }
  }
  if ((!canonical.videoUrl || canonical.videoUrl.length === 0) && canonical.videoAsset) {
    const assetUrl =
      canonical.videoAsset.signedUrl ||
      canonical.videoAsset.publicUrl ||
      (canonical.videoAsset.storagePath?.startsWith('http') ? canonical.videoAsset.storagePath : null);
    if (assetUrl) {
      canonical.videoUrl = assetUrl;
    }
  }
  (canonical as any).type = apiType;
  (canonical as any).schema_version = (canonical as any).schema_version ?? CURRENT_CONTENT_SCHEMA_VERSION;
  const sanitized = sanitizeSerializable(canonical) || {};
  const base =
    typeof sanitized === 'object' && sanitized !== null
      ? (sanitized as LessonInput['content'])
      : ({ type: apiType } as LessonInput['content']);
  base.type = apiType;

  const resources = buildLessonResources(lesson);
  if (resources.length > 0) {
    base.resources = resources;
  }

  return base;
};

const mapCompletionRule = (lesson: Lesson): LessonInput['completionRule'] => {
  const rule = lesson.completionRule;
  if (!rule || typeof rule !== 'object') {
    return null;
  }

  const typeCandidate =
    typeof (rule as any).type === 'string'
      ? (rule as any).type
      : typeof (rule as any).mode === 'string'
      ? (rule as any).mode
      : undefined;

  if (!typeCandidate) {
    return null;
  }

  if (typeCandidate !== 'time_spent' && typeCandidate !== 'quiz_score' && typeCandidate !== 'manual') {
    return null;
  }

  const rawValue = (rule as any).value ?? (rule as any).minutes ?? (rule as any).threshold ?? null;
  const numericValue = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : undefined;

  return {
    type: typeCandidate,
    ...(numericValue !== undefined ? { value: numericValue } : {}),
  };
};

// Removed granular build helpers in favor of single upsert path; keep create/update APIs for targeted edits.

// Resource normalization handled at call sites as needed; no-op here after consolidation.

// Legacy metadata builder retained for reference; module resources can be attached via metadata when needed.


const buildCoursePayload = (course: NormalizedCourse) => {
  const organizationId = resolveOrgIdFromCarrier(course);
  return {
    id: course.id,
    name: course.title,
    title: course.title,
    slug: course.slug || slugify(course.title || course.id),
    description: course.description,
    status: course.status || 'draft',
    version: course.version ?? (course as any).version ?? 1,
    organization_id: organizationId ?? undefined,
    meta: {
      thumbnail: course.thumbnail,
      difficulty: course.difficulty,
      estimated_time: course.estimatedTime,
      prerequisites: course.prerequisites,
      learning_objectives: course.learningObjectives,
      key_takeaways: course.keyTakeaways,
      tags: course.tags,
      type: course.type,
      created_by: course.createdBy,
      published_at: course.publishedDate,
      due_date: course.dueDate,
    },
  };
};

export class CourseService {
  private static applyOrgIdContract<T extends Record<string, any>>(
    entity: T | undefined,
    fallbackOrgId: string | null,
  ): T {
    const base = entity ? { ...entity } : {};
    const stamped = stampCanonicalOrgId(base, fallbackOrgId) as Record<string, any>;
    const resolvedOrgId = resolveOrgIdFromCarrier(stamped) ?? fallbackOrgId ?? null;
    if (resolvedOrgId) {
      stamped.organizationId = resolvedOrgId;
    }
    return stamped as T;
  }

  private static withOrgContextForModules(modules: Record<string, any>[], fallbackOrgId: string | null) {
    return modules.map((module) => {
      const moduleOrgId = resolveOrgIdFromCarrier(module) ?? fallbackOrgId;
      const normalizedModule = CourseService.applyOrgIdContract(module, moduleOrgId);
      if (Array.isArray(normalizedModule.lessons)) {
        normalizedModule.lessons = normalizedModule.lessons.map((lesson: Record<string, any>) =>
          CourseService.applyOrgIdContract(lesson, moduleOrgId),
        );
      }
      return normalizedModule;
    });
  }

  private static buildModulesPayloadForUpsert(course: NormalizedCourse) {
    // Only propagate course_id when it is a confirmed server-assigned UUID.
    // For new (unsaved) courses the id is either absent or a temp value — in
    // that case we omit it and let the server-side RPC derive the linkage from
    // the nested graph structure so no stale/temp id contaminates the payload.
    const courseId = hasServerAssignedCourseId(course.id) ? (course.id as string) : null;
    const modules = (course.modules || []).map((mod, moduleIndex) => {
      const lessons = (mod.lessons || []).map((lesson, lessonIndex) => {
        const canonicalLesson = normalizeLessonForPersistence(lesson);
        const apiType = mapLessonTypeForApi(canonicalLesson.type);
        const estimatedMinutes =
          typeof canonicalLesson.estimatedDuration === 'number'
            ? canonicalLesson.estimatedDuration
            : parseDurationToMinutes(canonicalLesson.duration);
        const durationSeconds =
          typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) ? estimatedMinutes * 60 : null;

        const content = buildLessonContent(canonicalLesson, apiType);
        const completionRule = mapCompletionRule(canonicalLesson);
        if (completionRule) {
          (content as Record<string, unknown>).completionRule = completionRule;
        }

        return {
          id: canonicalLesson.id,
          title: (canonicalLesson.title || '').trim() || `Lesson ${lessonIndex + 1}`,
          description: canonicalLesson.description ?? null,
          type: apiType,
          order_index: canonicalLesson.order ?? lessonIndex,
          duration_s: durationSeconds,
          content_json: content,
          // Only attach course_id when the course is already persisted (UUID confirmed).
          ...(courseId ? { course_id: courseId } : {}),
          // Always propagate module_id so the server can link the lesson without guessing.
          ...(mod.id ? { module_id: mod.id } : {}),
        };
      });

      return {
        id: mod.id,
        title: (mod.title || '').trim() || `Module ${moduleIndex + 1}`,
        description: mod.description ?? null,
        order_index: mod.order ?? moduleIndex,
        lessons,
        // Only attach course_id when the course is already persisted (UUID confirmed).
        ...(courseId ? { course_id: courseId } : {}),
      };
    });
    return modules;
  }

  private static logLessonDiagnostics(modules: Array<Record<string, any>>) {
    const diagnostics = modules.flatMap((mod) => {
      const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
      return lessons
        .filter((lesson) => lesson.type === 'video' || lesson.type === 'quiz')
        .map((lesson) => {
          if (lesson.type === 'video') {
            const asset = lesson.content?.videoAsset || null;
            return {
              moduleId: mod.id,
              lessonId: lesson.id,
              type: 'video',
              videoUrl: lesson.content?.videoUrl ?? null,
              videoAssetSource: asset?.source ?? null,
              videoAssetSignedUrl: asset?.signedUrl ?? null,
              videoAssetStoragePath: asset?.storagePath ?? null,
            };
          }
          const questions = Array.isArray(lesson.content?.questions) ? lesson.content.questions : [];
          return {
            moduleId: mod.id,
            lessonId: lesson.id,
            type: 'quiz',
            questionCount: questions.length,
            questions: questions.map((question: any) => ({
              id: question.id,
              correctAnswer: question.correctAnswer ?? question.correctOptionIds?.[0] ?? null,
              options: Array.isArray(question.options)
                ? question.options.map((option: any) => ({
                    id: option?.id ?? null,
                    isCorrect: Boolean(option?.isCorrect || option?.correct),
                  }))
                : [],
            })),
          };
        });
    });

    if (diagnostics.length > 0 && import.meta.env?.DEV) {
      console.info('[CourseService] lesson_payload_debug', diagnostics);
    }
  }

  private static async upsertCourse(
    course: NormalizedCourse,
    options: { idempotencyKey?: string; action?: IdempotentAction; signal?: AbortSignal; clientRevision?: number } = {},
  ): Promise<SupabaseCourseRecord | null> {
    const payload = buildCoursePayload(course);
    let modules = CourseService.buildModulesPayloadForUpsert(course);
    const body: Record<string, unknown> = { course: payload, modules };
    if (options.idempotencyKey) {
      body.idempotency_key = options.idempotencyKey;
    }
    if (options.action === 'course.save' || options.action === 'course.auto-save') {
      body.action = options.action;
    }
    if ((course.status || 'draft') !== 'published') {
      body.draftMode = true;
    }
    if (typeof options.clientRevision === 'number') {
      body.clientRevision = options.clientRevision;
    }

    const {
      clone: sanitizedCourse,
      organizationId: canonicalOrgId,
      strippedKeys,
    } = cloneWithCanonicalOrgId(body.course as Record<string, any>, {
      removeAliases: true,
    });
    if (import.meta.env?.DEV && strippedKeys.length > 0) {
      console.warn('[CourseService] Stripped organization aliases before sync', {
        strippedKeys,
        requestCourseId: course.id,
      });
    }
    const canonicalCourse = CourseService.applyOrgIdContract(sanitizedCourse, canonicalOrgId);
    body.course = canonicalCourse;
    modules = CourseService.withOrgContextForModules(modules, canonicalOrgId) as typeof modules;
    body.modules = modules;
    const parsedBody = upsertRequestBodySchema.parse(body);
    CourseService.logLessonDiagnostics(modules as Record<string, any>[]);
    const hasRemoteRecord = hasPersistedCourseRecord(course.id);
    const isCreateOperation = !hasRemoteRecord;
    if (isCreateOperation) {
      delete (body.course as Record<string, unknown>).id;
    }

    const endpoint = isCreateOperation ? '/api/admin/courses' : `/api/admin/courses/${course.id}`;
    const method = isCreateOperation ? 'POST' : 'PUT';
    const payloadSizeBytes = estimateJsonPayloadBytes(parsedBody);

    if (payloadSizeBytes > COURSE_UPSERT_MAX_PAYLOAD_BYTES) {
      const payloadSizeMb = (payloadSizeBytes / (1024 * 1024)).toFixed(1);
      const maxMb = (COURSE_UPSERT_MAX_PAYLOAD_BYTES / (1024 * 1024)).toFixed(1);
      throw new CourseValidationError('course', [
        `Course save payload is too large (${payloadSizeMb}MB). Reduce large media/transcript content and try again (max ${maxMb}MB).`,
      ]);
    }

    let lastServerCourse: SupabaseCourseRecord | null = null;

    try {
      const response = await apiRequest<{ data?: SupabaseCourseRecord; course?: SupabaseCourseRecord }>(endpoint, {
        method,
        body: parsedBody,
        signal: options.signal,
        skipAdminGateCheck: true,
      });
      const serverCourse = response?.course ?? response?.data ?? null;
      const serverVersion =
        serverCourse && typeof serverCourse.version === 'number' ? serverCourse.version : null;
      if (serverVersion !== null) {
        course.version = serverVersion;
      }
      lastServerCourse = serverCourse;
    } catch (error) {
      const slugConflict = parseSlugConflictError(error, course.slug);
      if (slugConflict) {
        throw new SlugConflictError(slugConflict);
      }
      throw error;
    }

    return lastServerCourse;
  }

  private static async fetchCourseStructure(
    identifier: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<NormalizedCourse | null> {
    try {
      const queryParam = '?includeDrafts=true';
      const json = await apiRequest<{ data: SupabaseCourseRecord | null }>(
        `/api/client/courses/${identifier}${queryParam}`,
        { noTransform: true, signal: options.signal },
      );
      if (!json.data) return null;
      return mapCourseRecord(json.data);
    } catch (error) {
      console.warn('Failed to fetch course structure', error);
      return null;
    }
  }

  // resolveExistingCourse no longer required with single upsert path; fetching occurs post-upsert.

  static async createModule(input: ModuleInput): Promise<ModuleDto> {
    const parsed = parseWithValidation(moduleSchema, input, 'module');
    const response = await apiRequest<{ data: ModuleDto }>('/api/admin/modules', {
      method: 'POST',
      body: parsed,
      skipAdminGateCheck: true,
    });
    return response.data;
  }

  static async updateModule(moduleId: string, patch: ModulePatchInput): Promise<ModuleDto> {
    const parsed = parseWithValidation(modulePatchSchema, patch, 'module');
    const response = await apiRequest<{ data: ModuleDto }>(`/api/admin/modules/${moduleId}`, {
      method: 'PATCH',
      body: parsed,
      skipAdminGateCheck: true,
    });
    return response.data;
  }

  static async deleteModule(moduleId: string): Promise<void> {
    await apiRequest(`/api/admin/modules/${moduleId}`, {
      method: 'DELETE',
      expectedStatus: [204],
      skipAdminGateCheck: true,
    });
  }

  static async createLesson(input: LessonInput): Promise<LessonDto> {
    const parsed = parseWithValidation(lessonSchema, input, 'lesson');
    const response = await apiRequest<{ data: LessonDto }>('/api/admin/lessons', {
      method: 'POST',
      body: parsed,
      skipAdminGateCheck: true,
    });
    return response.data;
  }

  static async updateLesson(lessonId: string, patch: LessonPatchInput): Promise<LessonDto> {
    const parsed = parseWithValidation(lessonPatchSchema, patch, 'lesson');
    const response = await apiRequest<{ data: LessonDto }>(`/api/admin/lessons/${lessonId}`, {
      method: 'PATCH',
      body: parsed,
      skipAdminGateCheck: true,
    });
    return response.data;
  }

  static async deleteLesson(lessonId: string): Promise<void> {
    await apiRequest(`/api/admin/lessons/${lessonId}`, {
      method: 'DELETE',
      expectedStatus: [204],
      skipAdminGateCheck: true,
    });
  }

  static async reorderModules(courseId: string, modules: Module[]): Promise<ModuleDto[]> {
    const moduleOrder = modules
      .filter((module) => Boolean(module.id))
      .map((module, index) => ({
        id: module.id as string,
        orderIndex: module.order ?? index,
      }));

    if (moduleOrder.length === 0) {
      return [];
    }

    const payload: ModuleReorderInput = {
      courseId,
      modules: moduleOrder,
    };

    const parsed = parseWithValidation(moduleReorderSchema, payload, 'moduleOrder');

    const response = await apiRequest<{ data: ModuleDto[] }>('/api/admin/modules/reorder', {
      method: 'POST',
      body: parsed,
      skipAdminGateCheck: true,
    });

    return response.data;
  }

  static async reorderLessons(moduleId: string, lessons: Lesson[]): Promise<LessonDto[]> {
    const lessonOrder = lessons
      .filter((lesson) => Boolean(lesson.id))
      .map((lesson, index) => ({
        id: lesson.id as string,
        orderIndex: lesson.order ?? index,
      }));

    if (lessonOrder.length === 0) {
      return [];
    }

    const payload: LessonReorderInput = {
      moduleId,
      lessons: lessonOrder,
    };

    const parsed = parseWithValidation(lessonReorderSchema, payload, 'lessonOrder');

    const response = await apiRequest<{ data: LessonDto[] }>('/api/admin/lessons/reorder', {
      method: 'POST',
      body: parsed,
      skipAdminGateCheck: true,
    });

    return response.data;
  }

  static async syncCourseToDatabase(
    course: Course,
    options: { idempotencyKey?: string; action?: IdempotentAction; signal?: AbortSignal; clientRevision?: number } = {},
  ): Promise<NormalizedCourse | null> {
    const normalizedCourse = normalizeCourse(course);
    const isNewCourse = !hasServerAssignedCourseId(normalizedCourse.id);
    const action = options.action ?? 'course.save';
    const identifiers = createActionIdentifiers(action, {
      courseId: normalizedCourse.id,
      orgId: normalizedCourse.organizationId ?? undefined,
      attempt: Date.now(),
    });
    const idempotencyKey = options.idempotencyKey ?? identifiers.idempotencyKey;
    const { signal } = options;

    // Single upsert with full graph (course + modules + lessons).
    // The server response contains the authoritative saved course with server-assigned UUIDs.
    const serverCourse = await withSupabaseAuthRetry(() =>
      CourseService.upsertCourse(normalizedCourse, { idempotencyKey, action, signal, clientRevision: options.clientRevision }),
    );

    // Use the server response directly (now includes module_id and course_id on each lesson).
    let authoritative: NormalizedCourse | null = serverCourse
      ? mapCourseRecord(serverCourse as unknown as SupabaseCourseRecord)
      : null;

    // For a new course's first save, or when the server response is missing, always
    // fetch the canonical admin record to ensure full graph linkage.
    const needsCanonicalFetch = !authoritative || isNewCourse || !CourseService.isGraphComplete(authoritative);

    if (needsCanonicalFetch) {
      const identifier = authoritative?.id ?? authoritative?.slug ?? normalizedCourse.id ?? normalizedCourse.slug ?? null;
      if (identifier && hasServerAssignedCourseId(identifier)) {
        try {
          const adminJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
            `/api/admin/courses/${identifier}`,
            { noTransform: true, signal, skipAdminGateCheck: true },
          );
          if (adminJson.data) {
            const canonical = mapCourseRecord(adminJson.data);
            if (canonical) {
              authoritative = canonical;
            }
          }
        } catch (_) {
          // fall through to client endpoint
        }
      } else if (!authoritative) {
        // Non-UUID identifier fallback (slug-only)
        const slugIdentifier = normalizedCourse.slug ?? null;
        if (slugIdentifier) {
          try {
            const adminJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
              `/api/admin/courses/${slugIdentifier}`,
              { noTransform: true, signal, skipAdminGateCheck: true },
            );
            if (adminJson.data) {
              authoritative = mapCourseRecord(adminJson.data);
            }
          } catch (_) {
            // fall through
          }
        }
      }
    }

    if (!authoritative) {
      // Final fallback: client endpoint by id then slug (handles published courses).
      const refreshed =
        (await withSupabaseAuthRetry(() =>
          CourseService.fetchCourseStructure(normalizedCourse.id, { signal }),
        )) ||
        (normalizedCourse.slug
          ? await withSupabaseAuthRetry(() =>
              CourseService.fetchCourseStructure(normalizedCourse.slug, { signal }),
            )
          : null);
      authoritative = refreshed;
    }

    // Post-save integrity guard: verify all modules and lessons have proper IDs and linkage.
    if (authoritative && !CourseService.isGraphComplete(authoritative)) {
      if (import.meta.env?.DEV) {
        const issues = CourseService.graphIntegrityIssues(authoritative);
        console.warn('[CourseService] post_save_graph_incomplete', {
          courseId: authoritative.id,
          issues,
        });
      }
      // If still incomplete, trigger one more canonical fetch by the now-known server UUID.
      if (hasServerAssignedCourseId(authoritative.id)) {
        try {
          const repairJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
            `/api/admin/courses/${authoritative.id}`,
            { noTransform: true, signal, skipAdminGateCheck: true },
          );
          if (repairJson.data) {
            const repaired = mapCourseRecord(repairJson.data);
            if (repaired && CourseService.isGraphComplete(repaired)) {
              authoritative = repaired;
            }
          }
        } catch (_) {
          // Non-fatal: use best available result
        }
      }
    }

    const result = authoritative ?? normalizedCourse;
    markCoursePersisted(result.id);
    try {
      invalidateCourseQueries(queryClient, {
        orgId: result.organizationId ?? normalizedCourse.organizationId ?? null,
        courseId: result.id ?? null,
        slug: result.slug ?? normalizedCourse.slug ?? null,
      });
    } catch (invalidationError) {
      if (import.meta.env?.DEV) {
        console.warn('[CourseService] Failed to invalidate course queries', invalidationError);
      }
    }

    return result;
  }

  /**
   * Returns true if every module has an id and every lesson has an id,
   * module_id (chapterId), and course_id. Used for post-save integrity validation.
   */
  private static isGraphComplete(course: NormalizedCourse): boolean {
    if (!hasServerAssignedCourseId(course.id)) return false;
    for (const mod of course.modules ?? []) {
      if (!hasServerAssignedCourseId(mod.id)) return false;
      for (const lesson of mod.lessons ?? []) {
        if (!hasServerAssignedCourseId(lesson.id)) return false;
        // chapterId maps to module_id — must be present for full linkage
        if (!lesson.chapterId) return false;
      }
    }
    return true;
  }

  /**
   * Returns a list of human-readable integrity issues for structured logging.
   */
  private static graphIntegrityIssues(course: NormalizedCourse): string[] {
    const issues: string[] = [];
    if (!hasServerAssignedCourseId(course.id)) issues.push(`course.id not a UUID: ${course.id}`);
    (course.modules ?? []).forEach((mod, mi) => {
      if (!hasServerAssignedCourseId(mod.id)) issues.push(`modules[${mi}].id missing`);
      (mod.lessons ?? []).forEach((lesson, li) => {
        if (!hasServerAssignedCourseId(lesson.id)) issues.push(`modules[${mi}].lessons[${li}].id missing`);
        if (!lesson.chapterId) issues.push(`modules[${mi}].lessons[${li}].chapterId (module_id) missing`);
      });
    });
    return issues;
  }

  static async loadCourseFromDatabase(
    identifier: string,
    options: { includeDrafts?: boolean; signal?: AbortSignal } = {},
  ): Promise<NormalizedCourse | null> {
    const { includeDrafts = false } = options;
    const normalizedIdentifier = identifier.trim();

    // Always try the admin endpoint first — it returns drafts, respects platform-admin scope,
    // and works for courses not yet published to the client catalog.
    try {
      const adminJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
        `/api/admin/courses/${normalizedIdentifier}`,
        { noTransform: true, signal: options.signal, skipAdminGateCheck: true },
      );
      if (adminJson.data) {
        return mapCourseRecord(adminJson.data);
      }
    } catch (_adminErr) {
      // 403/404 from the admin endpoint → fall through to client endpoint
    }

    // Fallback: client endpoint (handles slug-based lookup and published courses)
    const queryParam = includeDrafts ? '?includeDrafts=true' : '';
    try {
      const json = await apiRequest<{ data: SupabaseCourseRecord | null }>(
        `/api/client/courses/${normalizedIdentifier}${queryParam}`,
        { noTransform: true, signal: options.signal },
      );
      if (!json.data) {
        const slugCandidate = slugify(normalizedIdentifier);
        if (slugCandidate && slugCandidate !== normalizedIdentifier) {
          const slugJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
            `/api/client/courses/${slugCandidate}${queryParam}`,
            { noTransform: true, signal: options.signal },
          );
          if (slugJson.data) {
            return mapCourseRecord(slugJson.data);
          }
        }
        return null;
      }
      return mapCourseRecord(json.data);
    } catch (error) {
      console.error('Error loading course from API:', error);
      throw error;
    }
  }

  static async getPublishedCourses(options: { orgId?: string; assignedOnly?: boolean } = {}): Promise<NormalizedCourse[]> {
    const { orgId, assignedOnly = false } = options;
    const params = new URLSearchParams();

    if (assignedOnly) {
      if (!orgId) {
        console.warn('[CourseService.getPublishedCourses] orgId is required when assignedOnly=true');
        return [];
      }
      params.set('assigned', 'true');
      params.set('orgId', orgId);
    }

    const path = params.toString() ? `/api/client/courses?${params.toString()}` : '/api/client/courses';

    try {
      const json = await apiRequest<{ data: SupabaseCourseRecord[] }>(path, { noTransform: true });
      return (json.data || []).map(mapCourseRecord);
    } catch (error) {
      console.error('Error loading published courses:', error);
      return [];
    }
  }

  static async getAllCoursesFromDatabase(): Promise<NormalizedCourse[]> {
    try {
      // skipAdminGateCheck: true — surface has already been verified by the caller
      // (courseStore.init checks isAdminSurface() + treatAsAdmin before reaching this call).
      // The redundant isAdminSurface() check inside prepareRequest reads window.location
      // at the moment the fetch executes, which can disagree with the caller's snapshot
      // during async execution (e.g. auth-ready deferred callbacks, org-switch retries).
      // Removing that secondary check is safe because:
      //   1. ensureAdminAccessForRequest() still verifies the user has admin portal access
      //      via /api/admin/me before any admin API call proceeds.
      //   2. The server enforces authenticate + requireAdmin on every /api/admin/* route.
      const endpoint = appendAdminOrgIdQuery('/api/admin/courses?includeStructure=true&includeLessons=true');
      const json = await apiRequest<{ data: SupabaseCourseRecord[] }>(
        endpoint,
        { noTransform: true, skipAdminGateCheck: true },
      );
      return (json.data || []).map(mapCourseRecord);
    } catch (error) {
      console.error('[CourseService.getAllCoursesFromDatabase] Error loading courses from API:', error);
      throw error;
    }
  }

  static async deleteCourseFromDatabase(courseId: string): Promise<void> {
    await apiRequest(`/api/admin/courses/${courseId}`, {
      method: 'DELETE',
      skipAdminGateCheck: true,
    });
  }
}
