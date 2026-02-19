import { randomUUID } from 'crypto';
import { supabaseServiceClient } from '../supabase/supabaseServerClient.js';

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
  orgId?: string | null;
}

const supabase = supabaseServiceClient;
const supabaseEnabled = Boolean(supabase);

const lessonProgress = new Map<string, LessonProgressRecord>();
const courseProgress = new Map<string, CourseProgressRecord>();
const processedEvents = new Set<string>();

const nowIso = () => new Date().toISOString();

const buildSnapshotEvents = (snapshot: ProgressSnapshotInput): ProgressEventInput[] => {
  const timestamp = Date.now();
  const lessonEvents: ProgressEventInput[] = snapshot.lessons.map((lesson) => ({
    clientEventId: `${snapshot.userId}:${lesson.lessonId}:${timestamp}`,
    type: lesson.completed ? 'lesson_completed' : 'lesson_progress',
    courseId: snapshot.courseId,
    lessonId: lesson.lessonId,
    userId: snapshot.userId,
    percent: lesson.progressPercent,
    position: lesson.positionSeconds,
    status: lesson.completed ? 'completed' : 'in-progress',
    time_spent_s: lesson.positionSeconds,
    timestamp,
  }));

  const courseEvent: ProgressEventInput = {
    clientEventId: `${snapshot.userId}:${snapshot.courseId}:${timestamp}`,
    type: snapshot.course.percent >= 100 ? 'course_completed' : 'course_progress',
    courseId: snapshot.courseId,
    userId: snapshot.userId,
    percent: snapshot.course.percent,
    status: snapshot.course.percent >= 100 ? 'completed' : 'in-progress',
    time_spent_s: snapshot.course.totalTimeSeconds ?? undefined,
    timestamp,
  };

  return [...lessonEvents, courseEvent];
};

const keyForLesson = (userId: string, lessonId: string) => `${userId}:${lessonId}`;
const keyForCourse = (userId: string, courseId: string) => `${userId}:${courseId}`;

export const saveProgressSnapshot = async (snapshot: ProgressSnapshotInput, orgId: string): Promise<void> => {
  if (supabaseEnabled) {
    const events = buildSnapshotEvents(snapshot).map((event) => ({ ...event, orgId }));
    await recordProgressEvents(events, orgId);
    return;
  }
  saveProgressSnapshotInMemory(snapshot);
};

const saveProgressSnapshotInMemory = (snapshot: ProgressSnapshotInput): void => {
  const { userId, courseId, lessons, course } = snapshot;
  const updatedAt = nowIso();

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

export const listLessonProgress = async (
  userId: string,
  lessonIds: string[],
  orgId?: string | null,
): Promise<LessonProgressRow[]> => {
  if (supabaseEnabled && lessonIds.length > 0) {
    const { data, error } = await supabase!
      .from('user_lesson_progress')
      .select('lesson_id, progress, completed, time_spent_seconds, updated_at, org_id')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds);
    if (error) {
      console.warn('[progressStore] listLessonProgress query failed', error);
    } else if (data) {
      const rowsByLesson = new Map<string, LessonProgressRow>();
      data
        .filter((row) => !orgId || !row.org_id || row.org_id === orgId)
        .forEach((row) => {
          rowsByLesson.set(row.lesson_id, {
            lesson_id: row.lesson_id,
            progress_percentage: clampPercent(Number(row.progress) ?? 0),
            completed: Boolean(row.completed),
            time_spent: Number(row.time_spent_seconds ?? 0),
            last_accessed_at: row.updated_at ?? null,
          });
        });
      return lessonIds.map((lessonId) => {
        return (
          rowsByLesson.get(lessonId) ?? {
            lesson_id: lessonId,
            progress_percentage: 0,
            completed: false,
            time_spent: 0,
            last_accessed_at: null,
          }
        );
      });
    }
  }
  return listLessonProgressInMemory(userId, lessonIds);
};

const listLessonProgressInMemory = (userId: string, lessonIds: string[]): LessonProgressRow[] => {
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

const saveLessonEvent = (event: ProgressEventInput): void => {
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

export const recordProgressEvents = async (
  events: ProgressEventInput[],
  orgContext?: string | null,
): Promise<{ accepted: string[]; duplicates: string[] }> => {
  if (supabaseEnabled) {
    return persistEventsToSupabase(events, orgContext);
  }
  return recordEventsInMemory(events);
};

const recordEventsInMemory = (events: ProgressEventInput[]) => {
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

const persistEventsToSupabase = async (
  events: ProgressEventInput[],
  orgContext?: string | null,
): Promise<{ accepted: string[]; duplicates: string[] }> => {
  if (!orgContext && !events.every((event) => event.orgId)) {
    throw new Error('Organization context is required for progress ingestion.');
  }
  const payload = events.map((event) => ({
    client_event_id: event.clientEventId ?? randomUUID(),
    user_id: event.userId,
    course_id: event.courseId ?? null,
    lesson_id: event.lessonId ?? null,
    org_id: event.orgId ?? orgContext ?? null,
    percent: clampPercent(event.percent ?? 0),
    time_spent_seconds: event.time_spent_s ?? null,
    resume_at_seconds: event.position ?? null,
    status: event.status ?? null,
    event_type: event.type,
    occurred_at: event.timestamp ? new Date(event.timestamp).toISOString() : nowIso(),
  }));

  let rpcData: { accepted: string[]; duplicates: string[] }[] | null = null;
  try {
    const { data, error } = await supabase!.rpc('upsert_progress_batch', { events_json: payload });
    if (error) {
      throw error;
    }
    rpcData = data;
  } catch (err) {
    console.error('[progressStore] upsert_progress_batch failed', err);
    throw new Error('Failed to persist learner progress');
  }

  return {
    accepted: rpcData?.[0]?.accepted ?? [],
    duplicates: rpcData?.[0]?.duplicates ?? [],
  };
};

const clampPercent = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};
