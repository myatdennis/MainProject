import { randomUUID } from 'crypto';
import type { Course, Module, Lesson } from '../../types/courseTypes.js';
import { normalizeCourse, type NormalizedCourse, slugify } from '../../utils/courseNormalization.js';
import { supabaseServiceClient } from '../supabase/supabaseServerClient.js';

export interface CourseStoreRecord extends NormalizedCourse {
  assignments: Set<string>;
  createdAt?: string;
  updatedAt?: string;
}

const courseStore = new Map<string, CourseStoreRecord>();
const supabase = supabaseServiceClient;
const supabaseEnabled = Boolean(supabase);

const seedCourses: Course[] = [
  buildCourse(
    'foundations-inclusive-leadership',
    'Foundations of Inclusive Leadership',
    'Build the muscles for psychological safety, courageous conversations, and equitable decisions.',
    'published',
    [
      buildModule('introduction', 'Introduction', [
        buildLesson('lesson-welcome', 'Welcome to the Journey', 'video', 8),
        buildLesson('lesson-psych-safety', 'Psychological Safety Basics', 'text', 5),
      ]),
      buildModule('practice', 'Practice Lab', [
        buildLesson('lesson-feedback', 'Feedback Framework', 'interactive', 12),
      ]),
    ],
  ),
  buildCourse(
    'bias-interrupters',
    'Bias Interrupters Bootcamp',
    'Identify the top bias patterns in reviews, hiring, and meetings—and replace them with equitable defaults.',
    'draft',
    [
      buildModule('awareness', 'Awareness', [
        buildLesson('lesson-patterns', 'Bias Pattern Spotting', 'video', 9),
        buildLesson('lesson-retros', 'Retrospective Toolkit', 'quiz', 6),
      ]),
    ],
  ),
];

seedCourses.forEach((course, index) => {
  const normalized = normalizeCourse(course);
  const record: CourseStoreRecord = {
    ...normalized,
    assignments: new Set<string>(),
    createdAt: course.createdDate ?? new Date().toISOString(),
    updatedAt: course.lastUpdated ?? new Date().toISOString(),
  };
  const defaultOrgId = index % 2 === 0 ? 'org-huddle' : 'org-pacific';
  record.assignments.add(defaultOrgId);
  courseStore.set(record.id, record);
});

interface CourseListOptions {
  assignedOnly?: boolean;
  orgId?: string;
}

const listPublishedCoursesFromMemory = (options: CourseListOptions = {}): NormalizedCourse[] => {
  const { assignedOnly = false, orgId } = options;
  let records = Array.from(courseStore.values()).filter((course) => course.status === 'published');

  if (assignedOnly) {
    if (!orgId) {
      return [];
    }
    records = records.filter((course) => course.assignments.has(orgId));
  }

  return serializeCourses(records);
};

const listAllCoursesFromMemory = (): NormalizedCourse[] => serializeCourses(Array.from(courseStore.values()));

const listCoursesForOrgFromMemory = (orgId: string): NormalizedCourse[] => {
  if (!orgId) return [];
  const scoped = Array.from(courseStore.values()).filter((course) => course.assignments.has(orgId));
  return serializeCourses(scoped);
};

const getCourseByIdentifierFromMemory = (identifier: string): NormalizedCourse | undefined => {
  const normalizedId = identifier.trim().toLowerCase();
  const match = Array.from(courseStore.values()).find((course) => {
    return course.id === normalizedId || course.slug === normalizedId || slugify(course.title) === normalizedId;
  });
  return match ? serializeCourse(match) : undefined;
};

export interface CourseUpsertInput extends Partial<Course> {
  id?: string;
  title: string;
}

