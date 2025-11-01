export type UUID = string;

export interface LessonContent {
  type: 'video' | 'quiz' | 'reflection' | 'text' | 'resource';
  body?: Record<string, unknown>;
  resources?: Array<{ label: string; url: string }>;
}

export interface Lesson {
  id: UUID;
  moduleId: UUID;
  title: string;
  description?: string | null;
  orderIndex: number;
  type: 'video' | 'quiz' | 'reflection' | 'text' | 'resource';
  durationSeconds?: number | null;
  content: LessonContent;
  completionRule?: {
    type: 'time_spent' | 'quiz_score' | 'manual';
    value?: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: UUID;
  courseId: UUID;
  title: string;
  description?: string | null;
  orderIndex: number;
  metadata?: Record<string, unknown> | null;
  lessons?: Lesson[];
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: UUID;
  name: string;
  slug: string;
  organizationId: string | null;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  modules?: Module[];
}

export interface ModuleCreate {
  courseId: UUID;
  title: string;
  description?: string | null;
  orderIndex?: number;
  metadata?: Record<string, unknown> | null;
}

export interface ModulePatch {
  title?: string;
  description?: string | null;
  orderIndex?: number;
  metadata?: Record<string, unknown> | null;
}

export interface LessonCreate {
  moduleId: UUID;
  title: string;
  type: Lesson['type'];
  description?: string | null;
  orderIndex?: number;
  durationSeconds?: number | null;
  content: LessonContent;
  completionRule?: Lesson['completionRule'];
}

export interface LessonPatch {
  moduleId?: UUID;
  title?: string;
  type?: Lesson['type'];
  description?: string | null;
  orderIndex?: number;
  durationSeconds?: number | null;
  content?: LessonContent;
  completionRule?: Lesson['completionRule'];
}

export interface ProgressSnapshot {
  userId: UUID;
  courseId: UUID;
  lessonIds: UUID[];
  lessons: Array<{
    lessonId: UUID;
    progressPercent: number;
    completed: boolean;
    positionSeconds?: number;
    lastAccessedAt?: string;
  }>;
  overallPercent: number;
  completedAt?: string | null;
  totalTimeSeconds?: number | null;
  lastLessonId?: UUID | null;
}

export interface ReorderItem {
  id: UUID;
  orderIndex: number;
}

export interface ModuleReorderInput {
  courseId: UUID;
  modules: ReorderItem[];
}

export interface LessonReorderInput {
  moduleId: UUID;
  lessons: ReorderItem[];
}
