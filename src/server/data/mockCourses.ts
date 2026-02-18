import { randomUUID } from 'crypto';
import type { Course, Module, Lesson } from '../../types/courseTypes.js';
import { normalizeCourse, type NormalizedCourse, slugify } from '../../utils/courseNormalization.js';

export interface CourseStoreRecord extends NormalizedCourse {
  assignments: Set<string>;
  createdAt?: string;
  updatedAt?: string;
}

const courseStore = new Map<string, CourseStoreRecord>();

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

seedCourses.forEach((course) => {
  const normalized = normalizeCourse(course);
  const record: CourseStoreRecord = {
    ...normalized,
    assignments: new Set<string>(),
    createdAt: course.createdDate ?? new Date().toISOString(),
    updatedAt: course.lastUpdated ?? new Date().toISOString(),
  };
  courseStore.set(record.id, record);
});

interface CourseListOptions {
  assignedOnly?: boolean;
  orgId?: string;
}

export const listPublishedCourses = (options: CourseListOptions = {}): NormalizedCourse[] => {
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

export const listAllCourses = (): NormalizedCourse[] => serializeCourses(Array.from(courseStore.values()));

export const getCourseByIdentifier = (identifier: string): NormalizedCourse | undefined => {
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

export const upsertCourse = (input: CourseUpsertInput): NormalizedCourse => {
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

export const publishCourse = (id: string): NormalizedCourse | undefined => {
  const record = courseStore.get(id);
  if (!record) return undefined;
  record.status = 'published';
  record.updatedAt = new Date().toISOString();
  return serializeCourse(record);
};

export const deleteCourse = (id: string): boolean => {
  return courseStore.delete(id);
};

export const assignCourse = (id: string, organizationId: string): { courseId: string; organizationId: string; totalAssignments: number } | null => {
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