const upsertCourseInMemory = (input: CourseUpsertInput): NormalizedCourse => {
  const courseId = input.id ?? randomUUID();
  const seed: Course = {
    id: courseId,
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'draft',
    thumbnail: input.thumbnail ?? '',
    difficulty: input.difficulty ?? 'Beginner',
    estimatedTime: input.estimatedTime ?? '45 min',
    prerequisites: input.prerequisites ?? [],
    keyTakeaways: input.keyTakeaways ?? [],
    tags: input.tags ?? [],
    learningObjectives: input.learningObjectives ?? [],
    createdBy: input.createdBy ?? 'The Huddle Co.',
    createdDate: input.createdDate ?? new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    modules: (input.modules as Module[]) ?? [],
    chapters: input.chapters ?? [],
    lessons: input.lessons ?? 0,
    rating: input.rating ?? 0,
    progress: input.progress ?? 0,
    enrollments: input.enrollments ?? 0,
    completionRate: input.completionRate ?? 0,
    avgRating: input.avgRating ?? 0,
    totalRatings: input.totalRatings ?? 0,
    duration: input.duration ?? '0 min',
  } as Course;

  const normalized = normalizeCourse(seed);
  const existingAssignments = courseStore.get(courseId)?.assignments ?? new Set<string>();
  const record: CourseStoreRecord = {
    ...normalized,
    assignments: existingAssignments,
    updatedAt: new Date().toISOString(),
  };
  courseStore.set(courseId, record);
  return serializeCourse(record);
};

const publishCourseInMemory = (id: string): NormalizedCourse | undefined => {
  const record = courseStore.get(id);
  if (!record) return undefined;
  record.status = 'published';
  record.updatedAt = new Date().toISOString();
  return serializeCourse(record);
};

const deleteCourseInMemory = (id: string): boolean => {
  return courseStore.delete(id);
};

const assignCourseInMemory = (
  id: string,
  organizationId: string,
): { courseId: string; organizationId: string; totalAssignments: number } | null => {
  const record = courseStore.get(id);
  if (!record) return null;
  record.assignments.add(organizationId);
  return { courseId: id, organizationId, totalAssignments: record.assignments.size };
};

const serializeCourse = (record: CourseStoreRecord): NormalizedCourse => {
  const { assignments, ...rest } = record;
  return { ...rest };
};

const serializeCourses = (records: CourseStoreRecord[]): NormalizedCourse[] => records.map(serializeCourse);

function buildCourse(id: string, title: string, description: string, status: Course['status'], modules: Module[]): Course {
  return {
    id,
    title,
    description,
    status,
    thumbnail: '',
    duration: '45 min',
    difficulty: 'Beginner',
    estimatedTime: '45 min',
    progress: 0,
    rating: 0,
    lessons: modules.reduce((sum, module) => sum + module.lessons.length, 0),
    modules,
    chapters: [],
    enrollments: 0,
    completionRate: 0,
    avgRating: 0,
    totalRatings: 0,
    learningObjectives: [
      'Understand the root causes of inequity',
      'Practice micro-behavior rewrites',
    ],
    keyTakeaways: ['Inclusion is a daily habit'],
    tags: ['inclusion', 'leadership'],
    prerequisites: [],
    createdBy: 'The Huddle Co.',
    createdDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  } as Course;
}

function buildModule(id: string, title: string, lessons: Lesson[]): Module {
  return {
    id,
    title,
    description: '',
    order: 1,
    duration: '20 min',
    lessons,
    resources: [],
  } as Module;
}

function buildLesson(id: string, title: string, type: Lesson['type'], minutes: number): Lesson {
  return {
    id,
    title,
    description: '',
    type,
    duration: `${minutes} min`,
    estimatedDuration: minutes,
    completed: false,
    order: 1,
    content: {
      schema_version: 1,
      type,
      body: {
        textContent: `${title} content`,
      },
    },
    resources: [],
  } as Lesson;
}

const courseSelectColumns = [
  'id',
  'slug',
  'title',
  'description',
  'status',
  'organization_id',
  'meta_json',
  'created_at',
  'updated_at',
  'published_at',
];

const nowIso = () => new Date().toISOString();

