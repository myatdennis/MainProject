export const createReflectionsService = ({
  logger,
  supabase,
  e2eStore,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
  resolveOrgScopeFromRequest,
  resolveOrgIdFromRequest,
  defaultSandboxOrgId,
  pickOrgId,
  coerceString,
  isMissingRelationError,
  isMissingColumnError,
  requireOrgAccess,
  persistE2EStore,
  sql,
  processGamificationEvent,
  upsertOrgEngagementMetrics,
  isUuid,
}) => {
  const normalizeReflectionText = (value) => {
    if (typeof value === 'string') return value.trim();
    return '';
  };

  const normalizeReflectionAnswerMap = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) out[key] = trimmed;
      }
    }
    return out;
  };

  const normalizeReflectionStepOrder = (value) => {
    if (!Array.isArray(value)) return null;
    const out = value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
    return out.length > 0 ? out : null;
  };

  const createEmptyReflectionResponseData = () => ({
    version: 2,
    answers: {},
    step_order: null,
    prompt_response: '',
    deeper_reflection_1: '',
    deeper_reflection_2: '',
    deeper_reflection_3: '',
    action_commitment: '',
    current_step_id: 'intro',
    submitted_at: null,
  });

  const normalizeReflectionResponseData = (value) => {
    const record = value && typeof value === 'object' ? value : {};
    const answers = normalizeReflectionAnswerMap(record.answers);
    const stepOrder = normalizeReflectionStepOrder(record.step_order ?? record.stepOrder);
    const promptResponseFallback = answers.promptResponse ?? answers.prompt_response ?? answers.prompt ?? '';
    const deeper1Fallback = answers.deeperReflection1 ?? answers.deeper_reflection_1 ?? '';
    const deeper2Fallback = answers.deeperReflection2 ?? answers.deeper_reflection_2 ?? '';
    const deeper3Fallback = answers.deeperReflection3 ?? answers.deeper_reflection_3 ?? '';
    const actionFallback = answers.actionCommitment ?? answers.action_commitment ?? '';
    return {
      version: record.version === 2 ? 2 : 1,
      answers,
      step_order: stepOrder,
      prompt_response: normalizeReflectionText(record.prompt_response ?? record.promptResponse ?? promptResponseFallback),
      deeper_reflection_1: normalizeReflectionText(record.deeper_reflection_1 ?? record.deeperReflection1 ?? deeper1Fallback),
      deeper_reflection_2: normalizeReflectionText(record.deeper_reflection_2 ?? record.deeperReflection2 ?? deeper2Fallback),
      deeper_reflection_3: normalizeReflectionText(record.deeper_reflection_3 ?? record.deeperReflection3 ?? deeper3Fallback),
      action_commitment: normalizeReflectionText(record.action_commitment ?? record.actionCommitment ?? actionFallback),
      current_step_id: normalizeReflectionText(record.current_step_id ?? record.currentStepId) || 'intro',
      submitted_at:
        typeof (record.submitted_at ?? record.submittedAt) === 'string'
          ? record.submitted_at ?? record.submittedAt
          : null,
    };
  };

  const mergeReflectionResponseData = ({ responseData, responseText, status }) => {
    const normalized = {
      ...createEmptyReflectionResponseData(),
      ...normalizeReflectionResponseData(responseData),
    };
    if (normalizeReflectionText(responseText) && !normalized.prompt_response) {
      normalized.prompt_response = normalizeReflectionText(responseText);
    }
    if (normalized.prompt_response && normalized.answers && typeof normalized.answers === 'object' && !normalized.answers.promptResponse) {
      normalized.answers.promptResponse = normalized.prompt_response;
    }
    if (status === 'submitted' && !normalized.submitted_at) normalized.submitted_at = new Date().toISOString();
    if (status !== 'submitted') normalized.submitted_at = normalized.submitted_at ?? null;
    return normalized;
  };

  const summarizeReflectionResponseData = (responseData) => {
    const answers = responseData?.answers;
    if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
      const order = normalizeReflectionStepOrder(responseData?.step_order) ?? null;
      const keys = order ?? Object.keys(answers);
      return keys.map((key) => normalizeReflectionText(answers[key])).filter(Boolean).join('\n\n');
    }
    return [
      responseData?.prompt_response,
      responseData?.deeper_reflection_1,
      responseData?.deeper_reflection_2,
      responseData?.deeper_reflection_3,
      responseData?.action_commitment,
    ].map((value) => normalizeReflectionText(value)).filter(Boolean).join('\n\n');
  };

  const buildReflectionStoreKey = ({ orgId, courseId, lessonId, userId }) =>
    `${String(orgId || 'no-org').toLowerCase()}:${String(courseId).toLowerCase()}:${String(lessonId).toLowerCase()}:${String(userId).toLowerCase()}`;

  const shapeReflectionRecord = (row) => ({
    id: row.id,
    organizationId: row.organization_id ?? row.organizationId ?? null,
    courseId: row.course_id ?? row.courseId ?? null,
    moduleId: row.module_id ?? row.moduleId ?? null,
    lessonId: row.lesson_id ?? row.lessonId ?? null,
    userId: row.user_id ?? row.userId ?? null,
    responseText: row.response_text ?? row.responseText ?? summarizeReflectionResponseData(row.response_data ?? row.responseData) ?? '',
    responseData: normalizeReflectionResponseData(row.response_data ?? row.responseData),
    status: row.status ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    learnerEmail: row.learner_email ?? row.learnerEmail ?? null,
    learnerName: row.learner_name ?? row.learnerName ?? null,
    lessonTitle: row.lesson_title ?? row.lessonTitle ?? null,
    moduleTitle: row.module_title ?? row.moduleTitle ?? null,
  });

  const extractLearnerReflectionRequest = (req) => ({
    courseId: coerceString(req.query?.courseId, req.query?.course_id, req.body?.courseId, req.body?.course_id),
    lessonId: coerceString(req.params?.lessonId, req.query?.lessonId, req.query?.lesson_id, req.body?.lessonId, req.body?.lesson_id),
  });

  const resolveReflectionLessonContext = async ({ req, res, orgId, courseId, lessonId }) => {
    if (!lessonId) return { status: 400, payload: { error: 'validation_failed', message: 'lessonId is required.' } };
    if (isDemoOrTestMode) {
      let fallbackMatch = null;
      let matchedCourse = null;
      for (const course of e2eStore.courses.values()) {
        if (!course) continue;
        if (courseId && String(course.id) === String(courseId)) matchedCourse = course;
        const courseOrgId = pickOrgId(course.organization_id, course.organizationId, course.org_id) || orgId;
        if (String(courseOrgId || '').toLowerCase() !== String(orgId || '').toLowerCase()) continue;
        for (const module of Array.isArray(course.modules) ? course.modules : []) {
          const lesson = (Array.isArray(module.lessons) ? module.lessons : []).find((candidate) => String(candidate.id) === String(lessonId));
          if (!lesson) continue;
          const match = {
            courseId: String(courseId),
            lessonId: String(lessonId),
            moduleId: coerceString(lesson.module_id, lesson.moduleId, module.id),
            lessonTitle: coerceString(lesson.title),
            moduleTitle: coerceString(module.title),
            orgId: courseOrgId,
          };
          if (!courseId || String(course.id) === String(courseId)) return { ...match, courseId: String(course.id) };
          fallbackMatch = { ...match, courseId: String(course.id) };
        }
      }
      if (matchedCourse) {
        const modules = Array.isArray(matchedCourse.modules) ? matchedCourse.modules : [];
        const firstModule = modules[0] ?? null;
        return {
          courseId: String(matchedCourse.id),
          lessonId: String(lessonId),
          moduleId: coerceString(firstModule?.id),
          lessonTitle: null,
          moduleTitle: coerceString(firstModule?.title),
          orgId: pickOrgId(matchedCourse.organization_id, matchedCourse.organizationId, matchedCourse.org_id) || orgId,
        };
      }
      if (fallbackMatch) return fallbackMatch;
      return { status: 404, payload: { error: 'lesson_not_found', message: 'The requested reflection lesson was not found in this course.' } };
    }

    if (!ensureSupabase(res)) return null;
    const lessonResult = await supabase.from('lessons').select('id,module_id,title').eq('id', lessonId).maybeSingle();
    if (lessonResult.error) {
      if (isMissingRelationError(lessonResult.error) || isMissingColumnError(lessonResult.error)) {
        if (courseId) return { courseId: String(courseId), lessonId: String(lessonId), moduleId: null, lessonTitle: null, moduleTitle: null, orgId };
        return { status: 503, payload: { error: 'reflection_storage_unavailable', message: 'Reflection storage is not ready yet.' } };
      }
      throw lessonResult.error;
    }
    if (!lessonResult.data) return { status: 404, payload: { error: 'lesson_not_found', message: 'The requested reflection lesson was not found.' } };

    const moduleId = lessonResult.data.module_id ?? null;
    if (!moduleId) {
      if (courseId) return { courseId: String(courseId), lessonId: String(lessonId), moduleId: null, lessonTitle: lessonResult.data.title ?? null, moduleTitle: null, orgId };
      return { status: 503, payload: { error: 'reflection_storage_unavailable', message: 'Reflection lesson is missing module context.' } };
    }

    const moduleResult = await supabase.from('modules').select('id,course_id,title').eq('id', moduleId).maybeSingle();
    if (moduleResult.error) {
      if (isMissingRelationError(moduleResult.error) || isMissingColumnError(moduleResult.error)) {
        if (courseId) return { courseId: String(courseId), lessonId: String(lessonId), moduleId, lessonTitle: lessonResult.data.title ?? null, moduleTitle: null, orgId };
        return { status: 503, payload: { error: 'reflection_storage_unavailable', message: 'Reflection storage is not ready yet.' } };
      }
      throw moduleResult.error;
    }
    if (!moduleResult.data?.course_id) {
      if (courseId) return { courseId: String(courseId), lessonId: String(lessonId), moduleId, lessonTitle: lessonResult.data.title ?? null, moduleTitle: moduleResult.data?.title ?? null, orgId };
      return { status: 404, payload: { error: 'course_not_found', message: 'Course not found.' } };
    }

    const resolvedCourseId = moduleResult.data.course_id ?? null;
    if (courseId && String(resolvedCourseId) !== String(courseId)) {
      return { status: 404, payload: { error: 'lesson_not_found', message: 'The requested reflection lesson was not found in this course.' } };
    }
    const courseResult = await supabase.from('courses').select('id,organization_id,org_id,title').eq('id', resolvedCourseId).maybeSingle();
    if (courseResult.error) {
      if (isMissingRelationError(courseResult.error) || isMissingColumnError(courseResult.error)) {
        if (courseId) return { courseId: String(courseId), lessonId: String(lessonId), moduleId, lessonTitle: lessonResult.data.title ?? null, moduleTitle: moduleResult.data?.title ?? null, orgId };
        return { status: 503, payload: { error: 'reflection_storage_unavailable', message: 'Reflection storage is not ready yet.' } };
      }
      throw courseResult.error;
    }
    const course = courseResult.data;
    if (!course) return { status: 404, payload: { error: 'course_not_found', message: 'Course not found.' } };
    const courseOrgId = pickOrgId(course.organization_id, course.org_id);
    if (courseOrgId && String(courseOrgId).toLowerCase() !== String(orgId).toLowerCase()) {
      return { status: 403, payload: { error: 'org_scope_mismatch', message: 'This lesson does not belong to the selected organization.' } };
    }
    return {
      courseId: String(resolvedCourseId),
      lessonId: String(lessonId),
      moduleId,
      lessonTitle: lessonResult.data.title ?? null,
      moduleTitle: moduleResult.data.title ?? null,
      orgId: courseOrgId ?? orgId,
    };
  };

  const fetchReflectionProfileLookup = async (userIds) => {
    const normalizedIds = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((value) => coerceString(value)).filter(Boolean)));
    if (normalizedIds.length === 0 || isDemoOrTestMode || !supabase) return new Map();
    const profileResult = await supabase.from('user_profiles').select('id,email,full_name').in('id', normalizedIds);
    if (profileResult.error || !Array.isArray(profileResult.data)) return new Map();
    return new Map(profileResult.data.map((profile) => [String(profile.id).toLowerCase(), profile]));
  };

  const shapeAdminReflectionRows = ({ rows, profileLookup = new Map(), lessonContextById = new Map() }) =>
    (Array.isArray(rows) ? rows : []).map((row) => {
      const profile = profileLookup.get(String(row.user_id || row.userId || '').toLowerCase());
      const lessonContext = lessonContextById.get(String(row.lesson_id || row.lessonId || '').toLowerCase());
      return shapeReflectionRecord({
        ...row,
        learner_email: profile?.email ?? null,
        learner_name: profile?.full_name ?? null,
        lesson_title: lessonContext?.lessonTitle ?? null,
        module_title: lessonContext?.moduleTitle ?? null,
        module_id: row.module_id ?? lessonContext?.moduleId ?? null,
      });
    });

  const getLearnerReflection = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    if (orgScope.requiresExplicitSelection) return { status: 403, payload: { error: 'org_selection_required', message: 'Select an organization before loading reflections.' } };
    const { courseId, lessonId } = extractLearnerReflectionRequest(req);
    const userId = context.userId;
    const orgId = orgScope.orgId ?? resolveOrgIdFromRequest(req, context) ?? defaultSandboxOrgId;
    const lessonContext = await resolveReflectionLessonContext({ req, res, orgId, courseId, lessonId });
    if (!lessonContext) return null;
    if (lessonContext.status) return lessonContext;
    if (isDemoOrTestMode) {
      const record = e2eStore.lessonReflections.get(buildReflectionStoreKey({ orgId, courseId: lessonContext.courseId, lessonId: lessonContext.lessonId, userId })) || null;
      return { status: 200, payload: { data: record ? shapeReflectionRecord(record) : null, meta: { mode: 'demo' } } };
    }
    const { data, error } = await supabase.from('lesson_reflections').select('*').eq('organization_id', orgId).eq('course_id', lessonContext.courseId).eq('lesson_id', lessonContext.lessonId).eq('user_id', userId).maybeSingle();
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return { status: 200, payload: { data: null, meta: { degraded: true, reason: 'reflection_storage_unavailable' } } };
      }
      throw error;
    }
    return { status: 200, payload: { data: data ? shapeReflectionRecord(data) : null } };
  };

  const saveLearnerReflection = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    if (orgScope.requiresExplicitSelection) return { status: 403, payload: { error: 'org_selection_required', message: 'Select an organization before saving reflections.' } };
    const { courseId, lessonId } = extractLearnerReflectionRequest(req);
    const responseText = normalizeReflectionText(req.body?.responseText ?? req.body?.response_text);
    const requestedStatus = normalizeReflectionText(req.body?.status);
    const status = requestedStatus === 'submitted' ? 'submitted' : 'draft';
    const responseData = mergeReflectionResponseData({ responseData: req.body?.responseData ?? req.body?.response_data, responseText, status });
    const orgId = orgScope.orgId ?? resolveOrgIdFromRequest(req, context) ?? defaultSandboxOrgId;
    const userId = context.userId;
    const nowIso = new Date().toISOString();
    const saveStartedAt = Date.now();
    const lessonContext = await resolveReflectionLessonContext({ req, res, orgId, courseId, lessonId });
    if (!lessonContext) return null;
    if (lessonContext.status) return lessonContext;

    logger.info('learner_reflection_save_attempt', {
      requestId: req.requestId ?? null,
      route: '/api/learner/lessons/:lessonId/reflection',
      userId,
      orgId,
      lessonId: lessonContext.lessonId,
      courseId: lessonContext.courseId,
      status,
      responseSize: summarizeReflectionResponseData(responseData).length,
    });

    if (isDemoOrTestMode) {
      const key = buildReflectionStoreKey({ orgId, courseId: lessonContext.courseId, lessonId: lessonContext.lessonId, userId });
      const existing = e2eStore.lessonReflections.get(key);
      const record = {
        id: existing?.id ?? `reflection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        organization_id: orgId,
        course_id: lessonContext.courseId,
        module_id: lessonContext.moduleId,
        lesson_id: lessonContext.lessonId,
        user_id: userId,
        response_text: summarizeReflectionResponseData(responseData),
        response_data: responseData,
        status,
        created_at: existing?.created_at ?? nowIso,
        updated_at: nowIso,
      };
      e2eStore.lessonReflections.set(key, record);
      persistE2EStore();
      if (status === 'submitted' && isUuid(orgId) && isUuid(userId)) {
        try {
          const deterministicEventId = `reflection_submitted:${userId}:${lessonContext.courseId}:${lessonContext.lessonId}`;
          await sql.begin(async (tx) => {
            await processGamificationEvent(tx, {
              userId: String(userId),
              orgId: String(orgId),
              courseId: String(lessonContext.courseId),
              lessonId: String(lessonContext.lessonId),
              eventType: 'reflection_saved',
              source: 'reflection',
              eventId: deterministicEventId,
              payload: { status: 'submitted' },
              occurredAt: nowIso,
            });
            await upsertOrgEngagementMetrics(tx, String(orgId));
          });
        } catch (gErr) {
          logger.warn('gamification_reflection_demo_failed', { requestId: req.requestId ?? null, userId, orgId, message: gErr instanceof Error ? gErr.message : String(gErr) });
        }
      }
      logger.info('learner_reflection_save_success', {
        requestId: req.requestId ?? null,
        userId,
        orgId,
        lessonId: lessonContext.lessonId,
        courseId: lessonContext.courseId,
        status,
        responseSize: record.response_text.length,
        timingMs: Date.now() - saveStartedAt,
        mode: 'demo',
      });
      return { status: 202, payload: { data: shapeReflectionRecord(record), meta: { mode: 'demo' } } };
    }

    const payload = {
      organization_id: orgId,
      course_id: lessonContext.courseId,
      module_id: lessonContext.moduleId,
      lesson_id: lessonContext.lessonId,
      user_id: userId,
      response_text: summarizeReflectionResponseData(responseData),
      response_data: responseData,
      status,
      updated_at: nowIso,
    };
    let data = null;
    let error = null;
    ({ data, error } = await supabase.from('lesson_reflections').upsert(payload, { onConflict: 'organization_id,course_id,lesson_id,user_id' }).select('*').maybeSingle());
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase.from('lesson_reflections').upsert({
        organization_id: orgId,
        course_id: lessonContext.courseId,
        lesson_id: lessonContext.lessonId,
        user_id: userId,
        response_text: summarizeReflectionResponseData(responseData),
        updated_at: nowIso,
        status,
      }, { onConflict: 'organization_id,course_id,lesson_id,user_id' }).select('*').maybeSingle());
    }
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        if (status === 'submitted' && isUuid(orgId) && isUuid(userId)) {
          try {
            const deterministicEventId = `reflection_submitted:${userId}:${lessonContext.courseId}:${lessonContext.lessonId}`;
            await sql.begin(async (tx) => {
              await processGamificationEvent(tx, {
                userId: String(userId),
                orgId: String(orgId),
                courseId: String(lessonContext.courseId),
                lessonId: String(lessonContext.lessonId),
                eventType: 'reflection_saved',
                source: 'reflection',
                eventId: deterministicEventId,
                payload: { status: 'submitted' },
                occurredAt: nowIso,
              });
              await upsertOrgEngagementMetrics(tx, String(orgId));
            });
          } catch (gErr) {
            logger.warn('gamification_reflection_degraded_failed', { requestId: req.requestId ?? null, userId, orgId, message: gErr instanceof Error ? gErr.message : String(gErr) });
          }
        }
        return {
          status: 202,
          payload: {
            data: {
              id: `reflection-local-${Date.now()}`,
              organizationId: orgId,
              courseId: lessonContext.courseId,
              moduleId: lessonContext.moduleId,
              lessonId: lessonContext.lessonId,
              userId,
              responseText: summarizeReflectionResponseData(responseData),
              responseData: normalizeReflectionResponseData(responseData),
              status,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            meta: { degraded: true, reason: 'reflection_storage_unavailable' },
          },
        };
      }
      logger.error('learner_reflection_save_failure', {
        requestId: req.requestId ?? null,
        userId,
        orgId,
        lessonId: lessonContext.lessonId,
        courseId: lessonContext.courseId,
        status,
        responseSize: summarizeReflectionResponseData(responseData).length,
        timingMs: Date.now() - saveStartedAt,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      throw error;
    }
    logger.info('learner_reflection_save_success', {
      requestId: req.requestId ?? null,
      userId,
      orgId,
      lessonId: lessonContext.lessonId,
      courseId: lessonContext.courseId,
      status,
      responseSize: summarizeReflectionResponseData(responseData).length,
      timingMs: Date.now() - saveStartedAt,
      mode: 'db',
    });
    if (status === 'submitted' && isUuid(orgId) && isUuid(userId)) {
      try {
        const deterministicEventId = `reflection_submitted:${userId}:${lessonContext.courseId}:${lessonContext.lessonId}`;
        await sql.begin(async (tx) => {
          await processGamificationEvent(tx, {
            userId: String(userId),
            orgId: String(orgId),
            courseId: String(lessonContext.courseId),
            lessonId: String(lessonContext.lessonId),
            eventType: 'reflection_saved',
            source: 'reflection',
            eventId: deterministicEventId,
            payload: { status: 'submitted' },
            occurredAt: nowIso,
          });
          await upsertOrgEngagementMetrics(tx, String(orgId));
        });
      } catch (gErr) {
        logger.warn('gamification_reflection_failed', { requestId: req.requestId ?? null, userId, orgId, lessonId: lessonContext.lessonId, courseId: lessonContext.courseId, message: gErr instanceof Error ? gErr.message : String(gErr) });
      }
    }
    return { status: 202, payload: { data: shapeReflectionRecord(data ?? payload) } };
  };

  const listAdminLessonReflections = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const orgId = coerceString(req.query.orgId, req.query.organizationId, req.query.organization_id);
    const courseId = coerceString(req.query.courseId, req.query.course_id);
    const lessonId = coerceString(req.params?.lessonId, req.query.lessonId, req.query.lesson_id);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    if (!orgId || !courseId || !lessonId) return { status: 400, payload: { error: 'validation_failed', message: 'orgId, courseId, and lessonId are required.' } };
    const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
    if (!access) return null;
    const lessonContext = await resolveReflectionLessonContext({ req, res, orgId, courseId, lessonId });
    if (!lessonContext) return null;
    if (lessonContext.status) return lessonContext;
    if (isDemoOrTestMode) {
      const rows = Array.from(e2eStore.lessonReflections.values())
        .filter((row) =>
          String(row.organization_id || '').toLowerCase() === String(orgId).toLowerCase() &&
          String(row.course_id || '').toLowerCase() === String(lessonContext.courseId).toLowerCase() &&
          String(row.lesson_id || '').toLowerCase() === String(lessonContext.lessonId).toLowerCase(),
        )
        .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
      const userLookup = new Map((Array.isArray(e2eStore.users) ? e2eStore.users : []).map((user) => [String(user.id).toLowerCase(), user]));
      const paged = rows.slice(offset, offset + limit).map((row) => {
        const user = userLookup.get(String(row.user_id || '').toLowerCase());
        return shapeReflectionRecord({
          ...row,
          learner_email: user?.email ?? null,
          learner_name: user?.full_name ?? user?.name ?? null,
          lesson_title: lessonContext.lessonTitle,
          module_title: lessonContext.moduleTitle,
          module_id: row.module_id ?? lessonContext.moduleId,
        });
      });
      return { status: 200, payload: { data: { rows: paged, total: rows.length }, meta: { mode: 'demo' } } };
    }
    const { data, count, error } = await supabase.from('lesson_reflections').select('*', { count: 'exact' }).eq('organization_id', orgId).eq('course_id', lessonContext.courseId).eq('lesson_id', lessonContext.lessonId).order('updated_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) return { status: 200, payload: { data: { rows: [], total: 0 }, meta: { degraded: true, reason: 'reflection_storage_unavailable' } } };
      throw error;
    }
    const rows = Array.isArray(data) ? data : [];
    const profileLookup = await fetchReflectionProfileLookup(rows.map((row) => row.user_id));
    const shaped = shapeAdminReflectionRows({ rows, profileLookup, lessonContextById: new Map([[String(lessonContext.lessonId).toLowerCase(), lessonContext]]) });
    return { status: 200, payload: { data: { rows: shaped, total: count ?? shaped.length } } };
  };

  const listAdminCourseReflections = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const orgId = coerceString(req.query.orgId, req.query.organizationId, req.query.organization_id);
    const courseId = coerceString(req.params?.courseId, req.query.courseId, req.query.course_id);
    const lessonIdFilter = coerceString(req.query.lessonId, req.query.lesson_id);
    const search = normalizeReflectionText(req.query.search);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50) || 50));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    if (!orgId || !courseId) return { status: 400, payload: { error: 'validation_failed', message: 'orgId and courseId are required.' } };
    const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
    if (!access) return null;
    if (isDemoOrTestMode) {
      const course = e2eStore.courses.get(courseId);
      const lessonContextById = new Map();
      for (const module of Array.isArray(course?.modules) ? course.modules : []) {
        for (const lesson of Array.isArray(module.lessons) ? module.lessons : []) {
          lessonContextById.set(String(lesson.id).toLowerCase(), {
            lessonId: lesson.id,
            moduleId: coerceString(lesson.module_id, lesson.moduleId, module.id),
            lessonTitle: coerceString(lesson.title),
            moduleTitle: coerceString(module.title),
          });
        }
      }
      const userLookup = new Map((Array.isArray(e2eStore.users) ? e2eStore.users : []).map((user) => [String(user.id).toLowerCase(), user]));
      const allRows = Array.from(e2eStore.lessonReflections.values())
        .filter((row) =>
          String(row.organization_id || '').toLowerCase() === String(orgId).toLowerCase() &&
          String(row.course_id || '').toLowerCase() === String(courseId).toLowerCase() &&
          (!lessonIdFilter || String(row.lesson_id || '').toLowerCase() === String(lessonIdFilter).toLowerCase()),
        )
        .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')))
        .map((row) => {
          const user = userLookup.get(String(row.user_id || '').toLowerCase());
          const lessonContext = lessonContextById.get(String(row.lesson_id || '').toLowerCase());
          return shapeReflectionRecord({
            ...row,
            learner_email: user?.email ?? null,
            learner_name: user?.full_name ?? user?.name ?? null,
            lesson_title: lessonContext?.lessonTitle ?? null,
            module_title: lessonContext?.moduleTitle ?? null,
            module_id: row.module_id ?? lessonContext?.moduleId ?? null,
          });
        })
        .filter((row) => {
          if (!search) return true;
          const haystack = [row.learnerName, row.learnerEmail, row.responseText, row.responseData?.promptResponse, row.responseData?.deeperReflection1, row.responseData?.deeperReflection2, row.responseData?.deeperReflection3, row.responseData?.actionCommitment, row.lessonTitle, row.moduleTitle].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(search.toLowerCase());
        });
      return { status: 200, payload: { data: { rows: allRows.slice(offset, offset + limit), total: allRows.length }, meta: { mode: 'demo' } } };
    }
    if (!ensureSupabase(res)) return null;
    const courseResult = await supabase.from('courses').select('id,organization_id,org_id').eq('id', courseId).maybeSingle();
    if (courseResult.error) throw courseResult.error;
    if (!courseResult.data) return { status: 404, payload: { error: 'course_not_found', message: 'Course not found.' } };
    const courseOrgId = pickOrgId(courseResult.data.organization_id, courseResult.data.org_id);
    if (courseOrgId && String(courseOrgId).toLowerCase() !== String(orgId).toLowerCase()) {
      return { status: 403, payload: { error: 'org_scope_mismatch', message: 'This course does not belong to the selected organization.' } };
    }
    const moduleGraphResult = await supabase.from('modules').select('id,title,lessons:lessons!lessons_module_id_fkey(id,module_id,title)').eq('course_id', courseId).order('order_index', { ascending: true });
    if (moduleGraphResult.error) throw moduleGraphResult.error;
    const modules = Array.isArray(moduleGraphResult.data) ? moduleGraphResult.data : [];
    const moduleLookup = new Map(modules.map((module) => [String(module.id).toLowerCase(), module]));
    const lessons = modules.flatMap((module) => (Array.isArray(module.lessons) ? module.lessons : []));
    const lessonContextById = new Map(lessons.map((lesson) => [String(lesson.id).toLowerCase(), {
      lessonId: lesson.id,
      moduleId: lesson.module_id ?? null,
      lessonTitle: lesson.title ?? null,
      moduleTitle: moduleLookup.get(String(lesson.module_id || '').toLowerCase())?.title ?? null,
    }]));
    let query = supabase.from('lesson_reflections').select('*', { count: 'exact' }).eq('organization_id', orgId).eq('course_id', courseId).order('updated_at', { ascending: false });
    if (lessonIdFilter) query = query.eq('lesson_id', lessonIdFilter);
    const queryResult = await query.range(offset, offset + limit - 1);
    const { data, count, error } = queryResult;
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) return { status: 200, payload: { data: { rows: [], total: 0 }, meta: { degraded: true, reason: 'reflection_storage_unavailable' } } };
      throw error;
    }
    const rows = Array.isArray(data) ? data : [];
    const profileLookup = await fetchReflectionProfileLookup(rows.map((row) => row.user_id));
    const shaped = shapeAdminReflectionRows({ rows, profileLookup, lessonContextById }).filter((row) => {
      if (!search) return true;
      const haystack = [row.learnerName, row.learnerEmail, row.responseText, row.responseData?.promptResponse, row.responseData?.deeperReflection1, row.responseData?.deeperReflection2, row.responseData?.deeperReflection3, row.responseData?.actionCommitment, row.lessonTitle, row.moduleTitle].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
    return { status: 200, payload: { data: { rows: shaped, total: count ?? shaped.length } } };
  };

  return { getLearnerReflection, saveLearnerReflection, listAdminLessonReflections, listAdminCourseReflections };
};

export default createReflectionsService;
