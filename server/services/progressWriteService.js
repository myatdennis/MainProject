export const createProgressWriteService = ({
  logger,
  supabase,
  sql,
  e2eStore,
  isDemoMode,
  isDemoOrTestMode,
  isTestMode,
  ensureSupabase,
  requireUserContext,
  resolveOrgScopeFromRequest,
  normalizeSnapshotPayload,
  getPayloadSize,
  writeErrorDiagnostics,
  clampPercent,
  persistE2EStore,
  broadcastToTopic,
  buildProgressSnapshotSeedKey,
  shouldAttemptProgressSnapshotSeed,
  markProgressSnapshotSeedAttempt,
  attachLessonOrgScope,
  buildLessonProgressConflictTargets,
  getLessonProgressOrgColumn,
  upsertWithConflictFallback,
  normalizeColumnIdentifier,
  extractMissingColumnName,
  handleLessonOrgColumnMissing,
  schemaSupportFlags,
  getCachedUserCourseProgressUuidSupport,
  buildCourseProgressConflictTargets,
  firstRow,
  isMissingColumnError,
  isUserCourseProgressUuidColumnMissing,
  isConflictConstraintMissing,
  createCertificateIfNotExists,
  recordCourseProgress,
  recordLessonProgress,
  recordProgressBatch,
  checkProgressLimit,
  randomUUID,
  processGamificationEvent,
  upsertOrgEngagementMetrics,
  isUuid,
  normalizeOrgIdValue,
}) => {
  const normalizeUnknownError = (error) => {
    if (!error) return null;
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      };
    }
    if (typeof error === 'object') {
      return {
        message: error?.message ?? JSON.stringify(error),
        stack: null,
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      };
    }
    return { message: String(error), stack: null, code: null, details: null, hint: null };
  };

  const saveLearnerSnapshot = async ({ req, res }) => {
    let snapshot = normalizeSnapshotPayload(req.body || {});
    if (!snapshot) {
      return {
        status: 400,
        payload: {
          ok: false,
          code: 'invalid_progress_payload',
          message: 'Invalid progress snapshot payload',
          hint: null,
          requestId: req.requestId ?? null,
          queryName: 'learner_progress_snapshot',
          details: null,
        },
      };
    }

    const authUserId = req.user?.userId || req.user?.id || null;
    const effectiveUserId = !isDemoMode ? authUserId : authUserId || snapshot.userId || null;
    if (!effectiveUserId) {
      return {
        status: 401,
        payload: {
          ok: false,
          code: 'unauthenticated_progress',
          message: 'Missing authenticated user id for progress update',
          hint: null,
          requestId: req.requestId ?? null,
          queryName: 'learner_progress_snapshot',
          details: null,
        },
      };
    }

    snapshot = { ...snapshot, userId: effectiveUserId };
    const { userId, courseId } = snapshot;
    let lessonList = Array.isArray(snapshot.lessons) ? snapshot.lessons : [];
    const courseProgress = snapshot.course || {};
    const nowIso = new Date().toISOString();
    const requestId = req.requestId ?? req.id ?? null;
    const payloadBytes = getPayloadSize(req);
    const baseLogMeta = { requestId, userId, courseId, lessonCount: lessonList.length, payloadBytes };
    const requestStartedAt = Date.now();
    const stepTimings = { authMs: 0, orgResolutionMs: 0, snapshotInitMs: 0, schemaDetectionMs: 0, dbWriteMs: 0, totalMs: 0 };
    let failingFunction = 'learner_progress_snapshot.init';
    let currentOperation = { operationName: 'init', table: null, conflictTargets: null, payloadSummary: null };
    const setCurrentOperation = ({ operationName, table = null, conflictTargets = null, payloadSummary = null } = {}) => {
      currentOperation = { operationName: operationName || currentOperation.operationName, table, conflictTargets, payloadSummary };
    };
    const logProgressTiming = (event, extra = {}) => {
      stepTimings.totalMs = Date.now() - requestStartedAt;
      logger.info('learner_progress_snapshot_timing', { event, ...baseLogMeta, ...stepTimings, ...extra });
    };
    const respondWithError = (status, code, message, error, queryName = 'learner_progress_snapshot') => {
      const normalizedError = normalizeUnknownError(error);
      if (normalizedError) {
        logger.error('learner_progress_snapshot_failed', {
          ...baseLogMeta,
          route: '/api/learner/progress',
          failingFunction,
          operationName: currentOperation.operationName,
          table: currentOperation.table,
          conflictTargets: currentOperation.conflictTargets,
          payloadSummary: currentOperation.payloadSummary,
          dbErrorCode: normalizedError.code,
          dbErrorMessage: normalizedError.message,
          dbErrorDetails: normalizedError.details,
          dbErrorHint: normalizedError.hint,
          errorMessage: normalizedError.message,
          stack: normalizedError.stack ?? undefined,
        });
        writeErrorDiagnostics(req, error instanceof Error ? error : new Error(normalizedError.message), {
          meta: {
            surface: 'learner_progress_snapshot',
            route: '/api/learner/progress',
            requestId,
            userId,
            orgId: baseLogMeta.orgId ?? null,
            failingFunction,
            dbErrorCode: normalizedError.code,
            dbErrorMessage: normalizedError.message,
          },
        });
      }
      logProgressTiming('error', {
        status,
        code,
        failingFunction,
        operationName: currentOperation.operationName,
        table: currentOperation.table,
        dbErrorCode: normalizedError?.code ?? null,
      });
      return {
        status,
        payload: {
          ok: false,
          code,
          message,
          hint: normalizedError?.hint ?? null,
          requestId,
          queryName,
          details: normalizedError?.details ?? null,
        },
      };
    };

    stepTimings.authMs = Date.now() - requestStartedAt;
    const orgResolutionStartedAt = Date.now();
    const context = requireUserContext(req, res);
    if (!context) return null;
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    stepTimings.orgResolutionMs = Date.now() - orgResolutionStartedAt;
    if (orgScope.requiresExplicitSelection) {
      return respondWithError(403, 'org_selection_required', 'Select an organization before saving progress.', null);
    }
    const resolvedOrgId = orgScope.orgId;
    baseLogMeta.orgId = resolvedOrgId;

    logger.debug('learner_progress_snapshot_received', baseLogMeta);
    if (isTestMode) {
      console.log('Progress sync request:', { userId, courseId, lessonCount: lessonList.length, overallPercent: courseProgress.percent });
    }

    if (isDemoOrTestMode) {
      const demoWriteStartedAt = Date.now();
      try {
        lessonList.forEach((lesson) => {
          const key = `${userId}:${lesson.lessonId}`;
          const record = {
            user_id: userId,
            lesson_id: lesson.lessonId,
            percent: clampPercent(lesson.progressPercent),
            status: lesson.completed ? 'completed' : 'in_progress',
            time_spent_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
            resume_at_s: Math.max(0, Math.round(lesson.positionSeconds ?? 0)),
            updated_at: lesson.lastAccessedAt || nowIso,
            organization_id: resolvedOrgId ?? null,
          };
          e2eStore.lessonProgress.set(key, record);
          try {
            const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
            broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
            broadcastToTopic(`progress:lesson:${lesson.lessonId}`, payload);
            broadcastToTopic('progress:all', payload);
          } catch {}
        });
        const courseRecord = {
          user_id: userId,
          course_id: courseId,
          percent: clampPercent(courseProgress.percent),
          status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
          time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
          updated_at: nowIso,
          last_lesson_id: courseProgress.lastLessonId ?? null,
          completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
          organization_id: resolvedOrgId ?? null,
        };
        e2eStore.courseProgress.set(`${userId}:${courseId}`, courseRecord);
        persistE2EStore();
        try {
          const payload = { type: 'course_progress', data: courseRecord, timestamp: Date.now() };
          broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
          broadcastToTopic(`progress:course:${courseId}`, payload);
          broadcastToTopic('progress:all', payload);
        } catch {}
        stepTimings.dbWriteMs = Date.now() - demoWriteStartedAt;
        logProgressTiming('success', { mode: 'demo', supportsCourseProgressUserIdUuid: false });
        return {
          status: 202,
          payload: { ok: true, requestId, data: { userId, courseId, updatedLessons: lessonList.length }, meta: { mode: 'demo' } },
        };
      } catch (error) {
        return respondWithError(500, 'progress_demo_failed', 'Unable to sync progress in demo mode', error);
      }
    }

    if (!ensureSupabase(res)) return null;

    const snapshotInitStartedAt = Date.now();
    if (lessonList.length === 0 && courseId) {
      const payloadLessonIds = Array.isArray(snapshot.lessonIds) ? snapshot.lessonIds : [];
      if (payloadLessonIds.length > 0) {
        lessonList = payloadLessonIds.map((lessonId) => ({ lessonId, progressPercent: 0, completed: false, positionSeconds: 0, lastAccessedAt: null }));
        baseLogMeta.lessonCount = lessonList.length;
      }
    }
    if (lessonList.length === 0 && courseId) {
      const snapshotSeedKey = buildProgressSnapshotSeedKey({ userId, orgId: resolvedOrgId, courseId });
      if (shouldAttemptProgressSnapshotSeed(snapshotSeedKey)) {
        const extractLessonIds = (modules = []) => {
          const ids = [];
          for (const moduleRecord of Array.isArray(modules) ? modules : []) {
            for (const lesson of Array.isArray(moduleRecord?.lessons) ? moduleRecord.lessons : []) {
              const lessonId = lesson?.id ? String(lesson.id) : null;
              if (lessonId) ids.push(lessonId);
            }
          }
          return Array.from(new Set(ids));
        };
        let seededLessonIds = [];
        try {
          failingFunction = 'learner_progress_snapshot.seedLessons.fromModules';
          const moduleQuery = await supabase
            .from('modules')
            .select('id,lessons:lessons(id,order_index)')
            .eq('course_id', courseId)
            .order('order_index', { ascending: true })
            .order('order_index', { ascending: true, foreignTable: 'lessons' });
          if (!moduleQuery.error) seededLessonIds = extractLessonIds(moduleQuery.data || []);
        } catch {}
        if (seededLessonIds.length === 0) {
          try {
            failingFunction = 'learner_progress_snapshot.seedLessons.fromCourses';
            const courseQuery = await supabase
              .from('courses')
              .select('id,modules:modules(id,lessons:lessons(id,order_index))')
              .eq('id', courseId)
              .maybeSingle();
            if (!courseQuery.error && courseQuery.data) seededLessonIds = extractLessonIds(courseQuery.data.modules || []);
          } catch {}
        }
        markProgressSnapshotSeedAttempt(snapshotSeedKey);
        if (seededLessonIds.length > 0) {
          lessonList = seededLessonIds.map((lessonId) => ({ lessonId, progressPercent: 0, completed: false, positionSeconds: 0, lastAccessedAt: null }));
          baseLogMeta.lessonCount = lessonList.length;
        }
      }
    }
    stepTimings.snapshotInitMs = Date.now() - snapshotInitStartedAt;

    try {
      const normalizeLessonRecord = (row) => ({
        user_id: row.user_id,
        course_id: row.course_id ?? courseId,
        lesson_id: row.lesson_id,
        percent: clampPercent(Number(row.progress ?? row.percent ?? 0)),
        status: row.completed ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(row.time_spent_seconds ?? row.time_spent_s ?? 0)),
        last_accessed_at: row.updated_at ?? row.created_at ?? nowIso,
        organization_id: row.organization_id ?? row.org_id ?? resolvedOrgId ?? null,
      });
      const courseRecordForBroadcast = () => ({
        user_id: userId,
        user_id_uuid: userId,
        course_id: courseId,
        percent: clampPercent(courseProgress.percent),
        status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
        last_lesson_id: courseProgress.lastLessonId ?? null,
        completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
        updated_at: nowIso,
        organization_id: resolvedOrgId ?? null,
      });
      const buildLessonPayload = (lesson, { legacy = false } = {}) => {
        const base = { user_id: userId, course_id: courseId, lesson_id: lesson.lessonId };
        if (resolvedOrgId) attachLessonOrgScope(base, resolvedOrgId);
        if (legacy) {
          base.percent = clampPercent(lesson.progressPercent);
          base.status = Boolean(lesson.completed ?? lesson.progressPercent >= 100) ? 'completed' : 'in_progress';
          base.time_spent_s = Math.max(0, Math.round(lesson.positionSeconds ?? 0));
          base.updated_at = nowIso;
        } else {
          base.progress = clampPercent(lesson.progressPercent);
          base.completed = Boolean(lesson.completed ?? lesson.progressPercent >= 100);
          base.time_spent_seconds = Math.max(0, Math.round(lesson.positionSeconds ?? 0));
        }
        return base;
      };
      const upsertLesson = async (legacy = false) => {
        failingFunction = legacy ? 'learner_progress_snapshot.upsertLessonProgressLegacy' : 'learner_progress_snapshot.upsertLessonProgressModern';
        const payload = lessonList.map((lesson) => buildLessonPayload(lesson, { legacy }));
        const conflictTargets = buildLessonProgressConflictTargets({
          includeCourseId: Boolean(courseId),
          orgColumn: getLessonProgressOrgColumn(),
          includeOrgScope: Boolean(resolvedOrgId),
        });
        setCurrentOperation({
          operationName: legacy ? 'upsert_lesson_progress_legacy' : 'upsert_lesson_progress_modern',
          table: 'user_lesson_progress',
          conflictTargets,
          payloadSummary: { rowCount: payload.length, includesCourseId: Boolean(courseId), includesOrgScope: Boolean(resolvedOrgId), schemaMode: legacy ? 'legacy' : 'modern' },
        });
        const { data } = await upsertWithConflictFallback({
          supabase,
          table: 'user_lesson_progress',
          payload,
          conflictTargets,
          logger,
          context: { requestId, userId, orgId: resolvedOrgId ?? null, failingFunction },
        });
        return (data || []).map((row) => normalizeLessonRecord(row));
      };
      let lessonRows = [];
      if (lessonList.length > 0) {
        if (schemaSupportFlags.lessonProgress === 'legacy') {
          lessonRows = await upsertLesson(true);
        } else {
          try {
            lessonRows = await upsertLesson(false);
            schemaSupportFlags.lessonProgress = 'modern';
          } catch (error) {
            if (isMissingColumnError(error)) {
              const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error));
              if (handleLessonOrgColumnMissing(missingColumn)) {
                lessonRows = await upsertLesson(false);
              } else {
                schemaSupportFlags.lessonProgress = 'legacy';
                lessonRows = await upsertLesson(true);
              }
            } else {
              throw error;
            }
          }
        }
      }

      const schemaDetectionStartedAt = Date.now();
      failingFunction = 'learner_progress_snapshot.resolveCachedCourseUuidSupport';
      setCurrentOperation({ operationName: 'resolve_cached_course_uuid_support', payloadSummary: { lessonCount: lessonList.length, hasCourseProgress: Boolean(courseId) } });
      const supportsCourseProgressUserIdUuid = getCachedUserCourseProgressUuidSupport();
      stepTimings.schemaDetectionMs = Date.now() - schemaDetectionStartedAt;
      const dbWriteStartedAt = Date.now();

      const upsertCourse = async (legacy = false) => {
        const payload = legacy
          ? {
              user_id: userId,
              course_id: courseId,
              status: (courseProgress.percent ?? 0) >= 100 ? 'completed' : 'in_progress',
              organization_id: resolvedOrgId ?? null,
              ...(schemaSupportFlags.courseProgressPercentColumn !== 'missing' ? { percent: clampPercent(courseProgress.percent) } : {}),
              ...(schemaSupportFlags.courseProgressTimeColumn !== 'missing' ? { time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)) } : {}),
            }
          : {
              user_id: userId,
              course_id: courseId,
              progress: clampPercent(courseProgress.percent),
              completed: (courseProgress.percent ?? 0) >= 100,
              organization_id: resolvedOrgId ?? null,
            };
        if (supportsCourseProgressUserIdUuid) payload.user_id_uuid = userId;
        const conflictTargets = buildCourseProgressConflictTargets({
          includeUserIdUuid: supportsCourseProgressUserIdUuid,
          includeOrgScope: Boolean(resolvedOrgId),
          orgColumn: 'organization_id',
        });
        setCurrentOperation({
          operationName: legacy ? 'upsert_course_progress_legacy' : 'upsert_course_progress_modern',
          table: 'user_course_progress',
          conflictTargets,
          payloadSummary: { includesUserIdUuid: Boolean(payload.user_id_uuid), includesOrgScope: Boolean(resolvedOrgId), schemaMode: legacy ? 'legacy' : 'modern' },
        });
        try {
          const { data } = await upsertWithConflictFallback({
            supabase,
            table: 'user_course_progress',
            payload,
            conflictTargets,
            logger,
            context: { requestId, userId, orgId: resolvedOrgId ?? null, failingFunction },
          });
          return firstRow({ data });
        } catch (error) {
          if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.user_id_uuid;
            const fallbackConflictTargets = buildCourseProgressConflictTargets({ includeUserIdUuid: false, includeOrgScope: Boolean(resolvedOrgId), orgColumn: 'organization_id' });
            const { data } = await upsertWithConflictFallback({
              supabase,
              table: 'user_course_progress',
              payload: fallbackPayload,
              conflictTargets: fallbackConflictTargets,
              logger,
              context: { requestId, userId, orgId: resolvedOrgId ?? null, failingFunction },
            });
            return firstRow({ data });
          }
          throw error;
        }
      };

      let courseRow;
      if (schemaSupportFlags.courseProgress === 'legacy') {
        courseRow = await upsertCourse(true);
      } else {
        try {
          courseRow = await upsertCourse(false);
          schemaSupportFlags.courseProgress = 'modern';
        } catch (error) {
          if (isMissingColumnError(error)) {
            schemaSupportFlags.courseProgress = 'legacy';
            courseRow = await upsertCourse(true);
          } else {
            throw error;
          }
        }
      }

      const courseRecord = courseRow
        ? {
            user_id: courseRow.user_id,
            course_id: courseRow.course_id,
            percent: clampPercent(Number(courseRow.progress ?? courseRow.percent ?? courseProgress.percent ?? 0)),
            status: courseRow.completed ? 'completed' : 'in_progress',
            time_spent_s: Math.max(0, Math.round(courseProgress.totalTimeSeconds ?? 0)),
            last_lesson_id: courseProgress.lastLessonId ?? null,
            completed_at: courseProgress.completedAt ?? courseProgress.completed_at ?? null,
            updated_at: courseRow.updated_at ?? nowIso,
            organization_id: courseRow.organization_id ?? resolvedOrgId ?? null,
          }
        : courseRecordForBroadcast();

      try {
        const userTopic = `progress:user:${String(userId).toLowerCase()}`;
        lessonRows.forEach((record) => {
          const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
          broadcastToTopic(userTopic, payload);
          if (record.lesson_id) broadcastToTopic(`progress:lesson:${record.lesson_id}`, payload);
          broadcastToTopic('progress:all', payload);
        });
        if (courseRecord) {
          const payload = { type: 'course_progress', data: courseRecord, timestamp: Date.now() };
          broadcastToTopic(userTopic, payload);
          if (courseRecord.course_id) broadcastToTopic(`progress:course:${courseRecord.course_id}`, payload);
          broadcastToTopic('progress:all', payload);
        }
      } catch {}

      const isCourseCompleted = (courseProgress?.percent ?? 0) >= 100 || Boolean(courseProgress?.completed) || courseProgress?.status === 'completed';
      const wasAlreadyCompleted = courseRow?.completed === true || (courseRow?.progress ?? courseRow?.percent ?? 0) >= 100;
      if (isCourseCompleted && !wasAlreadyCompleted && supabase) {
        const certOrgId = resolvedOrgId ?? courseRow?.organization_id ?? null;
        createCertificateIfNotExists(userId, courseId, certOrgId).catch((err) => {
          logger.warn('certificate_auto_create_unhandled', { userId, courseId, message: err?.message });
        });
      }
      stepTimings.dbWriteMs = Date.now() - dbWriteStartedAt;
      logProgressTiming('success', { mode: 'supabase', supportsCourseProgressUserIdUuid, courseProgressSchema: schemaSupportFlags.courseProgress, lessonProgressSchema: schemaSupportFlags.lessonProgress });
      return {
        status: 202,
        payload: { ok: true, requestId, data: { userId, courseId, updatedLessons: lessonRows.length }, meta: { mode: 'supabase' } },
      };
    } catch (error) {
      const isUserForeignKeyMissing = error?.code === '23503' && /user_lesson_progress_user_id_fkey|user_course_progress_user_id_fkey/i.test(`${error?.message || ''} ${error?.details || ''}`);
      if (isUserForeignKeyMissing) return respondWithError(401, 'progress_user_not_provisioned', 'Authenticated user is not provisioned for progress writes.', error);
      if (isMissingColumnError(error)) {
        const missingColumn = normalizeColumnIdentifier(extractMissingColumnName(error)) || 'unknown_column';
        const completedLessons = lessonList.filter((lesson) => Boolean(lesson.completed ?? lesson.progressPercent >= 100)).length;
        const computedPercent = lessonList.length > 0 ? clampPercent((completedLessons / lessonList.length) * 100) : clampPercent(courseProgress.percent);
        logProgressTiming('degraded_success', { missingColumn, mode: 'supabase' });
        return {
          status: 202,
          payload: {
            ok: true,
            requestId,
            data: { userId, courseId, computedPercent, completedLessons, totalLessons: lessonList.length },
            meta: { degraded: true, reason: 'schema_missing_column', missingColumn },
          },
        };
      }
      return respondWithError(500, 'progress_sync_failed', error?.message || 'Unable to sync progress', error);
    }
  };

  const saveClientCourseProgress = async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const { user_id: bodyUserId, course_id, percent, status, time_spent_s } = req.body || {};
      const clientEventId = req.body?.client_event_id ?? null;
      const sessionUserId = req.user?.userId || req.user?.id || null;
      const resolvedUserId = sessionUserId || (typeof bodyUserId === 'string' ? bodyUserId : null);
      if (!resolvedUserId || !course_id) return { status: 400, payload: { error: 'user_id and course_id are required' } };
      const rlKey = `course:${String(resolvedUserId).toLowerCase()}`;
      if (!checkProgressLimit(rlKey)) return { status: 429, payload: { error: 'Too many progress updates, please slow down' } };
      const opStart = Date.now();
      try {
        if (clientEventId) {
          if (e2eStore.progressEvents.has(clientEventId)) {
            return { status: 200, payload: { data: e2eStore.courseProgress.get(`${resolvedUserId}:${course_id}`) || null, idempotent: true } };
          }
          e2eStore.progressEvents.add(clientEventId);
        }
        const key = `${resolvedUserId}:${course_id}`;
        const now = new Date().toISOString();
        const record = { user_id: resolvedUserId, course_id, percent: typeof percent === 'number' ? percent : 0, status: status || 'in_progress', time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0, updated_at: now };
        e2eStore.courseProgress.set(key, record);
        try {
          const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
          broadcastToTopic(`progress:user:${String(resolvedUserId).toLowerCase()}`, payload);
          broadcastToTopic(`progress:course:${course_id}`, payload);
          broadcastToTopic('progress:all', payload);
        } catch {}
        recordCourseProgress('demo-store', Date.now() - opStart, { status: 'success', userId: resolvedUserId, courseId: course_id, percent: record.percent });
        return { status: 200, payload: { data: record } };
      } catch (error) {
        recordCourseProgress('demo-store', Date.now() - opStart, { status: 'error', userId: resolvedUserId, courseId: course_id, message: error instanceof Error ? error.message : String(error) });
        return { status: 500, payload: { error: 'Unable to save course progress' } };
      }
    }

    if (!ensureSupabase(res)) return null;
    const { user_id: bodyUserId, course_id, percent, status, time_spent_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;
    const context = requireUserContext(req, res);
    if (!context) return null;
    const sessionUserIdRaw = typeof context.userId === 'string' ? context.userId.trim() : '';
    if (!isUuid(sessionUserIdRaw)) return { status: 400, payload: { error: 'invalid_user_context', message: 'Authenticated user id must be a uuid.' } };
    const canonicalUserId = sessionUserIdRaw;
    if (!course_id) return { status: 400, payload: { error: 'course_id is required' } };
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    if (orgScope.requiresExplicitSelection) {
      return { status: 403, payload: { ok: false, data: null, code: 'org_selection_required', message: 'Select an organization before saving course progress.', meta: { requestId: req.requestId ?? null } } };
    }
    const resolvedOrgId = orgScope.orgId;
    if (bodyUserId && bodyUserId !== canonicalUserId) {
      logger.warn('progress_course_user_mismatch', { providedUserId: bodyUserId, authenticatedUserId: canonicalUserId, requestId: req.requestId ?? null });
    }
    const rlKey = `course:${canonicalUserId.toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) return { status: 429, payload: { error: 'Too many progress updates, please slow down' } };
    const opStart = Date.now();
    try {
      const toApiCourseRecord = (row, fallbackTimeSpent) => {
        const resolvedUserId = row?.user_id_uuid || row?.user_id || canonicalUserId;
        return {
          user_id: resolvedUserId,
          user_id_uuid: row?.user_id_uuid ?? resolvedUserId,
          course_id: row?.course_id ?? course_id,
          percent: clampPercent(Number(row?.progress ?? row?.percent ?? percent ?? 0)),
          status: row?.completed ?? (typeof status === 'string' ? status === 'completed' : (percent ?? 0) >= 100) ? 'completed' : 'in_progress',
          time_spent_s: typeof row?.time_spent_s === 'number' ? row.time_spent_s : typeof row?.time_spent_seconds === 'number' ? row.time_spent_seconds : typeof fallbackTimeSpent === 'number' ? fallbackTimeSpent : 0,
          updated_at: row?.updated_at ?? row?.created_at ?? new Date().toISOString(),
        };
      };
      const normalizedPercent = clampPercent(typeof percent === 'number' ? percent : 0);
      const normalizedCompleted = typeof status === 'string' ? status === 'completed' : normalizedPercent >= 100;
      if (clientEventId) {
        try {
          await supabase.from('progress_events').insert({ id: clientEventId, user_id: canonicalUserId, course_id, lesson_id: null, payload: req.body });
        } catch {
          try {
            const existing = await supabase.from('user_course_progress').select('*').eq('course_id', course_id).or(`user_id_uuid.eq.${canonicalUserId},user_id.eq.${canonicalUserId}`).maybeSingle();
            if (existing && !existing.error && existing.data) return { status: 200, payload: { data: toApiCourseRecord(existing.data, time_spent_s), idempotent: true } };
          } catch {}
        }
      }
      const upsertPayload = { user_id_uuid: canonicalUserId, user_id: canonicalUserId, course_id, progress: normalizedPercent, completed: normalizedCompleted, organization_id: resolvedOrgId ?? null };
      const upsertCourseProgress = async (payload, conflictTarget) => supabase.from('user_course_progress').upsert(payload, { onConflict: conflictTarget }).select('*');
      let upsertResult;
      try {
        upsertResult = await upsertCourseProgress(upsertPayload, 'user_id_uuid,course_id');
        if (upsertResult.error) throw upsertResult.error;
      } catch (error) {
        if (isUserCourseProgressUuidColumnMissing(error) || isConflictConstraintMissing(error)) {
          const fallbackPayload = { ...upsertPayload };
          delete fallbackPayload.user_id_uuid;
          upsertResult = await upsertCourseProgress(fallbackPayload, 'user_id,course_id');
          if (upsertResult.error) throw upsertResult.error;
        } else {
          throw error;
        }
      }
      const data = firstRow(upsertResult);
      try {
        const apiRecord = toApiCourseRecord(data, time_spent_s);
        const userId = apiRecord?.user_id || canonicalUserId;
        const courseId = apiRecord?.course_id || course_id;
        const payload = { type: 'course_progress', data: apiRecord, timestamp: Date.now() };
        if (userId) broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
        if (courseId) broadcastToTopic(`progress:course:${courseId}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch {}
      recordCourseProgress('supabase', Date.now() - opStart, { status: 'success', userId: canonicalUserId, courseId: course_id, percent: normalizedPercent });
      if (normalizedCompleted && resolvedOrgId) {
        try {
          const deterministicEventId = clientEventId || `course_completed:${canonicalUserId}:${course_id}`;
          await sql.begin(async (tx) => {
            await processGamificationEvent(tx, {
              userId: String(canonicalUserId),
              orgId: String(resolvedOrgId),
              courseId: course_id,
              lessonId: null,
              eventType: 'course_completed',
              source: 'progress',
              eventId: String(deterministicEventId),
              payload: { percent: normalizedPercent, status: 'completed' },
              occurredAt: data?.updated_at ?? new Date().toISOString(),
            });
            await upsertOrgEngagementMetrics(tx, String(resolvedOrgId));
          });
        } catch (gErr) {
          logger.warn('gamification_progress_course_failed', { userId: canonicalUserId, courseId: course_id, message: gErr instanceof Error ? gErr.message : String(gErr) });
        }
      }
      return { status: 200, payload: { data: toApiCourseRecord(data, time_spent_s) } };
    } catch (error) {
      recordCourseProgress('supabase', Date.now() - opStart, { status: 'error', userId: canonicalUserId, courseId: course_id, message: error instanceof Error ? error.message : String(error) });
      return { status: 500, payload: { error: 'Unable to save course progress' } };
    }
  };

  const saveClientLessonProgress = async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
      const clientEventId = req.body?.client_event_id ?? null;
      if (!user_id || !lesson_id) return { status: 400, payload: { error: 'user_id and lesson_id are required' } };
      const rlKey = `lesson:${String(user_id).toLowerCase()}`;
      if (!checkProgressLimit(rlKey)) return { status: 429, payload: { error: 'Too many progress updates, please slow down' } };
      const opStart = Date.now();
      try {
        if (clientEventId) {
          if (e2eStore.progressEvents.has(clientEventId)) return { status: 200, payload: { data: e2eStore.lessonProgress.get(`${user_id}:${lesson_id}`) || null, idempotent: true } };
          e2eStore.progressEvents.add(clientEventId);
        }
        const key = `${user_id}:${lesson_id}`;
        const now = new Date().toISOString();
        const record = { user_id, lesson_id, percent: typeof percent === 'number' ? percent : 0, status: status || 'in_progress', time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0, resume_at_s: typeof resume_at_s === 'number' ? resume_at_s : null, updated_at: now };
        e2eStore.lessonProgress.set(key, record);
        try {
          const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
          broadcastToTopic(`progress:user:${String(user_id).toLowerCase()}`, payload);
          broadcastToTopic(`progress:lesson:${lesson_id}`, payload);
          broadcastToTopic('progress:all', payload);
        } catch {}
        recordLessonProgress('demo-store', Date.now() - opStart, { status: 'success', userId: user_id, lessonId: lesson_id, percent: record.percent });
        return { status: 200, payload: { data: record } };
      } catch (error) {
        recordLessonProgress('demo-store', Date.now() - opStart, { status: 'error', userId: user_id, lessonId: lesson_id, message: error instanceof Error ? error.message : String(error) });
        return { status: 500, payload: { error: 'Unable to save lesson progress' } };
      }
    }

    if (!ensureSupabase(res)) return null;
    const context = requireUserContext(req, res);
    if (!context) return null;
    const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;
    if (user_id && user_id !== context.userId) return { status: 403, payload: { error: 'forbidden', message: 'Cannot record progress for a different user.' } };
    const resolvedUserId = context.userId;
    if (!resolvedUserId || !lesson_id) return { status: 400, payload: { error: 'user_id and lesson_id are required' } };
    const rlKey = `lesson:${String(resolvedUserId).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) return { status: 429, payload: { error: 'Too many progress updates, please slow down' } };
    const opStart = Date.now();
    try {
      const toApiLessonRecord = (row, fallbackTimeSpent, fallbackResume) => ({
        user_id: row?.user_id ?? resolvedUserId,
        course_id: row?.course_id ?? null,
        lesson_id: row?.lesson_id ?? lesson_id,
        percent: clampPercent(Number(row?.progress ?? row?.percent ?? percent ?? 0)),
        status: row?.completed ?? (typeof status === 'string' ? status === 'completed' : (percent ?? 0) >= 100) ? 'completed' : 'in_progress',
        time_spent_s: Math.max(0, Math.round(row?.time_spent_seconds ?? row?.time_spent_s ?? (typeof fallbackTimeSpent === 'number' ? fallbackTimeSpent : 0))),
        resume_at_s: typeof fallbackResume === 'number' ? fallbackResume : null,
        updated_at: row?.updated_at ?? row?.created_at ?? new Date().toISOString(),
      });
      const normalizedPercent = clampPercent(typeof percent === 'number' ? percent : 0);
      const normalizedCompleted = typeof status === 'string' ? status === 'completed' : normalizedPercent >= 100;
      if (clientEventId) {
        try {
          await supabase.from('progress_events').insert({ id: clientEventId, user_id: resolvedUserId, course_id: null, lesson_id, payload: req.body });
        } catch {
          try {
            const existing = await supabase.from('user_lesson_progress').select('*').eq('user_id', resolvedUserId).eq('lesson_id', lesson_id).maybeSingle();
            if (existing && !existing.error && existing.data) return { status: 200, payload: { data: toApiLessonRecord(existing.data, time_spent_s, resume_at_s), idempotent: true } };
          } catch {}
        }
      }
      const result = await supabase.from('user_lesson_progress').upsert({
        user_id: resolvedUserId,
        lesson_id,
        progress: normalizedPercent,
        completed: normalizedCompleted,
        time_spent_seconds: Math.max(0, Math.round(typeof time_spent_s === 'number' ? time_spent_s : 0)),
      }, { onConflict: 'user_id,lesson_id' }).select('*');
      const data = firstRow(result);
      if (result.error) throw result.error;
      try {
        const apiRecord = toApiLessonRecord(data, time_spent_s, resume_at_s);
        const payload = { type: 'lesson_progress', data: apiRecord, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(apiRecord.user_id).toLowerCase()}`, payload);
        if (apiRecord.lesson_id) broadcastToTopic(`progress:lesson:${apiRecord.lesson_id}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch {}
      recordLessonProgress('supabase', Date.now() - opStart, { status: 'success', userId: resolvedUserId, lessonId: lesson_id, percent: normalizedPercent });
      if (normalizedCompleted) {
        try {
          const gamificationOrgId = normalizeOrgIdValue(context.activeOrgId) || (Array.isArray(context.organizationIds) ? context.organizationIds.map((id) => normalizeOrgIdValue(id)).find(Boolean) : null) || null;
          if (gamificationOrgId) {
            const deterministicEventId = clientEventId || `lesson_completed:${resolvedUserId}:${lesson_id}`;
            await sql.begin(async (tx) => {
              await processGamificationEvent(tx, {
                userId: String(resolvedUserId),
                orgId: String(gamificationOrgId),
                courseId: data?.course_id ?? null,
                lessonId: lesson_id,
                eventType: 'lesson_completed',
                source: 'progress',
                eventId: String(deterministicEventId),
                payload: { percent: normalizedPercent, status: 'completed' },
                occurredAt: data?.updated_at ?? new Date().toISOString(),
              });
              await upsertOrgEngagementMetrics(tx, String(gamificationOrgId));
            });
          }
        } catch (gErr) {
          logger.warn('gamification_progress_lesson_failed', { userId: resolvedUserId, lessonId: lesson_id, message: gErr instanceof Error ? gErr.message : String(gErr) });
        }
      }
      return { status: 200, payload: { data: toApiLessonRecord(data, time_spent_s, resume_at_s) } };
    } catch (error) {
      recordLessonProgress('supabase', Date.now() - opStart, { status: 'error', userId: resolvedUserId, lessonId: lesson_id, message: error instanceof Error ? error.message : String(error) });
      return { status: 500, payload: { error: 'Unable to save lesson progress' } };
    }
  };

  const saveClientProgressBatch = async ({ req, res }) => {
    const payload = req.body || {};
    const events = Array.isArray(payload.events) ? payload.events : [];
    if (events.length === 0) return { status: 400, payload: { error: 'events array is required' } };
    const PROGRESS_BATCH_MAX_SIZE = 100;
    const PROGRESS_BATCH_MAX_BYTES = 256 * 1024;
    if (events.length > PROGRESS_BATCH_MAX_SIZE) {
      return { status: 400, payload: { error: 'too_many_events', message: `Max ${PROGRESS_BATCH_MAX_SIZE} events per batch` } };
    }
    if (isDemoOrTestMode) {
      const accepted = [];
      const duplicates = [];
      const failed = [];
      for (const evt of events) {
        try {
          const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const userId = evt.userId || evt.user_id;
          const lessonId = evt.lessonId || evt.lesson_id || null;
          const courseId = evt.courseId || evt.course_id || null;
          const percentRaw = evt.percent;
          const percent = typeof percentRaw === 'number' ? Math.min(100, Math.max(0, Math.round(percentRaw))) : 0;
          if (!userId) {
            failed.push({ id, reason: 'missing_user' });
            continue;
          }
          if (!courseId && !lessonId) {
            failed.push({ id, reason: 'missing_target' });
            continue;
          }
          if (e2eStore.progressEvents.has(id)) {
            duplicates.push(id);
            continue;
          }
          e2eStore.progressEvents.add(id);
          const nowIso = new Date().toISOString();
          if (lessonId) {
            const key = `${userId}:${lessonId}`;
            const record = { user_id: userId, lesson_id: lessonId, percent, status: evt.status || 'in_progress', time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0, resume_at_s: typeof evt.position === 'number' ? evt.position : (typeof evt.resume_at_s === 'number' ? evt.resume_at_s : null), updated_at: nowIso };
            e2eStore.lessonProgress.set(key, record);
            try {
              const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
              broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
              broadcastToTopic(`progress:lesson:${lessonId}`, payload);
              broadcastToTopic('progress:all', payload);
            } catch {}
          } else if (courseId) {
            const key = `${userId}:${courseId}`;
            const record = { user_id: userId, course_id: courseId, percent, status: evt.status || 'in_progress', time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0, updated_at: nowIso };
            e2eStore.courseProgress.set(key, record);
            try {
              const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
              broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
              broadcastToTopic(`progress:course:${courseId}`, payload);
              broadcastToTopic('progress:all', payload);
            } catch {}
          }
          accepted.push(id);
        } catch {
          failed.push({ id: evt.clientEventId || evt.client_event_id || 'unknown', reason: 'exception' });
        }
      }
      return { status: 200, payload: { accepted, duplicates, failed } };
    }
    if (!ensureSupabase(res)) return null;
    const batchContext = requireUserContext(req, res);
    if (!batchContext) return null;
    const approxBytes = Buffer.byteLength(JSON.stringify(events));
    if (approxBytes > PROGRESS_BATCH_MAX_BYTES) return { status: 413, payload: { error: 'batch_payload_too_large', limitBytes: PROGRESS_BATCH_MAX_BYTES } };
    const normalizedEvents = events.map((evt) => {
      const normalizedOrgIdRaw = evt.org_id ?? evt.orgId ?? '';
      const normalizedOrgId = typeof normalizedOrgIdRaw === 'string' ? normalizedOrgIdRaw.trim() : '';
      const normalizedCourseId = evt.course_id ?? evt.courseId ?? null;
      const normalizedLessonId = evt.lesson_id ?? evt.lessonId ?? null;
      const normalizedClientEventId = evt.client_event_id || evt.clientEventId || randomUUID();
      return {
        client_event_id: normalizedClientEventId,
        user_id: batchContext.userId,
        course_id: typeof normalizedCourseId === 'string' ? normalizedCourseId.trim() : null,
        lesson_id: typeof normalizedLessonId === 'string' ? normalizedLessonId.trim() : null,
        org_id: normalizedOrgId,
        percent: typeof evt.percent === 'number' ? evt.percent : evt.progress ?? null,
        time_spent_seconds: evt.time_spent_seconds ?? evt.time_spent_s ?? evt.timeSpentSeconds ?? null,
        resume_at_seconds: evt.resume_at_seconds ?? evt.resume_at_s ?? evt.position ?? null,
        status: evt.status ?? evt.event_status ?? null,
        event_type: evt.event_type ?? evt.type ?? null,
        occurred_at: evt.occurred_at ?? evt.occurredAt ?? null,
      };
    });
    const invalidEvents = normalizedEvents.filter((evt) => !evt.user_id || (!evt.course_id && !evt.lesson_id) || !isUuid(evt.org_id || ''));
    if (invalidEvents.length) return { status: 400, payload: { error: 'invalid_events', invalid: invalidEvents.map((evt) => evt.client_event_id) } };
    const start = Date.now();
    try {
      const { data, error } = await supabase.rpc('upsert_progress_batch', { events_json: normalizedEvents });
      if (error) throw error;
      const resultRow = Array.isArray(data) ? data[0] || {} : data || {};
      const accepted = Array.isArray(resultRow.accepted) ? resultRow.accepted : [];
      const duplicates = Array.isArray(resultRow.duplicates) ? resultRow.duplicates : [];
      try {
        if (accepted.length > 0) {
          const byId = new Map(normalizedEvents.map((evt) => [evt.client_event_id, evt]));
          const completionEvents = accepted.map((id) => byId.get(id)).filter(Boolean).map((evt) => {
            const percent = typeof evt.percent === 'number' ? clampPercent(evt.percent) : null;
            const normalizedStatus = typeof evt.status === 'string' ? evt.status : null;
            const eventTypeRaw = typeof evt.event_type === 'string' ? evt.event_type : null;
            const isLesson = Boolean(evt.lesson_id);
            const isCourse = Boolean(evt.course_id) && !evt.lesson_id;
            const completed = eventTypeRaw === 'lesson_completed' || eventTypeRaw === 'course_completed' || normalizedStatus === 'completed' || (typeof percent === 'number' && percent >= 100);
            if (!completed) return null;
            return { userId: evt.user_id, orgId: evt.org_id, courseId: evt.course_id ?? null, lessonId: evt.lesson_id ?? null, eventType: isLesson ? 'lesson_completed' : isCourse ? 'course_completed' : null, eventId: evt.client_event_id, occurredAt: evt.occurred_at ?? null, payload: { percent: typeof percent === 'number' ? percent : null, status: 'completed', sourceEventType: eventTypeRaw } };
          }).filter(Boolean).filter((evt) => evt.eventType);
          if (completionEvents.length) {
            const orgIdForRollup = completionEvents[0]?.orgId ?? null;
            await sql.begin(async (tx) => {
              for (const evt of completionEvents) {
                await processGamificationEvent(tx, {
                  userId: String(evt.userId),
                  orgId: String(evt.orgId),
                  courseId: evt.courseId,
                  lessonId: evt.lessonId,
                  eventType: evt.eventType,
                  source: 'progress_batch',
                  eventId: String(evt.eventId),
                  payload: evt.payload,
                  occurredAt: evt.occurredAt,
                });
              }
              if (orgIdForRollup) await upsertOrgEngagementMetrics(tx, String(orgIdForRollup));
            });
          }
        }
      } catch (gErr) {
        logger.warn('gamification_progress_batch_failed', { requestId: req.requestId ?? null, message: gErr instanceof Error ? gErr.message : String(gErr) });
      }
      recordProgressBatch({ accepted: accepted.length, duplicates: duplicates.length, failed: 0, durationMs: Date.now() - start, batchSize: normalizedEvents.length });
      return { status: 200, payload: { accepted, duplicates, failed: [] } };
    } catch (error) {
      recordProgressBatch({ accepted: 0, duplicates: 0, failed: normalizedEvents.length, durationMs: null, batchSize: normalizedEvents.length });
      return { status: 500, payload: { error: 'Unable to process batch' } };
    }
  };

  return {
    saveLearnerSnapshot,
    saveClientCourseProgress,
    saveClientLessonProgress,
    saveClientProgressBatch,
  };
};

export default createProgressWriteService;
