import type { Course, Module, Lesson, Resource } from '../types/courseTypes';
import type { NormalizedCourse } from '../utils/courseNormalization';
import {
  normalizeCourse,
  slugify,
  parseDurationToMinutes,
  formatMinutes,
} from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import {
  moduleSchema,
  modulePatchSchema,
  lessonSchema,
  lessonPatchSchema,
  moduleReorderSchema,
  lessonReorderSchema,
} from '../types/apiSchemas';
import type {
  Module as ModuleDto,
  Lesson as LessonDto,
  ModuleInput,
  ModulePatchInput,
  LessonInput,
  LessonPatchInput,
  ModuleReorderInput,
  LessonReorderInput,
} from '../types/api';
import { ZodError } from 'zod';

type SupabaseCourseRecord = {
  id: string;
  slug?: string | null;
  title: string;
  name?: string | null;
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
  meta_json?: Record<string, any> | null;
  modules?: SupabaseModuleRecord[];
};

type SupabaseModuleRecord = {
  id: string;
  course_id?: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  order_index?: number | null;
  metadata?: Record<string, unknown> | null;
  lessons?: SupabaseLessonRecord[];
};

type SupabaseLessonRecord = {
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

  constructor(context: string, issues: string[]) {
    super(`${context} validation failed: ${issues.join('; ')}`);
    this.name = 'CourseValidationError';
    this.context = context;
    this.issues = issues;
  }
}

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
      return type;
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
  const content = (lesson as any).content_json ?? lesson.content ?? {};
  const completionRule = (lesson as any).completion_rule_json ?? undefined;

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

