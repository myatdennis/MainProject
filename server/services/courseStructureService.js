const logLessonEvent = (logger, level, event, meta = {}) => {
  const fn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info;
  fn(event, meta);
};

const buildLessonLogMeta = (req, context) => ({
  requestId: req.requestId ?? null,
  userId: context?.userId ?? null,
  orgId: null,
  moduleId: null,
  lessonId: null,
  lessonType: null,
  orderIndex: null,
});

const respondLessonError = (logger, res, logMeta, event, status, code, message, detail = null) => {
  logLessonEvent(logger, 'error', event, { ...logMeta, status, code, message, detail });
  res.status(status).json({ code, message, detail });
};

export const createCourseStructureService = ({
  logger,
  supabase,
  ensureSupabase,
  isDemoOrTestMode,
  e2eStore,
  e2eFindCourse,
  e2eFindModule,
  e2eFindLesson,
  persistE2EStore,
  requireUserContext,
  requireOrgAccess,
  sendApiResponse,
  sendApiError,
  validateOr400,
  moduleCreateSchema,
  modulePatchValidator,
  moduleReorderSchema,
  lessonCreateSchema,
  lessonPatchValidator,
  lessonReorderSchema,
  pickId,
  pickOrder,
  pickOrgId,
  firstRow,
  prepareLessonPersistencePayload,
  prepareLessonContentWithCompletionRule,
  extractCompletionRule,
  applyLessonColumnSupport,
  randomUUID,
}) => ({
  createModule: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const parsed = validateOr400(moduleCreateSchema, req, res);
      if (!parsed) return;
      const courseId = pickId(parsed, 'course_id', 'courseId');
      const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
      const title = parsed.title;
      const description = parsed.description ?? null;
      const orderIndex = pickOrder(parsed);
      const metadata = parsed.metadata ?? {};
      if (!courseId || !title) {
        sendApiError(res, 400, 'validation_failed', 'courseId and title are required');
        return;
      }
      const course = e2eFindCourse(courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (typeof expectedCourseVersion === 'number') {
        const current = course.version ?? 1;
        if (expectedCourseVersion < current) {
          sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`);
          return;
        }
      }
      const id = `e2e-mod-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const mod = { id, course_id: course.id, title, description, order_index: orderIndex, lessons: [], metadata: metadata ?? {} };
      course.modules = course.modules || [];
      course.modules.push(mod);
      persistE2EStore();
      sendApiResponse(res, { id, course_id: course.id, title, description, order_index: orderIndex }, {
        statusCode: 201,
        code: 'module_created',
        message: 'Module created.',
        meta: { requestId: req.requestId ?? null, courseId: course.id, moduleId: id },
      });
      return;
    }
    if (!ensureSupabase(res)) return;
    try {
      const parsed = validateOr400(moduleCreateSchema, req, res);
      if (!parsed) return;
      const courseId = pickId(parsed, 'course_id', 'courseId');
      const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
      const title = parsed.title;
      const description = parsed.description ?? null;
      const orderIndex = pickOrder(parsed);
      if (!courseId || !title) {
        sendApiError(res, 400, 'validation_failed', 'courseId and title are required', {
          meta: { requestId: req.requestId ?? null },
        });
        return;
      }
      if (typeof expectedCourseVersion === 'number') {
        const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const current = courseRow?.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`, {
            meta: { requestId: req.requestId ?? null, courseId },
          });
          return;
        }
      }
      const result = await supabase.from('modules').insert({ course_id: courseId, title, description, order_index: orderIndex }).select('*');
      if (result.error) throw result.error;
      const data = firstRow(result);
      if (!data) throw new Error('module_insert_no_rows');
      sendApiResponse(res, { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 }, {
        statusCode: 201,
        code: 'module_created',
        message: 'Module created.',
        meta: { requestId: req.requestId ?? null, courseId: data.course_id, moduleId: data.id },
      });
    } catch (error) {
      sendApiError(res, 500, 'module_create_failed', 'Unable to create module', {
        meta: { requestId: req.requestId ?? null },
      });
    }
  },

  updateModule: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const { id } = req.params;
      const parsed = validateOr400(modulePatchValidator, req, res);
      if (!parsed) return;
      const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
      const title = parsed.title;
      const description = parsed.description ?? null;
      const orderIndex = pickOrder(parsed);
      const found = e2eFindModule(id);
      if (!found) {
        sendApiError(res, 404, 'module_not_found', 'Module not found', {
          meta: { requestId: req.requestId ?? null, moduleId: id },
        });
        return;
      }
      if (typeof expectedCourseVersion === 'number') {
        const current = found.module.version ?? 1;
        if (expectedCourseVersion < current) {
          sendApiError(res, 409, 'version_conflict', `Module has newer version ${current}`, {
            meta: { requestId: req.requestId ?? null, moduleId: id },
          });
          return;
        }
      }
      if (typeof title === 'string') found.module.title = title;
      if (description !== undefined) found.module.description = description;
      if (typeof orderIndex === 'number') found.module.order_index = orderIndex;
      persistE2EStore();
      sendApiResponse(res, { id: found.module.id, course_id: found.course.id, title: found.module.title, description: found.module.description, order_index: found.module.order_index ?? 0 }, {
        code: 'module_updated',
        message: 'Module updated.',
        meta: { requestId: req.requestId ?? null, courseId: found.course.id, moduleId: found.module.id },
      });
      return;
    }
    if (!ensureSupabase(res)) return;
    try {
      const { id } = req.params;
      const parsed = validateOr400(modulePatchValidator, req, res);
      if (!parsed) return;
      const title = parsed.title;
      const description = parsed.description ?? null;
      const orderIndex = pickOrder(parsed);
      const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
      const patch = {};
      if (typeof title === 'string') patch.title = title;
      if (description !== undefined) patch.description = description;
      if (typeof orderIndex === 'number') patch.order_index = orderIndex;
      if (Object.keys(patch).length === 0) {
        sendApiError(res, 400, 'no_fields_to_update', 'No fields to update', {
          meta: { requestId: req.requestId ?? null, moduleId: id },
        });
        return;
      }
      if (typeof expectedCourseVersion === 'number') {
        const { data: modRow, error: modErr } = await supabase.from('modules').select('id,course_id').eq('id', id).maybeSingle();
        if (modErr) throw modErr;
        const courseId = modRow?.course_id ?? null;
        if (courseId) {
          const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
          if (fetchErr) throw fetchErr;
          const current = courseRow?.version ?? null;
          if (current !== null && expectedCourseVersion < current) {
            sendApiError(res, 409, 'version_conflict', `Course has newer version ${current}`, {
              meta: { requestId: req.requestId ?? null, courseId, moduleId: id },
            });
            return;
          }
        }
      }
      const result = await supabase.from('modules').update(patch).eq('id', id).select('*');
      if (result.error) throw result.error;
      const data = firstRow(result);
      if (!data) {
        sendApiError(res, 404, 'module_not_found', 'Module not found or no rows updated', {
          meta: { requestId: req.requestId ?? null, moduleId: id },
        });
        return;
      }
      sendApiResponse(res, { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 }, {
        code: 'module_updated',
        message: 'Module updated.',
        meta: { requestId: req.requestId ?? null, courseId: data.course_id, moduleId: data.id },
      });
    } catch (_error) {
      sendApiError(res, 500, 'module_update_failed', 'Unable to update module', {
        meta: { requestId: req.requestId ?? null, moduleId: req.params?.id ?? null },
      });
    }
  },

  deleteModule: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const { id } = req.params;
      const found = e2eFindModule(id);
      if (!found) {
        res.status(204).end();
        return;
      }
      found.course.modules = (found.course.modules || []).filter((m) => String(m.id) !== String(id));
      persistE2EStore();
      res.status(204).end();
      return;
    }
    if (!ensureSupabase(res)) return;
    const context = requireUserContext(req, res);
    if (!context) return;
    try {
      const { id } = req.params;
      const { data: moduleRow, error: moduleErr } = await supabase.from('modules').select('id, course_id').eq('id', id).maybeSingle();
      if (moduleErr) throw moduleErr;
      if (!moduleRow) {
        res.status(204).end();
        return;
      }
      if (moduleRow.course_id) {
        const { data: courseRow, error: courseErr } = await supabase.from('courses').select('id, organization_id').eq('id', moduleRow.course_id).maybeSingle();
        if (courseErr) throw courseErr;
        const moduleOrgId = courseRow?.organization_id ?? null;
        if (moduleOrgId) {
          const access = await requireOrgAccess(req, res, moduleOrgId, { write: true, requireOrgAdmin: true });
          if (!access) return;
        } else if (!context.isPlatformAdmin) {
          res.status(403).json({ error: 'organization_required', message: 'Module course is not scoped to an organization.' });
          return;
        }
      } else if (!context.isPlatformAdmin) {
        res.status(403).json({ error: 'organization_required', message: 'Module is not scoped to an organization.' });
        return;
      }
      await supabase.from('lessons').delete().eq('module_id', id);
      await supabase.from('modules').delete().eq('id', id);
      res.status(204).end();
    } catch (_error) {
      res.status(500).json({ error: 'Unable to delete module' });
    }
  },

  reorderModules: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const parsed = validateOr400(moduleReorderSchema, req, res);
      if (!parsed) return;
      const courseId = pickId(parsed, 'course_id', 'courseId');
      const modules = parsed.modules;
      const course = e2eFindCourse(courseId);
      if (!course) {
        sendApiError(res, 404, 'course_not_found', 'Course not found', {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
      const orderMap = new Map((modules || []).map((m) => [String(m.id), pickOrder(m)]));
      (course.modules || []).forEach((m) => {
        const idx = orderMap.get(String(m.id));
        if (typeof idx === 'number') m.order_index = idx;
      });
      const sorted = (course.modules || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      course.modules = sorted;
      persistE2EStore();
      const response = sorted.map((m) => ({ id: m.id, order_index: m.order_index ?? 0 }));
      sendApiResponse(res, response, {
        code: 'modules_reordered',
        message: 'Modules reordered.',
        meta: { requestId: req.requestId ?? null, courseId },
      });
      return;
    }
    if (!ensureSupabase(res)) return;
    try {
      const parsed = validateOr400(moduleReorderSchema, req, res);
      if (!parsed) return;
      const courseId = pickId(parsed, 'course_id', 'courseId');
      const modules = parsed.modules;
      if (!courseId || !Array.isArray(modules)) {
        sendApiError(res, 400, 'validation_failed', 'courseId and modules are required', {
          meta: { requestId: req.requestId ?? null },
        });
        return;
      }
      await Promise.all((modules || []).map((m) => supabase.from('modules').update({ order_index: pickOrder(m) }).eq('id', m.id)));
      const order = modules.map((m) => ({ id: m.id, order_index: pickOrder(m) }));
      sendApiResponse(res, order, {
        code: 'modules_reordered',
        message: 'Modules reordered.',
        meta: { requestId: req.requestId ?? null, courseId },
      });
    } catch (_error) {
      sendApiError(res, 500, 'module_reorder_failed', 'Unable to reorder modules', {
        meta: { requestId: req.requestId ?? null },
      });
    }
  },

  createLesson: async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const lessonLogMeta = buildLessonLogMeta(req, context);
    const parseResult = lessonCreateSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 400, 'validation_failed', 'Lesson payload validation failed', parseResult.error.issues);
      return;
    }
    const parsed = parseResult.data;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessonId = parsed.id ?? randomUUID();
    lessonLogMeta.lessonId = lessonId;
    lessonLogMeta.moduleId = moduleId ?? null;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type ?? null;
    if (type) lessonLogMeta.lessonType = type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    if (orderIndex !== null) lessonLogMeta.orderIndex = orderIndex;
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const normalizedContent =
      (parsed.content_json && Object.keys(parsed.content_json).length > 0 ? parsed.content_json : null) ??
      (parsed.content && typeof parsed.content === 'object' ? parsed.content.body ?? parsed.content : null) ??
      {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;

    if (isDemoOrTestMode) {
      try {
        const found = e2eFindModule(moduleId);
        if (!found) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 404, 'module_not_found', 'Module not found');
          return;
        }
        const resolvedOrgId = pickOrgId(found.course?.organization_id, found.course?.org_id, found.course?.organizationId);
        lessonLogMeta.orgId = resolvedOrgId ?? null;
        if (!resolvedOrgId && !context.isPlatformAdmin) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 403, 'organization_required', 'Lesson creation requires an organization scope');
          return;
        }
        if (typeof expectedCourseVersion === 'number') {
          const current = found.course?.version ?? 1;
          if (expectedCourseVersion < current) {
            respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 409, 'version_conflict', `Course has newer version ${current}`);
            return;
          }
        }
        const id = lessonId.startsWith('e2e-') ? lessonId : `e2e-less-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const lesson = {
          id,
          module_id: moduleId,
          organization_id: resolvedOrgId ?? null,
          title,
          description,
          type,
          order_index: orderIndex,
          duration_s: durationSeconds,
          content_json: normalizedContent,
        };
        prepareLessonContentWithCompletionRule(lesson, completionRule);
        found.module.lessons = found.module.lessons || [];
        found.module.lessons.push(lesson);
        persistE2EStore();
        sendApiResponse(res, lesson, {
          statusCode: 201,
          code: 'lesson_created',
          message: 'Lesson created.',
          meta: { requestId: req.requestId ?? null, moduleId, lessonId: id },
        });
        return;
      } catch (error) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 500, 'lesson_create_failed', 'Unable to create lesson', error instanceof Error ? error.message : null);
        return;
      }
    }

    if (!ensureSupabase(res)) return;
    try {
      const { data: moduleRow, error: moduleErr } = await supabase.from('modules').select('id,course_id,organization_id,org_id').eq('id', moduleId).maybeSingle();
      if (moduleErr) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 500, 'module_lookup_failed', 'Unable to load module', moduleErr.message);
        return;
      }
      if (!moduleRow) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 404, 'module_not_found', 'Module not found');
        return;
      }
      const courseId = moduleRow.course_id ?? null;
      if (!courseId) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 400, 'module_course_missing', 'Module is not linked to a course');
        return;
      }
      const { data: courseRow, error: courseErr } = await supabase.from('courses').select('id,version,organization_id,org_id').eq('id', courseId).maybeSingle();
      if (courseErr) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 500, 'course_lookup_failed', 'Unable to load parent course', courseErr.message);
        return;
      }
      if (!courseRow) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 404, 'course_not_found', 'Parent course not found');
        return;
      }
      const resolvedOrgId = pickOrgId(moduleRow.organization_id, courseRow.organization_id, moduleRow.org_id, courseRow.org_id);
      lessonLogMeta.orgId = resolvedOrgId ?? null;
      if (resolvedOrgId) {
        const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
      } else if (!context.isPlatformAdmin) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 403, 'organization_required', 'Lesson creation requires an organization scope');
        return;
      }
      if (typeof expectedCourseVersion === 'number') {
        const currentVersion = courseRow.version ?? null;
        if (currentVersion !== null && expectedCourseVersion < currentVersion) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 409, 'version_conflict', `Course has newer version ${currentVersion}`);
          return;
        }
      }
      logLessonEvent(logger, 'info', 'admin_lessons_create_request', lessonLogMeta);
      const payload = prepareLessonPersistencePayload({
        id: lessonId,
        module_id: moduleId,
        organization_id: resolvedOrgId ?? null,
        title,
        type,
        description,
        order_index: orderIndex,
        duration_s: durationSeconds,
        content_json: normalizedContent,
        completionRule,
      });
      const result = await supabase.from('lessons').insert(payload).select('*');
      const data = firstRow(result);
      const error = result.error;
      if (error) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 500, 'lesson_create_failed', 'Unable to create lesson', error.message);
        return;
      }
      lessonLogMeta.lessonId = data.id;
      sendApiResponse(res, data, {
        statusCode: 201,
        code: 'lesson_created',
        message: 'Lesson created.',
        meta: { requestId: req.requestId ?? null, moduleId, lessonId: data.id },
      });
      logLessonEvent(logger, 'info', 'admin_lessons_create_success', { ...lessonLogMeta, status: 201 });
    } catch (error) {
      respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_create_error', 500, 'lesson_create_failed', 'Unable to create lesson', error instanceof Error ? error.message : null);
    }
  },

  updateLesson: async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const lessonLogMeta = buildLessonLogMeta(req, context);
    const parseResult = lessonPatchValidator.safeParse(req.body || {});
    if (!parseResult.success) {
      respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 400, 'validation_failed', 'Lesson payload validation failed', parseResult.error.issues);
      return;
    }
    const parsed = parseResult.data;
    const { id } = req.params;
    lessonLogMeta.lessonId = id;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    if (type) lessonLogMeta.lessonType = type;
    const description = parsed.description ?? null;
    const orderIndex = parsed.order_index ?? parsed.orderIndex ?? null;
    if (orderIndex !== null) lessonLogMeta.orderIndex = orderIndex;
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const contentPayload =
      (parsed.content_json && Object.keys(parsed.content_json).length > 0 ? parsed.content_json : null) ??
      (parsed.content && typeof parsed.content === 'object' ? parsed.content.body ?? parsed.content : null);
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;

    if (isDemoOrTestMode) {
      try {
        const found = e2eFindLesson(id);
        if (!found) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 404, 'lesson_not_found', 'Lesson not found');
          return;
        }
        const resolvedOrgId = pickOrgId(found.course?.organization_id, found.course?.org_id, found.course?.organizationId, found.module?.organization_id, found.module?.org_id);
        lessonLogMeta.orgId = resolvedOrgId ?? null;
        lessonLogMeta.moduleId = found.module?.id ?? null;
        if (!resolvedOrgId && !context.isPlatformAdmin) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 403, 'organization_required', 'Lesson updates require an organization scope');
          return;
        }
        if (typeof expectedCourseVersion === 'number') {
          const current = found.module?.version ?? 1;
          if (expectedCourseVersion < current) {
            respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 409, 'version_conflict', `Module has newer version ${current}`);
            return;
          }
        }
        if (typeof title === 'string') found.lesson.title = title;
        if (typeof type === 'string') found.lesson.type = type;
        if (description !== undefined) found.lesson.description = description;
        if (typeof orderIndex === 'number') found.lesson.order_index = orderIndex;
        if (typeof durationSeconds === 'number' || durationSeconds === null) found.lesson.duration_s = durationSeconds;
        if (contentPayload !== undefined) found.lesson.content_json = contentPayload ?? {};
        if (completionRule !== undefined) prepareLessonContentWithCompletionRule(found.lesson, completionRule);
        persistE2EStore();
        sendApiResponse(res, found.lesson, {
          code: 'lesson_updated',
          message: 'Lesson updated.',
          meta: { requestId: req.requestId ?? null, moduleId: found.module?.id ?? null, lessonId: found.lesson.id },
        });
        return;
      } catch (error) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'lesson_update_failed', 'Unable to update lesson', error instanceof Error ? error.message : null);
        return;
      }
    }
    if (!ensureSupabase(res)) return;
    try {
      const patch = {};
      if (typeof title === 'string') patch.title = title;
      if (typeof type === 'string') patch.type = type;
      if (description !== undefined) patch.description = description;
      if (typeof orderIndex === 'number') patch.order_index = orderIndex;
      if (typeof durationSeconds === 'number' || durationSeconds === null) patch.duration_s = durationSeconds;
      if (contentPayload !== undefined) patch.content_json = contentPayload ?? {};
      prepareLessonContentWithCompletionRule(patch, completionRule);
      applyLessonColumnSupport(patch);
      if (Object.keys(patch).length === 0) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 400, 'no_fields_to_update', 'No fields to update');
        return;
      }
      const { data: lessonRow, error: lessonErr } = await supabase.from('lessons').select('id,module_id,type,order_index,organization_id').eq('id', id).maybeSingle();
      if (lessonErr) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'lesson_lookup_failed', 'Unable to load lesson', lessonErr.message);
        return;
      }
      if (!lessonRow) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 404, 'lesson_not_found', 'Lesson not found');
        return;
      }
      lessonLogMeta.moduleId = lessonRow.module_id ?? null;
      if (!lessonLogMeta.lessonType) lessonLogMeta.lessonType = lessonRow.type ?? null;
      if (!lessonLogMeta.orderIndex) lessonLogMeta.orderIndex = lessonRow.order_index ?? null;
      const { data: moduleRow, error: moduleErr } = await supabase.from('modules').select('id,course_id,organization_id,org_id').eq('id', lessonRow.module_id).maybeSingle();
      if (moduleErr) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'module_lookup_failed', 'Unable to load module', moduleErr.message);
        return;
      }
      if (!moduleRow) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 404, 'module_not_found', 'Module not found');
        return;
      }
      const { data: courseRow, error: courseErr } = await supabase.from('courses').select('id,version,organization_id,org_id').eq('id', moduleRow.course_id).maybeSingle();
      if (courseErr) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'course_lookup_failed', 'Unable to load parent course', courseErr.message);
        return;
      }
      if (!courseRow) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 404, 'course_not_found', 'Parent course not found');
        return;
      }
      const resolvedOrgId = pickOrgId(lessonRow.organization_id, moduleRow.organization_id, courseRow.organization_id, moduleRow.org_id, courseRow.org_id);
      lessonLogMeta.orgId = resolvedOrgId ?? null;
      if (resolvedOrgId) {
        const access = await requireOrgAccess(req, res, resolvedOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
      } else if (!context.isPlatformAdmin) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 403, 'organization_required', 'Lesson updates require an organization scope');
        return;
      }
      logLessonEvent(logger, 'info', 'admin_lessons_update_request', lessonLogMeta);
      if (typeof expectedCourseVersion === 'number') {
        const current = courseRow.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 409, 'version_conflict', `Course has newer version ${current}`);
          return;
        }
      }
      const { data, error } = await supabase.from('lessons').update(patch).eq('id', id).select('*').maybeSingle();
      if (error) {
        respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'lesson_update_failed', 'Unable to update lesson', error.message);
        return;
      }
      sendApiResponse(res, { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 }, {
        code: 'lesson_updated',
        message: 'Lesson updated.',
        meta: { requestId: req.requestId ?? null, moduleId: data.module_id, lessonId: data.id },
      });
      logLessonEvent(logger, 'info', 'admin_lessons_update_success', { ...lessonLogMeta, status: 200 });
    } catch (error) {
      respondLessonError(logger, res, lessonLogMeta, 'admin_lessons_update_error', 500, 'lesson_update_failed', 'Unable to update lesson', error instanceof Error ? error.message : null);
    }
  },

  deleteLesson: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const { id } = req.params;
      for (const course of e2eStore.courses.values()) {
        for (const mod of course.modules || []) {
          const before = (mod.lessons || []).length;
          mod.lessons = (mod.lessons || []).filter((l) => String(l.id) !== String(id));
          if (mod.lessons.length !== before) {
            persistE2EStore();
            res.status(204).end();
            return;
          }
        }
      }
      res.status(204).end();
      return;
    }
    if (!ensureSupabase(res)) return;
    const context = requireUserContext(req, res);
    if (!context) return;
    try {
      const { id } = req.params;
      const { data: lessonRow, error: lessonErr } = await supabase.from('lessons').select('id, module_id').eq('id', id).maybeSingle();
      if (lessonErr) throw lessonErr;
      if (!lessonRow) {
        res.status(204).end();
        return;
      }
      if (lessonRow.module_id) {
        const { data: moduleRow, error: moduleErr } = await supabase.from('modules').select('id, course_id').eq('id', lessonRow.module_id).maybeSingle();
        if (moduleErr) throw moduleErr;
        if (moduleRow?.course_id) {
          const { data: courseRow, error: courseErr } = await supabase.from('courses').select('id, organization_id').eq('id', moduleRow.course_id).maybeSingle();
          if (courseErr) throw courseErr;
          const lessonOrgId = courseRow?.organization_id ?? null;
          if (lessonOrgId) {
            const access = await requireOrgAccess(req, res, lessonOrgId, { write: true, requireOrgAdmin: true });
            if (!access) return;
          } else if (!context.isPlatformAdmin) {
            res.status(403).json({ error: 'organization_required', message: 'Lesson course is not scoped to an organization.' });
            return;
          }
        } else if (!context.isPlatformAdmin) {
          res.status(403).json({ error: 'organization_required', message: 'Lesson module is not scoped to a course.' });
          return;
        }
      } else if (!context.isPlatformAdmin) {
        res.status(403).json({ error: 'organization_required', message: 'Lesson is not scoped to a module.' });
        return;
      }
      await supabase.from('lessons').delete().eq('id', id);
      res.status(204).end();
    } catch (_error) {
      res.status(500).json({ error: 'Unable to delete lesson' });
    }
  },

  reorderLessons: async ({ req, res }) => {
    if (isDemoOrTestMode) {
      const parsed = validateOr400(lessonReorderSchema, req, res);
      if (!parsed) return;
      const moduleId = pickId(parsed, 'module_id', 'moduleId');
      const lessons = parsed.lessons;
      const found = e2eFindModule(moduleId);
      if (!found) {
        sendApiError(res, 404, 'module_not_found', 'Module not found', {
          meta: { requestId: req.requestId ?? null, moduleId },
        });
        return;
      }
      const orderMap = new Map((lessons || []).map((l) => [String(l.id), pickOrder(l)]));
      (found.module.lessons || []).forEach((l) => {
        const idx = orderMap.get(String(l.id));
        if (typeof idx === 'number') l.order_index = idx;
      });
      found.module.lessons = (found.module.lessons || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      persistE2EStore();
      const response = (found.module.lessons || []).map((l) => ({ id: l.id, order_index: l.order_index ?? 0 }));
      sendApiResponse(res, response, {
        code: 'lessons_reordered',
        message: 'Lessons reordered.',
        meta: { requestId: req.requestId ?? null, moduleId },
      });
      return;
    }
    if (!ensureSupabase(res)) return;
    try {
      const parsed = validateOr400(lessonReorderSchema, req, res);
      if (!parsed) return;
      const moduleId = pickId(parsed, 'module_id', 'moduleId');
      const lessons = parsed.lessons;
      if (!moduleId || !Array.isArray(lessons)) {
        sendApiError(res, 400, 'validation_failed', 'moduleId and lessons are required', {
          meta: { requestId: req.requestId ?? null },
        });
        return;
      }
      await Promise.all((lessons || []).map((l) => supabase.from('lessons').update({ order_index: pickOrder(l) }).eq('id', l.id)));
      const order = lessons.map((l) => ({ id: l.id, order_index: pickOrder(l) }));
      sendApiResponse(res, order, {
        code: 'lessons_reordered',
        message: 'Lessons reordered.',
        meta: { requestId: req.requestId ?? null, moduleId },
      });
    } catch (_error) {
      sendApiError(res, 500, 'lesson_reorder_failed', 'Unable to reorder lessons', {
        meta: { requestId: req.requestId ?? null },
      });
    }
  },
});

export default createCourseStructureService;