const mapCourseRowToNormalized = (row: any): NormalizedCourse => {
  if (!row) {
    throw new Error('Course row is empty');
  }
  const meta = (row.meta_json ?? {}) as Partial<Course>;
  const base: Course = {
    id: row.id,
    title: row.title ?? meta.title ?? 'Untitled Course',
    description: row.description ?? meta.description ?? '',
    slug: row.slug ?? meta.slug ?? slugify(row.title ?? meta.title ?? row.id ?? randomUUID()),
    organizationId: row.organization_id ?? meta.organizationId ?? null,
    thumbnail: meta.thumbnail ?? '',
    difficulty: (meta.difficulty as Course['difficulty']) ?? 'Beginner',
    duration: meta.duration ?? '0 min',
    status: (row.status ?? meta.status ?? 'draft') as Course['status'],
    modules: meta.modules ?? [],
    chapters: meta.chapters ?? [],
    lessons: meta.lessons ?? 0,
    learningObjectives: meta.learningObjectives ?? [],
    prerequisites: meta.prerequisites ?? [],
    tags: meta.tags ?? [],
    keyTakeaways: meta.keyTakeaways ?? [],
    createdAt: row.created_at ?? meta.createdAt,
    updatedAt: row.updated_at ?? meta.updatedAt,
    publishedAt: row.published_at ?? meta.publishedAt,
    estimatedDuration: meta.estimatedDuration,
    progress: meta.progress,
    rating: meta.rating,
    enrollments: meta.enrollments,
    completionRate: meta.completionRate,
    avgRating: meta.avgRating,
    totalRatings: meta.totalRatings,
    createdBy: meta.createdBy ?? 'The Huddle Co.',
    metadata: meta.metadata ?? {},
  } as Course;

  return normalizeCourse(base);
};

const ensureCourseSeed = (input: CourseUpsertInput): Course => {
  const courseId = input.id ?? randomUUID();
  return {
    id: courseId,
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'draft',
    thumbnail: input.thumbnail ?? '',
    difficulty: input.difficulty ?? 'Beginner',
    duration: input.duration ?? '0 min',
    estimatedTime: input.estimatedTime ?? input.duration ?? '45 min',
    prerequisites: input.prerequisites ?? [],
    keyTakeaways: input.keyTakeaways ?? [],
    tags: input.tags ?? [],
    learningObjectives: input.learningObjectives ?? [],
    createdBy: input.createdBy ?? 'The Huddle Co.',
    createdDate: input.createdDate ?? nowIso(),
    lastUpdated: nowIso(),
    modules: (input.modules as Module[]) ?? [],
    chapters: input.chapters ?? [],
    lessons: input.lessons ?? 0,
    rating: input.rating ?? 0,
    progress: input.progress ?? 0,
    enrollments: input.enrollments ?? 0,
    completionRate: input.completionRate ?? 0,
    avgRating: input.avgRating ?? 0,
    totalRatings: input.totalRatings ?? 0,
    organizationId: input.organizationId ?? null,
  } as Course;
};

const selectCourses = () => supabase!.from('courses').select(courseSelectColumns.join(','));

const listPublishedCoursesFromSupabase = async (options: CourseListOptions = {}): Promise<NormalizedCourse[]> => {
  const { assignedOnly = false, orgId } = options;
  if (assignedOnly && !orgId) {
    return [];
  }

  let query = selectCourses().eq('status', 'published');

  if (orgId) {
    if (assignedOnly) {
      const assignmentIds = await fetchAssignedCourseIds(orgId);
      if (assignmentIds.length === 0) {
        return [];
      }
      query = query.in('id', assignmentIds);
    } else {
      query = query.eq('organization_id', orgId);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapCourseRowToNormalized);
};

const listAllCoursesFromSupabase = async (): Promise<NormalizedCourse[]> => {
  const { data, error } = await selectCourses();
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapCourseRowToNormalized);
};

const listCoursesForOrgSupabase = async (orgId: string): Promise<NormalizedCourse[]> => {
  if (!orgId) return [];
  const { data, error } = await selectCourses().eq('organization_id', orgId);
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapCourseRowToNormalized);
};

const getCourseByIdentifierSupabase = async (identifier: string): Promise<NormalizedCourse | undefined> => {
  const normalized = identifier.trim().toLowerCase();
  const { data, error } = await selectCourses()
    .or(`id.eq.${normalized},slug.eq.${normalized}`)
    .limit(1);
  if (error) {
    throw error;
  }
  const row = data?.[0];
  return row ? mapCourseRowToNormalized(row) : undefined;
};

