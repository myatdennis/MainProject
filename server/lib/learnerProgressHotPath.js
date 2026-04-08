export const createSnapshotSeedAttemptCache = ({ ttlMs = 15 * 60 * 1000 } = {}) => {
  const attempts = new Map();

  const shouldAttempt = (key, now = Date.now()) => {
    if (!key) return false;
    const last = attempts.get(key);
    if (typeof last !== 'number') {
      return true;
    }
    if (now - last > ttlMs) {
      attempts.delete(key);
      return true;
    }
    return false;
  };

  const markAttempt = (key, now = Date.now()) => {
    if (!key) return;
    attempts.set(key, now);
  };

  const clear = () => {
    attempts.clear();
  };

  return {
    shouldAttempt,
    markAttempt,
    clear,
  };
};

export const buildSnapshotSeedKey = ({ userId, orgId, courseId }) =>
  `${String(userId || '').toLowerCase()}::${String(orgId || 'no-org').toLowerCase()}::${String(courseId || '').toLowerCase()}`;

export const normalizeSnapshotLessonIds = (body = {}, parseLessonIdsParam, coerceString) => {
  const direct = parseLessonIdsParam(body.lessonIds ?? body.lesson_ids);
  if (direct.length > 0) {
    return Array.from(new Set(direct));
  }
  if (Array.isArray(body.lessons)) {
    const fromLessons = body.lessons
      .map((entry) => coerceString(entry?.lessonId, entry?.lesson_id, entry?.id))
      .filter(Boolean);
    return Array.from(new Set(fromLessons));
  }
  return [];
};
