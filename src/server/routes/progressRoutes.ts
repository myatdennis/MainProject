import express from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  listLessonProgress,
  saveProgressSnapshot,
  recordProgressEvents,
  type ProgressSnapshotInput,
  type ProgressEventInput,
} from '../data/progressStore.js';

const router = express.Router();
const ORG_HEADER_CANDIDATES = ['x-org-id', 'x-organization-id', 'x_org_id', 'x_organization_id'];

const resolveOrgId = (req: AuthenticatedRequest): string | null => {
  for (const key of ORG_HEADER_CANDIDATES) {
    const value = req.headers[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return req.user?.organizationId ?? null;
};

router.get('/learner/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  const lessonIds = parseLessonIds(req.query.lessonIds ?? req.query.lesson_ids);
  const userId = coerceString(req.query.userId, req.query.user_id, req.user?.userId);
  const orgId = resolveOrgId(req);

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (lessonIds.length === 0) {
    return res.status(400).json({ error: 'lessonIds is required' });
  }
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide X-Org-Id header or include organizationId on the user token.',
    });
  }

  const lessons = await listLessonProgress(userId, lessonIds, orgId);
  res.json({ data: { lessons } });
});

router.post('/learner/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  const snapshot = normalizeSnapshotPayload(req.body, req.user?.userId);
  if (!snapshot) {
    return res.status(400).json({ error: 'Invalid progress snapshot payload' });
  }

  const orgId = resolveOrgId(req);
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide X-Org-Id header or include organizationId on the user token.',
    });
  }

  await saveProgressSnapshot(snapshot, orgId);
  res.status(202).json({ success: true });
});

router.post('/client/progress/lesson', requireAuth, async (req: AuthenticatedRequest, res) => {
  const event = normalizeEventPayload(req.body, req.user?.userId);
  if (!event || !event.lessonId) {
    return res.status(400).json({ error: 'Lesson progress payload is missing lessonId' });
  }

  const orgId = resolveOrgId(req);
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide X-Org-Id header or include organizationId on the user token.',
    });
  }

  // Force lesson specific event type defaults
  event.type = resolveEventType(event.type, event.percent, true);
  const result = await recordProgressEvents([event], orgId);
  res.status(202).json(result);
});

router.post('/client/progress/course', requireAuth, async (req: AuthenticatedRequest, res) => {
  const event = normalizeEventPayload(req.body, req.user?.userId);
  if (!event || !event.courseId) {
    return res.status(400).json({ error: 'Course progress payload is missing courseId' });
  }

  const orgId = resolveOrgId(req);
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide X-Org-Id header or include organizationId on the user token.',
    });
  }

  event.type = resolveEventType(event.type, event.percent, false);
  const result = await recordProgressEvents([event], orgId);
  res.status(202).json(result);
});

router.post('/client/progress/batch', requireAuth, async (req: AuthenticatedRequest, res) => {
  const rawEvents: any[] = Array.isArray(req.body?.events) ? req.body.events : [];
  const events = rawEvents
    .map((entry) => normalizeEventPayload(entry, req.user?.userId))
    .filter((evt): evt is ProgressEventInput => Boolean(evt));

  if (events.length === 0) {
    return res.status(400).json({ error: 'events array must contain at least one valid event' });
  }

  const orgId = resolveOrgId(req);
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide X-Org-Id header or include organizationId on the user token.',
    });
  }

  const result = await recordProgressEvents(events, orgId);
  res.status(202).json(result);
});

const parseLessonIds = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value)).filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const coerceString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const coerceNumber = (...values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeSnapshotPayload = (body: any, fallbackUserId?: string): ProgressSnapshotInput | null => {
  if (!body) return null;
  const userId = coerceString(body.userId, body.user_id, fallbackUserId);
  const courseId = coerceString(body.courseId, body.course_id, body.course?.courseId, body.course?.course_id);

  if (!userId || !courseId) {
    return null;
  }

  const rawLessons: any[] = Array.isArray(body.lessons)
    ? body.lessons
    : Array.isArray(body.lesson_progress)
    ? body.lesson_progress
    : [];

  const lessons = rawLessons.reduce<ProgressSnapshotInput['lessons']>((acc, lesson) => {
    const normalized = normalizeLesson(lesson);
    if (normalized) {
      acc.push(normalized);
    }
    return acc;
  }, []);

  const courseBlock = body.course ?? body.course_progress ?? {};

  return {
    userId,
    courseId,
    lessons,
    course: {
      percent:
        coerceNumber(
          courseBlock.percent,
          courseBlock.progress_percent,
          courseBlock.progressPercent,
          body.overallPercent,
          body.overall_percent,
        ) ?? 0,
      completedAt: coerceString(courseBlock.completedAt, courseBlock.completed_at, body.completedAt, body.completed_at),
      totalTimeSeconds: coerceNumber(courseBlock.totalTimeSeconds, courseBlock.total_time_seconds),
      lastLessonId: coerceString(courseBlock.lastLessonId, courseBlock.last_lesson_id),
    },
  };
};

const normalizeLesson = (input: any): ProgressSnapshotInput['lessons'][number] | null => {
  if (!input) return null;
  const lessonId = coerceString(input.lessonId, input.lesson_id);
  if (!lessonId) {
    return null;
  }

  const percent = coerceNumber(input.progressPercent, input.progress_percent, input.percent) ?? 0;

  return {
    lessonId,
    progressPercent: percent,
    completed: typeof input.completed === 'boolean' ? input.completed : percent >= 100,
    positionSeconds: coerceNumber(input.positionSeconds, input.position_seconds, input.resume_at_s) ?? 0,
    lastAccessedAt: coerceString(input.lastAccessedAt, input.last_accessed_at),
  };
};

const normalizeEventPayload = (input: any, fallbackUserId?: string): ProgressEventInput | null => {
  if (!input) return null;
  const userId = coerceString(input.userId, input.user_id, fallbackUserId);
  if (!userId) return null;

  const percent = coerceNumber(input.percent, input.progress_percent, input.progressPercent);

  const event: ProgressEventInput = {
    clientEventId: coerceString(input.clientEventId, input.client_event_id) ?? undefined,
    type: (input.type || input.event_type || '') as ProgressEventInput['type'],
    courseId: coerceString(input.courseId, input.course_id),
    lessonId: coerceString(input.lessonId, input.lesson_id),
    userId,
    percent: typeof percent === 'number' ? percent : undefined,
    position: coerceNumber(input.position, input.position_seconds, input.resume_at_s),
    status: coerceString(input.status, input.progress_status),
    time_spent_s: coerceNumber(input.time_spent_s, input.timeSpentSeconds),
    timestamp: coerceNumber(input.timestamp) ?? Date.now(),
    orgId: coerceString(input.orgId, input.org_id),
  };

  event.type = resolveEventType(event.type, percent, Boolean(event.lessonId));

  return event;
};

const resolveEventType = (
  provided: ProgressEventInput['type'] | undefined,
  percent: number | undefined,
  isLessonEvent: boolean,
): ProgressEventInput['type'] => {
  if (provided) return provided;
  const completed = typeof percent === 'number' && percent >= 100;
  if (isLessonEvent) {
    return completed ? 'lesson_completed' : 'lesson_progress';
  }
  return completed ? 'course_completed' : 'course_progress';
};

export default router;