const mapCourseRecord = (course: SupabaseCourseRecord): NormalizedCourse => {
  const modules = (course.modules || []).map(mapModuleRecord);
  const meta = course.meta_json || {};
  const resolvedTitle = course.title || course.name || 'Untitled Course';

  const normalizedCourse = normalizeCourse({
    id: course.id,
    slug: course.slug || slugify(course.id || resolvedTitle || 'course'),
    title: resolvedTitle,
    description: course.description || meta.description || '',
    status: (course.status as Course['status']) || 'draft',
    thumbnail: meta.thumbnail || course.thumbnail || '',
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
  const sanitized = sanitizeSerializable(lesson.content ?? {}) || {};
  const content: LessonInput['content'] = {
    type: apiType,
    body: typeof sanitized === 'object' && sanitized !== null ? (sanitized as Record<string, unknown>) : {},
  };

  const resources = buildLessonResources(lesson);
  if (resources.length > 0) {
    content.resources = resources;
  }

  return content;
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

const buildLessonInput = (moduleId: string, lesson: Lesson, index: number): LessonInput => {
  const type = mapLessonTypeForApi(lesson.type);
  const estimatedMinutes =
    typeof lesson.estimatedDuration === 'number'
      ? lesson.estimatedDuration
      : parseDurationToMinutes(lesson.duration);
  const durationSeconds =
    typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) ? estimatedMinutes * 60 : null;

  const payload: LessonInput = {
    moduleId,
    title: (lesson.title || '').trim() || `Lesson ${index + 1}`,
    type,
    description: lesson.description ?? null,
    orderIndex: lesson.order ?? index,
    durationSeconds,
    content: buildLessonContent(lesson, type),
  };

  const completionRule = mapCompletionRule(lesson);
  if (completionRule) {
    payload.completionRule = completionRule;
  }

  return parseWithValidation(lessonSchema, payload, 'lesson');
};

const buildLessonPatch = (moduleId: string, lesson: Lesson, index: number): LessonPatchInput => {
  const base = buildLessonInput(moduleId, lesson, index);
  const patch: LessonPatchInput = {
    moduleId: base.moduleId,
    title: base.title,
    description: base.description ?? null,
    type: base.type,
    orderIndex: base.orderIndex,
    durationSeconds: base.durationSeconds ?? null,
    content: base.content,
  };

  if (base.completionRule !== undefined) {
    patch.completionRule = base.completionRule;
  }

  return parseWithValidation(lessonPatchSchema, patch, 'lesson');
};

const normalizeResource = (resource: Resource) => {
  const url = resource.url ?? resource.downloadUrl;
  if (!url) return null;

  return {
    id: resource.id,
    title: resource.title,
    description: resource.description ?? null,
    type: resource.type,
    url,
    downloadable: resource.downloadable ?? false,
    size: resource.size ?? null,
  };
};

const buildModuleMetadata = (module: Module): Record<string, unknown> | undefined => {
  if (!module.resources || module.resources.length === 0) {
    return undefined;
  }

  const resources = module.resources.map(normalizeResource).filter((item): item is NonNullable<ReturnType<typeof normalizeResource>> => !!item);

  if (resources.length === 0) {
    return undefined;
  }

  return { resources };
};

const buildModuleInput = (courseId: string, module: Module, index: number): ModuleInput => {
  const metadata = buildModuleMetadata(module);
  const payload: ModuleInput = {
    courseId,
    title: (module.title || '').trim() || `Module ${index + 1}`,
    description: module.description ?? null,
    orderIndex: module.order ?? index,
  };

  if (metadata) {
    payload.metadata = metadata;
  }

  return parseWithValidation(moduleSchema, payload, 'module');
};

const buildModulePatch = (module: Module, index: number): ModulePatchInput => {
  const metadata = buildModuleMetadata(module);
  const patch: ModulePatchInput = {
    title: (module.title || '').trim(),
    description: module.description ?? null,
    orderIndex: module.order ?? index,
  };

  if (metadata) {
    patch.metadata = metadata;
  }

  return parseWithValidation(modulePatchSchema, patch, 'module');
};

const guessOrganizationId = (course: Course | NormalizedCourse): string | null => {
  const candidate =
    (course as any).organizationId ??
    (course as any).organization_id ??
    (course as any).orgId ??
    (course as any).org_id ??
    null;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
};

const buildCoursePayload = (course: NormalizedCourse) => {
  const organizationId = guessOrganizationId(course);
  return {
    id: course.id,
    name: course.title,
    title: course.title,
    slug: course.slug || slugify(course.title || course.id),
    description: course.description,
    status: course.status || 'draft',
    version: (course as any).version ?? 1,
    org_id: organizationId,
    organizationId,
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
  private static async upsertCourse(course: NormalizedCourse): Promise<void> {
    const payload = buildCoursePayload(course);
    await apiRequest(`/api/admin/courses`, {
      method: 'POST',
      body: JSON.stringify({ course: payload }),
    });
  }

  private static async fetchCourseStructure(identifier: string): Promise<NormalizedCourse | null> {
    try {
      const queryParam = '?includeDrafts=true';
      const json = await apiRequest<{ data: SupabaseCourseRecord | null }>(`/api/client/courses/${identifier}${queryParam}`);
      if (!json.data) return null;
      return mapCourseRecord(json.data);
    } catch (error) {
      console.warn('Failed to fetch course structure', error);
      return null;
    }
  }

  private static async resolveExistingCourse(course: NormalizedCourse): Promise<NormalizedCourse | null> {
    const byId = await CourseService.fetchCourseStructure(course.id);
    if (byId) return byId;
    if (course.slug) {
      return CourseService.fetchCourseStructure(course.slug);
    }
    return null;
  }

  static async createModule(input: ModuleInput): Promise<ModuleDto> {
    const parsed = parseWithValidation(moduleSchema, input, 'module');
    const response = await apiRequest<{ data: ModuleDto }>('/api/admin/modules', {
      method: 'POST',
      body: JSON.stringify(parsed),
    });
    return response.data;
  }

  static async updateModule(moduleId: string, patch: ModulePatchInput): Promise<ModuleDto> {
    const parsed = parseWithValidation(modulePatchSchema, patch, 'module');
    const response = await apiRequest<{ data: ModuleDto }>(`/api/admin/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed),
    });
    return response.data;
  }

  static async deleteModule(moduleId: string): Promise<void> {
    await apiRequest(`/api/admin/modules/${moduleId}`, {
      method: 'DELETE',
      expectedStatus: [204],
    });
  }

  static async createLesson(input: LessonInput): Promise<LessonDto> {
    const parsed = parseWithValidation(lessonSchema, input, 'lesson');
    const response = await apiRequest<{ data: LessonDto }>('/api/admin/lessons', {
      method: 'POST',
      body: JSON.stringify(parsed),
    });
    return response.data;
  }

  static async updateLesson(lessonId: string, patch: LessonPatchInput): Promise<LessonDto> {
    const parsed = parseWithValidation(lessonPatchSchema, patch, 'lesson');
    const response = await apiRequest<{ data: LessonDto }>(`/api/admin/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed),
    });
    return response.data;
  }

  static async deleteLesson(lessonId: string): Promise<void> {
    await apiRequest(`/api/admin/lessons/${lessonId}`, {
      method: 'DELETE',
      expectedStatus: [204],
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
      body: JSON.stringify(parsed),
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
      body: JSON.stringify(parsed),
    });

    return response.data;
  }

  static async syncCourseToDatabase(course: Course): Promise<NormalizedCourse | null> {
    const normalizedCourse = normalizeCourse(course);
    await CourseService.upsertCourse(normalizedCourse);

    const existingCourse = await CourseService.resolveExistingCourse(normalizedCourse);
    const existingModulesMap = new Map<string, Module>(
      (existingCourse?.modules || [])
        .filter((module) => Boolean(module.id))
        .map((module) => [module.id as string, module]),
    );

    for (const [moduleIndex, module] of (normalizedCourse.modules || []).entries()) {
      const existingModule = module.id ? existingModulesMap.get(module.id) : undefined;
      const moduleId = existingModule?.id ?? module.id ?? null;

      if (moduleId && existingModule) {
        const updatedModule = await CourseService.updateModule(moduleId, buildModulePatch(module, moduleIndex));
        module.id = updatedModule.id;
        module.order = updatedModule.orderIndex ?? module.order ?? moduleIndex;
        existingModulesMap.delete(moduleId);

        const existingLessonsMap = new Map<string, Lesson>(
          (existingModule.lessons || [])
            .filter((lesson) => Boolean(lesson.id))
            .map((lesson) => [lesson.id as string, lesson]),
        );

        const targetLessons = module.lessons || [];
        for (const [lessonIndex, lesson] of targetLessons.entries()) {
          const lessonId = lesson.id ?? null;
          if (lessonId && existingLessonsMap.has(lessonId)) {
            const updatedLesson = await CourseService.updateLesson(
              lessonId,
              buildLessonPatch(moduleId, lesson, lessonIndex),
            );
            lesson.id = updatedLesson.id;
            lesson.order = updatedLesson.orderIndex ?? lesson.order ?? lessonIndex;
            existingLessonsMap.delete(lessonId);
          } else {
            const createdLesson = await CourseService.createLesson(
              buildLessonInput(moduleId, lesson, lessonIndex),
            );
            lesson.id = createdLesson.id;
            lesson.order = createdLesson.orderIndex ?? lesson.order ?? lessonIndex;
          }
        }

        for (const orphanLessonId of existingLessonsMap.keys()) {
          await CourseService.deleteLesson(orphanLessonId);
        }
      } else {
        const createdModule = await CourseService.createModule(
          buildModuleInput(normalizedCourse.id, module, moduleIndex),
        );
        module.id = createdModule.id;
        module.order = createdModule.orderIndex ?? module.order ?? moduleIndex;
        const createdModuleId = createdModule.id;

        const targetLessons = module.lessons || [];
        for (const [lessonIndex, lesson] of targetLessons.entries()) {
          const createdLesson = await CourseService.createLesson(
            buildLessonInput(createdModuleId, lesson, lessonIndex),
          );
          lesson.id = createdLesson.id;
          lesson.order = createdLesson.orderIndex ?? lesson.order ?? lessonIndex;
        }
      }
    }

    for (const orphanModuleId of existingModulesMap.keys()) {
      await CourseService.deleteModule(orphanModuleId);
    }

    const modulesForOrdering = (normalizedCourse.modules || []).filter((module) => Boolean(module.id));
    if (modulesForOrdering.length > 0) {
      const reorderedModules = await CourseService.reorderModules(normalizedCourse.id, modulesForOrdering);
      const moduleOrderMap = new Map<string, number>(
        reorderedModules.map((module) => [module.id, module.orderIndex ?? 0]),
      );

      modulesForOrdering.forEach((module) => {
        const updatedOrder = moduleOrderMap.get(module.id as string);
        if (typeof updatedOrder === 'number') {
          module.order = updatedOrder;
        }
      });

      await Promise.all(
        modulesForOrdering.map(async (module) => {
          const reorderedLessons = await CourseService.reorderLessons(
            module.id as string,
            module.lessons || [],
          );
          const lessonOrderMap = new Map<string, number>(
            reorderedLessons.map((lesson) => [lesson.id, lesson.orderIndex ?? 0]),
          );

          (module.lessons || []).forEach((lesson) => {
            const updatedOrder = lessonOrderMap.get(lesson.id as string);
            if (typeof updatedOrder === 'number') {
              lesson.order = updatedOrder;
            }
          });
        }),
      );
    }

    const refreshed =
      (await CourseService.fetchCourseStructure(normalizedCourse.id)) ??
      (normalizedCourse.slug ? await CourseService.fetchCourseStructure(normalizedCourse.slug) : null);

    return refreshed ?? normalizedCourse;
  }

  static async loadCourseFromDatabase(
    identifier: string,
    options: { includeDrafts?: boolean } = {},
  ): Promise<NormalizedCourse | null> {
    const { includeDrafts = false } = options;
    const normalizedIdentifier = identifier.trim();

    const queryParam = includeDrafts ? '?includeDrafts=true' : '';

    try {
      const json = await apiRequest<{ data: SupabaseCourseRecord | null }>(
        `/api/client/courses/${normalizedIdentifier}${queryParam}`,
      );
      if (!json.data) {
        const slugCandidate = slugify(normalizedIdentifier);
        if (slugCandidate && slugCandidate !== normalizedIdentifier) {
          const slugJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
            `/api/client/courses/${slugCandidate}${queryParam}`,
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

  static async getPublishedCourses(): Promise<NormalizedCourse[]> {
    try {
      const json = await apiRequest<{ data: SupabaseCourseRecord[] }>('/api/client/courses');
      return (json.data || []).map(mapCourseRecord);
    } catch (error) {
      console.error('Error loading published courses:', error);
      return [];
    }
  }

  static async getAllCoursesFromDatabase(): Promise<NormalizedCourse[]> {
    try {
      const json = await apiRequest<{ data: SupabaseCourseRecord[] }>('/api/admin/courses');
      return (json.data || []).map(mapCourseRecord);
    } catch (error) {
      console.error('Error loading courses from API:', error);
      return [];
    }
  }

  static async deleteCourseFromDatabase(courseId: string): Promise<void> {
    await apiRequest(`/api/admin/courses/${courseId}`, {
      method: 'DELETE',
    });
  }
}
