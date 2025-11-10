import { normalizeCourse, slugify, parseDurationToMinutes, formatMinutes, } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { moduleSchema, modulePatchSchema, lessonSchema, lessonPatchSchema, moduleReorderSchema, lessonReorderSchema, } from '../types/apiSchemas';
import { ZodError } from 'zod';
export class CourseValidationError extends Error {
    constructor(context, issues) {
        super(`${context} validation failed: ${issues.join('; ')}`);
        this.name = 'CourseValidationError';
        this.context = context;
        this.issues = issues;
    }
}
const formatZodIssues = (error, context) => {
    return error.issues.map((issue) => {
        const path = issue.path && issue.path.length > 0 ? `${context}.${issue.path.join('.')}` : context;
        return `${path}: ${issue.message}`;
    });
};
const parseWithValidation = (schema, data, context) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof ZodError) {
            const issues = formatZodIssues(error, context);
            throw new CourseValidationError(context, issues);
        }
        throw error;
    }
};
const mapLessonTypeFromSupabase = (type) => {
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
const mapLessonRecord = (lesson) => {
    const durationValue = lesson.duration ?? lesson.duration_s;
    const estimatedMinutes = typeof durationValue === 'number'
        ? Math.round(durationValue / 60)
        : parseDurationToMinutes(typeof durationValue === 'string' ? durationValue : undefined);
    const content = lesson.content_json ?? lesson.content ?? {};
    const completionRule = lesson.completion_rule_json ?? undefined;
    return {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description || '',
        type: mapLessonTypeFromSupabase(lesson.type),
        order: lesson.order_index ?? 0,
        estimatedDuration: estimatedMinutes ?? undefined,
        duration: typeof durationValue === 'string'
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
const mapModuleRecord = (module) => {
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
const mapCourseRecord = (course) => {
    const modules = (course.modules || []).map(mapModuleRecord);
    const meta = course.meta_json || {};
    const resolvedTitle = course.title || course.name || 'Untitled Course';
    const normalizedCourse = normalizeCourse({
        id: course.id,
        slug: course.slug || slugify(course.id || resolvedTitle || 'course'),
        title: resolvedTitle,
        description: course.description || meta.description || '',
        status: course.status || 'draft',
        thumbnail: meta.thumbnail || course.thumbnail || '',
        duration: course.duration ||
            meta.duration ||
            formatMinutes(modules.reduce((sum, module) => {
                return sum + (module.lessons || []).reduce((innerSum, lesson) => innerSum + (lesson.estimatedDuration ?? 0), 0);
            }, 0)) ||
            '0 min',
        difficulty: meta.difficulty || course.difficulty || 'Beginner',
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
    });
    return normalizedCourse;
};
const isFileLike = (value) => {
    if (typeof File !== 'undefined' && value instanceof File)
        return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob)
        return true;
    return false;
};
const sanitizeSerializable = (value) => {
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
        const result = {};
        Object.entries(value).forEach(([key, val]) => {
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
const mapLessonTypeForApi = (type) => {
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
const buildLessonResources = (lesson) => {
    const directResources = Array.isArray(lesson.resources) ? lesson.resources : [];
    const normalizedResources = directResources
        .map((resource) => {
        const url = resource.url ?? resource.downloadUrl ?? null;
        if (!url)
            return null;
        const label = resource.title || resource.description || 'Resource';
        return { label, url };
    })
        .filter((entry) => !!entry);
    return normalizedResources;
};
const buildLessonContent = (lesson, apiType) => {
    const sanitized = sanitizeSerializable(lesson.content ?? {}) || {};
    const content = {
        type: apiType,
        body: typeof sanitized === 'object' && sanitized !== null ? sanitized : {},
    };
    const resources = buildLessonResources(lesson);
    if (resources.length > 0) {
        content.resources = resources;
    }
    return content;
};
const mapCompletionRule = (lesson) => {
    const rule = lesson.completionRule;
    if (!rule || typeof rule !== 'object') {
        return null;
    }
    const typeCandidate = typeof rule.type === 'string'
        ? rule.type
        : typeof rule.mode === 'string'
            ? rule.mode
            : undefined;
    if (!typeCandidate) {
        return null;
    }
    if (typeCandidate !== 'time_spent' && typeCandidate !== 'quiz_score' && typeCandidate !== 'manual') {
        return null;
    }
    const rawValue = rule.value ?? rule.minutes ?? rule.threshold ?? null;
    const numericValue = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : undefined;
    return {
        type: typeCandidate,
        ...(numericValue !== undefined ? { value: numericValue } : {}),
    };
};
// Removed granular build helpers in favor of single upsert path; keep create/update APIs for targeted edits.
// Resource normalization handled at call sites as needed; no-op here after consolidation.
// Legacy metadata builder retained for reference; module resources can be attached via metadata when needed.
const guessOrganizationId = (course) => {
    const candidate = course.organizationId ??
        course.organization_id ??
        course.orgId ??
        course.org_id ??
        null;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
};
const buildCoursePayload = (course) => {
    const organizationId = guessOrganizationId(course);
    return {
        id: course.id,
        name: course.title,
        title: course.title,
        slug: course.slug || slugify(course.title || course.id),
        description: course.description,
        status: course.status || 'draft',
        version: course.version ?? 1,
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
    static buildModulesPayloadForUpsert(course) {
        const modules = (course.modules || []).map((mod, moduleIndex) => {
            const lessons = (mod.lessons || []).map((lesson, lessonIndex) => {
                const apiType = mapLessonTypeForApi(lesson.type);
                const estimatedMinutes = typeof lesson.estimatedDuration === 'number'
                    ? lesson.estimatedDuration
                    : parseDurationToMinutes(lesson.duration);
                const durationSeconds = typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) ? estimatedMinutes * 60 : null;
                const content = buildLessonContent(lesson, apiType);
                const completionRule = mapCompletionRule(lesson);
                return {
                    id: lesson.id,
                    title: (lesson.title || '').trim() || `Lesson ${lessonIndex + 1}`,
                    description: lesson.description ?? null,
                    type: apiType,
                    order_index: lesson.order ?? lessonIndex,
                    duration_s: durationSeconds,
                    content_json: content,
                    completion_rule_json: completionRule ?? null,
                };
            });
            return {
                id: mod.id,
                title: (mod.title || '').trim() || `Module ${moduleIndex + 1}`,
                description: mod.description ?? null,
                order_index: mod.order ?? moduleIndex,
                lessons,
            };
        });
        return modules;
    }
    static async upsertCourse(course) {
        const payload = buildCoursePayload(course);
        const modules = CourseService.buildModulesPayloadForUpsert(course);
        await apiRequest(`/api/admin/courses`, {
            method: 'POST',
            body: JSON.stringify({ course: payload, modules }),
        });
    }
    static async fetchCourseStructure(identifier) {
        try {
            const queryParam = '?includeDrafts=true';
            const json = await apiRequest(`/api/client/courses/${identifier}${queryParam}`, { noTransform: true });
            if (!json.data)
                return null;
            return mapCourseRecord(json.data);
        }
        catch (error) {
            console.warn('Failed to fetch course structure', error);
            return null;
        }
    }
    // resolveExistingCourse no longer required with single upsert path; fetching occurs post-upsert.
    static async createModule(input) {
        const parsed = parseWithValidation(moduleSchema, input, 'module');
        const response = await apiRequest('/api/admin/modules', {
            method: 'POST',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async updateModule(moduleId, patch) {
        const parsed = parseWithValidation(modulePatchSchema, patch, 'module');
        const response = await apiRequest(`/api/admin/modules/${moduleId}`, {
            method: 'PATCH',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async deleteModule(moduleId) {
        await apiRequest(`/api/admin/modules/${moduleId}`, {
            method: 'DELETE',
            expectedStatus: [204],
        });
    }
    static async createLesson(input) {
        const parsed = parseWithValidation(lessonSchema, input, 'lesson');
        const response = await apiRequest('/api/admin/lessons', {
            method: 'POST',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async updateLesson(lessonId, patch) {
        const parsed = parseWithValidation(lessonPatchSchema, patch, 'lesson');
        const response = await apiRequest(`/api/admin/lessons/${lessonId}`, {
            method: 'PATCH',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async deleteLesson(lessonId) {
        await apiRequest(`/api/admin/lessons/${lessonId}`, {
            method: 'DELETE',
            expectedStatus: [204],
        });
    }
    static async reorderModules(courseId, modules) {
        const moduleOrder = modules
            .filter((module) => Boolean(module.id))
            .map((module, index) => ({
            id: module.id,
            orderIndex: module.order ?? index,
        }));
        if (moduleOrder.length === 0) {
            return [];
        }
        const payload = {
            courseId,
            modules: moduleOrder,
        };
        const parsed = parseWithValidation(moduleReorderSchema, payload, 'moduleOrder');
        const response = await apiRequest('/api/admin/modules/reorder', {
            method: 'POST',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async reorderLessons(moduleId, lessons) {
        const lessonOrder = lessons
            .filter((lesson) => Boolean(lesson.id))
            .map((lesson, index) => ({
            id: lesson.id,
            orderIndex: lesson.order ?? index,
        }));
        if (lessonOrder.length === 0) {
            return [];
        }
        const payload = {
            moduleId,
            lessons: lessonOrder,
        };
        const parsed = parseWithValidation(lessonReorderSchema, payload, 'lessonOrder');
        const response = await apiRequest('/api/admin/lessons/reorder', {
            method: 'POST',
            body: JSON.stringify(parsed),
        });
        return response.data;
    }
    static async syncCourseToDatabase(course) {
        const normalizedCourse = normalizeCourse(course);
        // Single upsert with full graph (course + modules + lessons)
        await CourseService.upsertCourse(normalizedCourse);
        // Reload fresh graph to get server-assigned IDs and order
        const refreshed = (await CourseService.fetchCourseStructure(normalizedCourse.id)) ||
            (normalizedCourse.slug ? await CourseService.fetchCourseStructure(normalizedCourse.slug) : null);
        return refreshed ?? normalizedCourse;
    }
    static async loadCourseFromDatabase(identifier, options = {}) {
        const { includeDrafts = false } = options;
        const normalizedIdentifier = identifier.trim();
        const queryParam = includeDrafts ? '?includeDrafts=true' : '';
        try {
            const json = await apiRequest(`/api/client/courses/${normalizedIdentifier}${queryParam}`, { noTransform: true });
            if (!json.data) {
                const slugCandidate = slugify(normalizedIdentifier);
                if (slugCandidate && slugCandidate !== normalizedIdentifier) {
                    const slugJson = await apiRequest(`/api/client/courses/${slugCandidate}${queryParam}`, { noTransform: true });
                    if (slugJson.data) {
                        return mapCourseRecord(slugJson.data);
                    }
                }
                return null;
            }
            return mapCourseRecord(json.data);
        }
        catch (error) {
            console.error('Error loading course from API:', error);
            throw error;
        }
    }
    static async getPublishedCourses() {
        try {
            const json = await apiRequest('/api/client/courses', { noTransform: true });
            return (json.data || []).map(mapCourseRecord);
        }
        catch (error) {
            console.error('Error loading published courses:', error);
            return [];
        }
    }
    static async getAllCoursesFromDatabase() {
        try {
            console.log('[CourseService.getAllCoursesFromDatabase] Fetching from /api/admin/courses...');
            const json = await apiRequest('/api/admin/courses', { noTransform: true });
            console.log('[CourseService.getAllCoursesFromDatabase] Raw response:', json);
            const mapped = (json.data || []).map(mapCourseRecord);
            console.log('[CourseService.getAllCoursesFromDatabase] Mapped courses:', mapped);
            return mapped;
        }
        catch (error) {
            console.error('[CourseService.getAllCoursesFromDatabase] Error loading courses from API:', error);
            return [];
        }
    }
    static async deleteCourseFromDatabase(courseId) {
        await apiRequest(`/api/admin/courses/${courseId}`, {
            method: 'DELETE',
        });
    }
}
