import { randomUUID } from 'crypto';

export interface LessonProgressRecord {
  userId: string;
  courseId: string;
  lessonId: string;
  progressPercent: number;
  completed: boolean;
  positionSeconds: number;
  lastAccessedAt?: string;
  timeSpentSeconds?: number;
}

export interface CourseProgressRecord {
  userId: string;
  courseId: string;
  percent: number;
  status?: string;
  timeSpentSeconds?: number;
  updatedAt: string;
  lastLessonId?: string | null;
  completedAt?: string | null;
}

export interface LessonProgressRow {
  lesson_id: string;
  progress_percentage: number;
  completed: boolean;
  time_spent: number;
  last_accessed_at: string | null;
}

export interface ProgressSnapshotInput {
  userId: string;
  courseId: string;
  lessons: Array<{
    lessonId: string;
    progressPercent: number;
    completed: boolean;
    positionSeconds: number;
    lastAccessedAt?: string;
  }>;
  course: {
    percent: number;
    completedAt?: string | null;
    totalTimeSeconds?: number | null;
    lastLessonId?: string | null;
  };
}

export interface ProgressEventInput {
  clientEventId?: string;
  type: 'lesson_progress' | 'lesson_completed' | 'course_progress' | 'course_completed';
  courseId?: string;
  lessonId?: string;
  userId: string;
  percent?: number;
  position?: number;
  status?: string;
  time_spent_s?: number;
  timestamp?: number;
}

const lessonProgress = new Map<string, LessonProgressRecord>();
const courseProgress = new Map<string, CourseProgressRecord>();
const processedEvents = new Set<string>();

const keyForLesson = (userId: string, lessonId: string) => `${userId}:${lessonId}`;
const keyForCourse = (userId: string, courseId: string) => `${userId}:${courseId}`;

export const saveProgressSnapshot = (snapshot: ProgressSnapshotInput): void => {
  const { userId, courseId, lessons, course } = snapshot;
  const updatedAt = new Date().toISOString();

  lessons.forEach((lesson) => {
    lessonProgress.set(keyForLesson(userId, lesson.lessonId), {
      userId,
      courseId,
      lessonId: lesson.lessonId,
      progressPercent: clampPercent(lesson.progressPercent),
      completed: lesson.completed,
      positionSeconds: Math.max(0, lesson.positionSeconds ?? 0),
      lastAccessedAt: lesson.lastAccessedAt ?? updatedAt,
      timeSpentSeconds: lesson.positionSeconds ?? 0,
    });
  });

  courseProgress.set(keyForCourse(userId, courseId), {
    userId,
    courseId,
    percent: clampPercent(course.percent),
    status: course.percent >= 100 ? 'completed' : 'in-progress',
    timeSpentSeconds: course.totalTimeSeconds ?? undefined,
    updatedAt,
    lastLessonId: course.lastLessonId ?? null,
    completedAt: course.completedAt ?? null,
  });
};

export const listLessonProgress = (userId: string, lessonIds: string[]): LessonProgressRow[] => {
  return lessonIds.map((lessonId) => {
    const stored = lessonProgress.get(keyForLesson(userId, lessonId));
    return {
      lesson_id: lessonId,
      progress_percentage: stored ? clampPercent(stored.progressPercent) : 0,
      completed: stored?.completed ?? false,
      time_spent: stored?.timeSpentSeconds ?? 0,
      last_accessed_at: stored?.lastAccessedAt ?? null,
    };
  });
};

export const getCourseProgress = (userId: string, courseId: string): CourseProgressRecord | undefined => {
  return courseProgress.get(keyForCourse(userId, courseId));
};

export const saveLessonEvent = (event: ProgressEventInput): void => {
  if (!event.lessonId || !event.courseId) {
    return;
  }
  const existing = lessonProgress.get(keyForLesson(event.userId, event.lessonId));
  const completed = event.type === 'lesson_completed' ? true : existing?.completed ?? false;
  const percent = clampPercent(event.percent ?? existing?.progressPercent ?? 0);
  lessonProgress.set(keyForLesson(event.userId, event.lessonId), {
    userId: event.userId,
    courseId: event.courseId,
    lessonId: event.lessonId,
    progressPercent: percent,
    completed,
    positionSeconds: Math.max(0, event.position ?? existing?.positionSeconds ?? 0),
    lastAccessedAt: new Date().toISOString(),
    timeSpentSeconds: event.time_spent_s ?? existing?.timeSpentSeconds ?? 0,
  });
};

export const saveCourseEvent = (event: ProgressEventInput): void => {
  if (!event.courseId) return;
  const key = keyForCourse(event.userId, event.courseId);
  const existing = courseProgress.get(key);
  courseProgress.set(key, {
    userId: event.userId,
    courseId: event.courseId,
    percent: clampPercent(event.percent ?? existing?.percent ?? 0),
    status: event.status || existing?.status || 'in-progress',
    timeSpentSeconds: event.time_spent_s ?? existing?.timeSpentSeconds,
    updatedAt: new Date().toISOString(),
    lastLessonId: event.lessonId ?? existing?.lastLessonId ?? null,
    completedAt:
      event.type === 'course_completed' || event.percent === 100
        ? new Date().toISOString()
        : existing?.completedAt ?? null,
  });
};

export const recordProgressEvents = (events: ProgressEventInput[]) => {
  const accepted: string[] = [];
  const duplicates: string[] = [];

  events.forEach((event) => {
    const id = event.clientEventId || randomUUID();
    if (processedEvents.has(id)) {
      duplicates.push(id);
      return;
    }
    processedEvents.add(id);
    accepted.push(id);
    if (event.type.startsWith('lesson')) {
      saveLessonEvent({ ...event, clientEventId: id });
    } else {
      saveCourseEvent({ ...event, clientEventId: id });
    }
  });

  return { accepted, duplicates };
};

const clampPercent = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};