const upsertCourseSupabase = async (input: CourseUpsertInput): Promise<NormalizedCourse> => {
  const seed = ensureCourseSeed(input);
  const normalized = normalizeCourse(seed);
  const payload = {
    id: normalized.id,
    slug: normalized.slug,
    title: normalized.title,
    description: normalized.description,
    status: normalized.status,
    organization_id: normalized.organizationId ?? null,
    meta_json: normalized,
    published_at: normalized.status === 'published' ? normalized.publishedAt ?? nowIso() : null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase!
    .from('courses')
    .upsert(payload)
    .select(courseSelectColumns.join(','))
    .single();
  if (error) {
    throw error;
  }
  return mapCourseRowToNormalized(data);
};

const publishCourseSupabase = async (id: string): Promise<NormalizedCourse | undefined> => {
  const { data, error } = await supabase!
    .from('courses')
    .update({ status: 'published', published_at: nowIso() })
    .eq('id', id)
    .select(courseSelectColumns.join(','))
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      return undefined;
    }
    throw error;
  }
  return data ? mapCourseRowToNormalized(data) : undefined;
};

const deleteCourseSupabase = async (id: string): Promise<boolean> => {
  const { error } = await supabase!.from('courses').delete().eq('id', id);
  if (error) {
    throw error;
  }
  return true;
};

const assignCourseSupabase = async (
  id: string,
  organizationId: string,
): Promise<{ courseId: string; organizationId: string; totalAssignments: number }> => {
  const timestamp = nowIso();
  const { error } = await supabase!
    .from('assignments')
    .upsert(
      {
        course_id: id,
        organization_id: organizationId,
        active: true,
        updated_at: timestamp,
        created_at: timestamp,
      },
      { onConflict: 'organization_id,course_id' },
    );
  if (error) {
    throw error;
  }
  const { count } = await supabase!
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', id);
  return { courseId: id, organizationId, totalAssignments: count ?? 1 };
};

const fetchAssignedCourseIds = async (orgId: string): Promise<string[]> => {
  const { data, error } = await supabase!
    .from('assignments')
    .select('course_id')
    .eq('organization_id', orgId)
    .eq('active', true);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => row.course_id).filter((id): id is string => Boolean(id));
};

export const listPublishedCourses = async (options: CourseListOptions = {}): Promise<NormalizedCourse[]> => {
  if (supabaseEnabled) {
    return listPublishedCoursesFromSupabase(options);
  }
  return listPublishedCoursesFromMemory(options);
};

export const listAllCourses = async (): Promise<NormalizedCourse[]> => {
  if (supabaseEnabled) {
    return listAllCoursesFromSupabase();
  }
  return listAllCoursesFromMemory();
};

export const listCoursesForOrg = async (orgId: string): Promise<NormalizedCourse[]> => {
  if (supabaseEnabled) {
    return listCoursesForOrgSupabase(orgId);
  }
  return listCoursesForOrgFromMemory(orgId);
};

export const getCourseByIdentifier = async (identifier: string): Promise<NormalizedCourse | undefined> => {
  if (supabaseEnabled) {
    return getCourseByIdentifierSupabase(identifier);
  }
  return getCourseByIdentifierFromMemory(identifier);
};

export const upsertCourse = async (input: CourseUpsertInput): Promise<NormalizedCourse> => {
  if (supabaseEnabled) {
    return upsertCourseSupabase(input);
  }
  return upsertCourseInMemory(input);
};

export const publishCourse = async (id: string): Promise<NormalizedCourse | undefined> => {
  if (supabaseEnabled) {
    return publishCourseSupabase(id);
  }
  return publishCourseInMemory(id);
};

export const deleteCourse = async (id: string): Promise<boolean> => {
  if (supabaseEnabled) {
    return deleteCourseSupabase(id);
  }
  return deleteCourseInMemory(id);
};

export const assignCourse = async (
  id: string,
  organizationId: string,
): Promise<{ courseId: string; organizationId: string; totalAssignments: number } | null> => {
  if (supabaseEnabled) {
    return assignCourseSupabase(id, organizationId);
  }
  return assignCourseInMemory(id, organizationId);
};
