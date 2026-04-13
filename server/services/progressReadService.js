export const createProgressReadService = ({
  logger,
  supabase,
  e2eStore,
  isDemoMode,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  resolveOrgIdFromRequest,
  parseLessonIdsParam,
  coerceString,
  buildLessonRow,
  isMissingRelationError,
  isMissingColumnError,
  getLessonProgressOrgColumn,
  writeErrorDiagnostics,
  pickOrgId,
  isUuid,
}) => {
  const getLearnerProgress = async ({ req, res }) => {
    const requestId = req.requestId ?? null;
    const lessonIds = parseLessonIdsParam(req.query.lessonIds || req.query.lesson_ids);
    const requestedUserId = coerceString(req.query.userId, req.query.user_id, req.query.learnerId, req.query.learner_id);
    const sessionUserId = coerceString(req.user?.userId, req.user?.id);
    const isAdminUser = (req.user?.role || '').toLowerCase() === 'admin';
    const effectiveUserId = requestedUserId || sessionUserId;
    const context = requireUserContext(req, res);
    if (!context) return null;
    const resolvedOrgId = resolveOrgIdFromRequest(req, context);

    if (!effectiveUserId) {
      return {
        status: 400,
        payload: { ok: false, code: 'user_id_required', message: 'userId is required', hint: null, requestId, queryName: 'learner_progress_fetch', details: null },
      };
    }
    if (lessonIds.length === 0) {
      return {
        status: 400,
        payload: { ok: false, code: 'lesson_ids_required', message: 'lessonIds is required', hint: null, requestId, queryName: 'learner_progress_fetch', details: null },
      };
    }

    const normalizedSessionUserId = sessionUserId ? sessionUserId.toLowerCase() : null;
    const normalizedUserId = effectiveUserId.toLowerCase();
    if (!isAdminUser && normalizedSessionUserId && normalizedUserId !== normalizedSessionUserId) {
      return {
        status: 403,
        payload: { ok: false, code: 'forbidden', message: 'You can only view your own progress.', hint: null, requestId, queryName: 'learner_progress_fetch', details: null },
      };
    }

    if (isDemoOrTestMode) {
      const lessons = lessonIds.map((lessonId) => buildLessonRow(lessonId, e2eStore.lessonProgress.get(`${normalizedUserId}:${lessonId}`) || null));
      return { status: 200, payload: { ok: true, requestId, data: { lessons }, meta: { mode: 'demo' } } };
    }

    if (!ensureSupabase(res)) return null;

    try {
      let progressQuery = supabase.from('user_lesson_progress').select('*').eq('user_id', normalizedUserId).in('lesson_id', lessonIds);
      const orgColumn = getLessonProgressOrgColumn();
      if (resolvedOrgId && orgColumn) progressQuery = progressQuery.eq(orgColumn, resolvedOrgId);
      const { data, error } = await progressQuery;
      if (error) throw error;
      const byLessonId = new Map();
      (data || []).forEach((row) => {
        const lessonId = row.lesson_id || row.lessonId;
        if (!lessonId) return;
        byLessonId.set(String(lessonId), buildLessonRow(String(lessonId), row));
      });
      const lessons = lessonIds.map((lessonId) => byLessonId.get(lessonId) || buildLessonRow(lessonId, null));
      return { status: 200, payload: { ok: true, requestId, data: { lessons } } };
    } catch (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        const missingColumn = isMissingColumnError(error) && typeof error?.message === 'string'
          ? (error.message.match(/column ([a-zA-Z0-9_."-]+)/)?.[1] ?? null)
          : null;
        logger.warn('learner_progress_storage_missing', {
          code: error.code ?? null,
          message: error.message ?? null,
          missingColumn,
          requestId,
        });
        return {
          status: 200,
          payload: {
            ok: true,
            requestId,
            data: { lessons: lessonIds.map((lessonId) => buildLessonRow(lessonId, null)) },
            meta: { degraded: true, reason: isMissingColumnError(error) ? 'schema_missing_column' : 'empty_progress', missingColumn },
          },
        };
      }
      writeErrorDiagnostics(req, error, { meta: { surface: 'learner_progress_commit' } });
      throw error;
    }
  };

  const getClientProgressSummary = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const userId = context.userId;

    if (!isUuid(userId) && isDemoMode) {
      return {
        status: 200,
        payload: {
          data: {
            modulesCompleted: 0,
            modulesTotal: 0,
            overallPercent: 0,
            timeInvestedSeconds: 0,
            certificatesEarned: 0,
            streakDays: 0,
          },
        },
      };
    }

    if (isDemoOrTestMode) {
      let totalPercent = 0;
      let courseCount = 0;
      let completedCourses = 0;
      let totalTimeSeconds = 0;
      for (const [key, record] of e2eStore.courseProgress.entries()) {
        if (!key.startsWith(`${userId}:`)) continue;
        courseCount += 1;
        totalPercent += typeof record.percent === 'number' ? record.percent : 0;
        totalTimeSeconds += typeof record.time_spent_s === 'number' ? record.time_spent_s : 0;
        if ((record.percent ?? 0) >= 100 || record.status === 'completed') completedCourses += 1;
      }
      const overallPercent = courseCount > 0 ? Math.round(totalPercent / courseCount) : 0;
      return {
        status: 200,
        payload: {
          data: {
            modulesCompleted: completedCourses,
            modulesTotal: courseCount,
            overallPercent,
            timeInvestedSeconds: totalTimeSeconds,
            certificatesEarned: completedCourses,
            streakDays: 0,
          },
        },
      };
    }

    if (!supabase) return { status: 503, payload: { error: 'database_unavailable' } };
    const { data: rows, error } = await supabase.from('user_course_progress').select('course_id, progress, status, time_spent_s, updated_at').eq('user_id', userId);
    if (error) throw error;
    const progressRows = rows || [];
    const courseCount = progressRows.length;
    const completedCourses = progressRows.filter((r) => (r.progress ?? 0) >= 100 || r.status === 'completed').length;
    const totalPercent = progressRows.reduce((sum, r) => sum + (r.progress ?? 0), 0);
    const overallPercent = courseCount > 0 ? Math.round(totalPercent / courseCount) : 0;
    const totalTimeSeconds = progressRows.reduce((sum, r) => sum + (r.time_spent_s ?? 0), 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentDays = new Set(progressRows.filter((r) => r.updated_at && r.updated_at >= thirtyDaysAgo).map((r) => r.updated_at.slice(0, 10)));

    return {
      status: 200,
      payload: {
        data: {
          modulesCompleted: completedCourses,
          modulesTotal: courseCount,
          overallPercent,
          timeInvestedSeconds: totalTimeSeconds,
          certificatesEarned: completedCourses,
          streakDays: recentDays.size,
        },
      },
    };
  };

  return { getLearnerProgress, getClientProgressSummary };
};

export default createProgressReadService;
