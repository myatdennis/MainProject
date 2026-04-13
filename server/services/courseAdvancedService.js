export const createCourseAdvancedService = ({
  normalizeLegacyOrgInput,
  normalizeImportEntries,
  normalizeOrgIdValue,
  pickOrgId,
  requireUserContext,
  requireOrgAccess,
  validateCoursePayload,
  normalizeModuleForImport,
  normalizeLessonOrder,
  slugify,
  shapeCourseForValidation,
  validatePublishableCourse,
  e2eStore,
  persistE2EStore,
  logAdminCoursesError,
  ensureSupabase,
  ensureTablesReady,
  respondSchemaUnavailable,
  sql,
  upsertCourseGraphWithTx,
  isUuid,
  firstRow,
  prepareLessonPersistencePayload,
  extractCompletionRule,
  assignPublishedOrganizationCoursesToActiveMembers,
  assignPublishedOrganizationCoursesToUser,
  logCourseImportEvent,
  respondImportError,
  sendApiResponse,
  sendApiError,
  resolveCourseIdentifierToUuid,
  parsePublishRequestBody,
  logCourseRequestEvent,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  getOrganizationMembershipsOrgColumnName,
  getOrganizationMembershipsStatusColumnName,
  isIdempotencyTableMissingError,
  isInfrastructureUnavailableError,
  getInMemoryIdempotencyKey,
  setInMemoryIdempotencyKey,
  loadCourseGraphWithTx,
  backfillPublishedCourseAssignmentsWithTx,
  broadcastToTopic,
  courseWithModulesLessonsSelect,
  supabase,
  logger,
  isDemoOrTestMode,
  prepareLessonContentWithCompletionRule,
  randomUUID,
}) => {
  const COURSE_IMPORT_TABLES = [
    { table: 'courses', columns: ['id', 'slug', 'organization_id'] },
    { table: 'modules', columns: ['id', 'course_id'] },
    { table: 'lessons', columns: ['id', 'module_id'] },
  ];

  const parseBooleanFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
    }
    return false;
  };

  const canonicalizeStatus = (value, fallback = 'draft') => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'published' || normalized === 'draft' || normalized === 'archived') {
      return normalized;
    }
    return fallback;
  };

  return {
    importCourses: async ({ req, res }) => {
    normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.import', requestId: req.requestId });
    const { entries: rawItems, sourceLabel } = normalizeImportEntries(req.body);
    if (rawItems.length === 0) {
      respondImportError({
        res,
        status: 400,
        code: 'items_required',
        message: 'Provide an "items" or "courses" array with course data.',
        requestId: req.requestId ?? null,
      });
      return;
    }

    const context = requireUserContext(req, res);
    if (!context) return;

    const normalizedRequestOrgId = normalizeOrgIdValue(req.organizationId ?? null);
    const contextActiveOrgId = normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId ?? null);
    const membershipOrgIds = Array.isArray(context.memberships)
      ? context.memberships
          .map((membership) =>
            normalizeOrgIdValue(
              pickOrgId(
                membership.organization_id,
                membership.organizationId,
                membership.org_id,
                membership.orgId,
              ),
            ),
          )
          .filter(Boolean)
      : [];
    const userScopedOrgIds = Array.isArray(context.organizationIds)
      ? context.organizationIds.map((orgId) => normalizeOrgIdValue(orgId)).filter(Boolean)
      : [];
    const availableOrgIds = Array.from(
      new Set([normalizedRequestOrgId, contextActiveOrgId, ...membershipOrgIds, ...userScopedOrgIds].filter(Boolean)),
    );

    let resolvedOrganizationId =
      normalizedRequestOrgId ||
      contextActiveOrgId ||
      (availableOrgIds.length === 1 ? availableOrgIds[0] : null);

    if (!resolvedOrganizationId && availableOrgIds.length > 1) {
      respondImportError({
        res,
        status: 400,
        code: 'explicit_org_selection_required',
        message: 'This import is ambiguous across multiple organizations. Pass an organizationId explicitly.',
        requestId: req.requestId ?? null,
        details: { availableOrgIds },
      });
      return;
    }
    if (!resolvedOrganizationId) {
      respondImportError({
        res,
        status: 400,
        code: 'org_required',
        message: 'Active organization required for import.',
        requestId: req.requestId ?? null,
      });
      return;
    }

    logCourseImportEvent('import_received', {
      requestId: req.requestId ?? null,
      userId: context.userId ?? null,
      orgId: resolvedOrganizationId,
      entryCount: rawItems.length,
    });
    const access = await requireOrgAccess(req, res, resolvedOrganizationId, { write: true, requireOrgAdmin: true });
    if (!access) return;
    logCourseImportEvent('import_org_resolved', {
      requestId: req.requestId ?? null,
      userId: context.userId ?? null,
      orgId: resolvedOrganizationId,
    });

    const globalOverwriteFlag = parseBooleanFlag(req.body?.overwrite);
    const publishModeInput =
      typeof req.body?.publishMode === 'string'
        ? req.body.publishMode.trim().toLowerCase()
        : null;
    const publishFlag = parseBooleanFlag(req.body?.publish ?? req.body?.publishCourses);
    const publishRequested = publishFlag || publishModeInput === 'published';

    const validationIssues = [];
    const normalizedItems = rawItems.map((rawEntry) => {
      const normalizedModules = Array.isArray(rawEntry?.modules)
        ? rawEntry.modules.map((module, moduleIndex) => {
            const normalizedModule = normalizeModuleForImport(module, { moduleIndex });
            (normalizedModule.lessons || []).forEach((lesson, lessonIndex) => {
              const derivedQuestionsCount = Array.isArray(lesson.content?.questions)
                ? lesson.content.questions.length
                : 0;
              const derivedBranchCount = Array.isArray(lesson.content?.branchingElements)
                ? lesson.content.branchingElements.length
                : 0;
              logCourseImportEvent('lesson_normalization', {
                requestId: req.requestId ?? null,
                moduleIndex,
                lessonIndex,
                lessonType: lesson.type ?? null,
                derivedQuestionsCount,
                derivedBranchCount,
              });
            });
            return normalizedModule;
          })
        : [];
      normalizeLessonOrder(normalizedModules);
      const rawCourse = rawEntry?.course ?? rawEntry ?? {};
      const payload = {
        course: {
          ...rawCourse,
          slug:
            (typeof rawCourse.slug === 'string' && rawCourse.slug.trim()) ||
            (typeof rawEntry?.slug === 'string' && rawEntry.slug.trim()) ||
            undefined,
          title:
            (typeof rawCourse.title === 'string' && rawCourse.title.trim()) ||
            (typeof rawEntry?.title === 'string' && rawEntry.title.trim()) ||
            undefined,
        },
        modules: normalizedModules,
      };
      const validation = validateCoursePayload(payload, {
        enforceLessonContent: publishRequested,
      });
      if (!validation.ok) {
        const issues = validation.issues.map((issue) => ({
          courseIndex: rawEntry.index,
          field: `${sourceLabel}[${rawEntry.index}].${issue.path || ''}`.replace(/\.$/, ''),
          message: issue.message,
          code: issue.code || 'invalid',
          receivedValueType: issue?.receivedValueType ?? typeof issue?.receivedValue ?? undefined,
        }));
        validationIssues.push({ index: rawEntry.index, issues });
        return null;
      }
      return {
        index: rawEntry.index,
        course: validation.data.course,
        modules: validation.data.modules,
        overwrite: parseBooleanFlag(rawEntry?.overwrite) || globalOverwriteFlag,
      };
    });

    logCourseImportEvent('import_normalized', {
      requestId: req.requestId ?? null,
      orgId: resolvedOrganizationId,
      entryCount: rawItems.length,
      normalizedCount: normalizedItems.length,
      invalidCount: validationIssues.length,
    });

    const preparedEntries = normalizedItems.filter(Boolean);
    logCourseImportEvent('import_normalized_entries', {
      requestId: req.requestId ?? null,
      orgId: resolvedOrganizationId,
      entryCount: rawItems.length,
      normalizedCount: preparedEntries.length,
      entries: preparedEntries.map((entry) => ({
        index: entry.index,
        slug: entry.course?.slug ?? null,
        title: entry.course?.title ?? null,
        moduleCount: Array.isArray(entry.modules) ? entry.modules.length : 0,
      })),
    });

    if (validationIssues.length > 0) {
      const details = validationIssues.flatMap((issueGroup) => issueGroup.issues);
      logCourseImportEvent('import_validation_failed', {
        requestId: req.requestId ?? null,
        orgId: resolvedOrganizationId,
        entryCount: rawItems.length,
        details,
      });
      respondImportError({
        res,
        status: 422,
        code: 'validation_failed',
        message: 'One or more courses failed validation.',
        requestId: req.requestId ?? null,
        details,
      });
      return;
    }

    const batchSlugCounts = new Map();
    for (const entry of preparedEntries) {
      const slugSource =
        entry?.course?.slug ||
        entry?.course?.title ||
        entry?.course?.id ||
        `course-${entry?.index ?? 'import'}`;
      const normalizedSlug = slugify(slugSource);
      if (!normalizedSlug) continue;
      batchSlugCounts.set(normalizedSlug, (batchSlugCounts.get(normalizedSlug) || 0) + 1);
    }
    const duplicateBatchSlug = Array.from(batchSlugCounts.entries()).find(([, count]) => count > 1)?.[0] ?? null;
    if (duplicateBatchSlug) {
      respondImportError({
        res,
        status: 409,
        code: 'slug_conflict',
        message: 'Import batch contains duplicate course slugs. Each imported course must have a unique slug.',
        requestId: req.requestId ?? null,
        details: { slug: duplicateBatchSlug },
      });
      return;
    }

    logCourseImportEvent('import_validated', {
      requestId: req.requestId ?? null,
      orgId: resolvedOrganizationId,
      entryCount: preparedEntries.length,
    });

    if (isDemoOrTestMode) {
      const snapshot = new Map(e2eStore.courses);
      const results = [];
      try {
        for (const payload of preparedEntries) {
          const { course, modules = [], index: courseIndex } = payload || {};
          if (!course?.title) throw new Error('Course title is required');

          const resolvedOrgId = resolvedOrganizationId;
          if (String(course.status || '').toLowerCase() === 'published') {
            const shaped = shapeCourseForValidation({ ...course, modules });
            const validation = validatePublishableCourse(shaped, { intent: 'publish' });
            if (!validation.isValid) {
              const publishDetails = validation.issues.map((issue) => ({
                courseIndex,
                field: issue.path || issue.field || null,
                message: issue.message,
                code: issue.code || 'invalid',
                receivedValueType: issue.receivedValueType ?? null,
              }));
              respondImportError({
                res,
                status: 422,
                code: 'validation_failed',
                message: 'Publish validation failed.',
                requestId: req.requestId ?? null,
                details: publishDetails,
              });
              return;
            }
          }

          let existingId = null;
          const incomingSlug = course.slug ?? null;
          const incomingExternalId = (course.external_id ?? course.meta?.external_id ?? null) || null;
          if (!course.id) {
            for (const existingCourse of e2eStore.courses.values()) {
              const existingSlug = existingCourse.slug ?? existingCourse.id;
              const existingExternal = existingCourse.meta_json?.external_id ?? null;
              if (incomingSlug && String(existingSlug).toLowerCase() === String(incomingSlug).toLowerCase()) {
                existingId = existingCourse.id;
                break;
              }
              if (incomingExternalId && existingExternal && String(existingExternal) === String(incomingExternalId)) {
                existingId = existingCourse.id;
                break;
              }
            }
          }
          if (existingId && !payload?.overwrite) {
            const error = new Error(
              'A course with this slug already exists in the selected organization. Choose a different slug or set "overwrite": true to replace it.',
            );
            error.code = 'slug_conflict';
            error.status = 409;
            throw error;
          }
          const id = course.id ?? existingId ?? `e2e-course-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const courseObj = {
            id,
            slug: course.slug ?? id,
            title: course.title,
            description: course.description ?? null,
            status: course.status ?? 'draft',
            version: course.version ?? 1,
            meta_json: { ...(course.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
            published_at: null,
            organization_id: resolvedOrgId,
            modules: [],
          };
          const modulesArr = modules || [];
          for (const [moduleIndex, module] of modulesArr.entries()) {
            const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}-${Math.floor(Math.random() * 1000)}`;
            const moduleObj = {
              id: moduleId,
              course_id: id,
              organization_id: resolvedOrgId,
              title: module.title,
              description: module.description ?? null,
              order_index: module.order_index ?? moduleIndex,
              lessons: [],
            };
            const lessons = module.lessons || [];
            for (const [lessonIndex, lesson] of lessons.entries()) {
              const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}-${Math.floor(Math.random() * 1000)}`;
              const completionRule = extractCompletionRule(lesson);
              const lessonObj = {
                id: lessonId,
                module_id: moduleId,
                title: lesson.title,
                description: lesson.description ?? null,
                type: lesson.type,
                order_index: lesson.order_index ?? lesson.order ?? lessonIndex,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? lesson.content ?? {},
              };
              prepareLessonContentWithCompletionRule(lessonObj, completionRule);
              moduleObj.lessons.push(lessonObj);
            }
            courseObj.modules.push(moduleObj);
          }
          e2eStore.courses.set(id, courseObj);
          results.push({ id, slug: courseObj.slug, title: courseObj.title });
        }
        persistE2EStore();
        sendApiResponse(res, results, {
          statusCode: 201,
          code: 'courses_imported',
          message: 'Courses imported successfully.',
          meta: { requestId: req.requestId ?? null, mode: 'demo' },
        });
      } catch (error) {
        e2eStore.courses = snapshot;
        persistE2EStore();
        logAdminCoursesError(req, error, 'E2E import failed', {
          userId: context?.userId ?? null,
        });
        respondImportError({
          res,
          status: Number.isInteger(error?.status) ? error.status : 400,
          code: error?.code ?? 'import_failed',
          message: error?.message ?? 'Import failed',
          requestId: req.requestId ?? null,
          details: String(error?.message || error),
        });
      }
      return;
    }

    if (!ensureSupabase(res)) return;
    const schemaStatus = await ensureTablesReady('admin.courses.import', COURSE_IMPORT_TABLES);
    if (!schemaStatus.ok) {
      respondSchemaUnavailable(res, 'admin.courses.import', schemaStatus);
      return;
    }

    try {
      const results = await sql.begin(async (tx) => {
        const persistedResults = [];
        for (const entry of preparedEntries) {
          const { course, modules, index: courseIndex } = entry;
          const resolvedOrgId = resolvedOrganizationId;
          const userProvidedStatus = typeof course.status === 'string' && course.status.trim().length > 0;
          let normalizedStatus = canonicalizeStatus(course.status, publishRequested ? 'published' : 'draft');
          if (!userProvidedStatus && publishRequested) {
            normalizedStatus = 'published';
          }
          course.status = normalizedStatus;

          if (course.status === 'published') {
            const shaped = shapeCourseForValidation({ ...course, modules });
            const validation = validatePublishableCourse(shaped, { intent: 'publish' });
            if (!validation.isValid) {
              const publishDetails = validation.issues.map((issue) => ({
                courseIndex,
                field: issue.path || issue.field || null,
                message: issue.message,
                code: issue.code || 'invalid',
                receivedValueType: issue.receivedValueType ?? null,
              }));
              const error = new Error('Publish validation failed.');
              error.code = 'validation_failed';
              error.status = 422;
              error.details = publishDetails;
              throw error;
            }
          }

          course.organization_id = resolvedOrgId;
          const slugSource = course.slug || course.title || course.id || `course-${randomUUID().slice(0, 8)}`;
          let normalizedSlug = slugify(slugSource);
          if (!normalizedSlug && course.id) {
            normalizedSlug = slugify(String(course.id));
          }
          course.slug = normalizedSlug || `course-${randomUUID().slice(0, 8)}`;

          const existingCourseRows = await tx`
            select id, slug
            from public.courses
            where organization_id = ${resolvedOrgId}::uuid
              and slug = ${course.slug}
            limit 1
          `;
          const existingCourse = firstRow(existingCourseRows);
          if (existingCourse && !entry.overwrite) {
            const error = new Error(
              'A course with this slug already exists in the selected organization. Choose a different slug or set "overwrite": true to replace it.',
            );
            error.code = 'slug_conflict';
            error.status = 409;
            error.details = { slug: course.slug, courseIndex: entry.index };
            throw error;
          }
          if (existingCourse && entry.overwrite) {
            course.id = course.id ?? existingCourse.id;
          }

          logCourseImportEvent('import_slug_checked', {
            requestId: req.requestId ?? null,
            orgId: resolvedOrgId,
            slug: course.slug,
            courseIndex: entry.index,
            overwrite: entry.overwrite,
          });

          const modulesForRpc = modules.map((module, moduleIndex) => ({
            id: module.id ?? undefined,
            organization_id: resolvedOrgId,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? moduleIndex + 1,
            lessons: (module.lessons || []).map((lesson, lessonIndex) =>
              prepareLessonPersistencePayload({
                id: lesson.id ?? undefined,
                organization_id: resolvedOrgId,
                type: lesson.type,
                title: lesson.title,
                description: lesson.description ?? null,
                order_index: lesson.order_index ?? lessonIndex + 1,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? lesson.content ?? {},
                completionRule: extractCompletionRule(lesson),
              }),
            ),
          }));

          const rpcPayload = {
            id: course.id ?? undefined,
            slug: course.slug,
            title: course.title,
            description: course.description ?? null,
            status: course.status ?? 'draft',
            version: course.version ?? 1,
            meta_json: course.meta ?? {},
            modules: modulesForRpc,
          };

          logCourseImportEvent('import_persist_start', {
            requestId: req.requestId ?? null,
            orgId: resolvedOrgId,
            slug: course.slug,
            courseId: course.id ?? null,
            moduleCount: modulesForRpc.length,
            courseIndex: entry.index,
          });

          const savedCourse = await upsertCourseGraphWithTx(tx, {
            actorUserId: isUuid(String(context.userId || '').trim()) ? context.userId : null,
            organizationId: resolvedOrgId,
            coursePayload: rpcPayload,
          });
          if (!savedCourse) {
            const error = new Error('Course import persistence returned no record.');
            error.code = 'import_persist_failed';
            error.status = 500;
            throw error;
          }

          persistedResults.push({
            id: savedCourse?.id ?? course.id ?? null,
            slug: savedCourse?.slug ?? course.slug,
            title: savedCourse?.title ?? course.title,
            status: savedCourse?.status ?? course.status ?? 'draft',
            organization_id: savedCourse?.organization_id ?? resolvedOrgId,
            published_at: savedCourse?.published_at ?? null,
          });

          logCourseImportEvent('import_persist_success', {
            requestId: req.requestId ?? null,
            orgId: resolvedOrgId,
            slug: course.slug,
            courseId: savedCourse?.id ?? course.id ?? null,
            status: savedCourse?.status ?? course.status ?? null,
            organizationId: savedCourse?.organization_id ?? resolvedOrgId,
            courseIndex: entry.index,
          });
        }
        return persistedResults;
      });

      const hasPublishedImports = results.some((row) => String(row?.status || '').toLowerCase() === 'published');
      if (hasPublishedImports) {
        await assignPublishedOrganizationCoursesToActiveMembers({
          orgId: resolvedOrganizationId,
          actorUserId: context.userId ?? null,
        });
        logCourseImportEvent('import_assignment_backfill_complete', {
          requestId: req.requestId ?? null,
          orgId: resolvedOrganizationId,
        });
      }

      logCourseImportEvent('import_complete', {
        requestId: req.requestId ?? null,
        orgId: resolvedOrganizationId,
        imported: results.length,
      });
      sendApiResponse(res, results, {
        statusCode: 201,
        code: 'courses_imported',
        message: 'Courses imported successfully.',
        meta: {
          publishMode: publishRequested ? 'published' : 'draft',
          imported: results.length,
          requestId: req.requestId ?? null,
        },
      });
    } catch (error) {
      logCourseImportEvent('import_failed', {
        requestId: req.requestId ?? null,
        userId: context?.userId ?? null,
        orgId: resolvedOrganizationId,
        code: error?.code ?? null,
        message: error?.message ?? null,
        hint: error?.hint ?? null,
      });
      respondImportError({
        res,
        status: Number.isInteger(error?.status) ? error.status : 500,
        code: error?.code ?? 'import_failed',
        message: error?.status === 409 || error?.status === 422 ? (error?.message ?? 'Import failed') : 'Import failed',
        hint: error?.hint ?? null,
        requestId: req.requestId ?? null,
        details: error?.details ?? error?.message ?? null,
      });
    }
    },

    publishCourse: async ({ req, res }) => {
    if (!ensureSupabase(res)) return;
    const { id } = req.params;
    const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
    if (!resolvedCourseId) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'course_not_found';
      res.status(404).json({ error: 'course_not_found', message: `Course not found for identifier ${id}` });
      return;
    }

    const courseId = resolvedCourseId;
    const context = requireUserContext(req, res);
    if (!context) return;
    normalizeLegacyOrgInput(req.body, { surface: 'admin.courses.publish', requestId: req.requestId });

    let publishRequest;
    try {
      publishRequest = parsePublishRequestBody(req.body || {});
    } catch (parseError) {
      sendApiError(
        res,
        parseError?.status || 400,
        parseError?.code || 'invalid_publish_payload',
        parseError?.message || 'Invalid publish payload.',
        {
          issues: Array.isArray(parseError?.issues) ? parseError.issues : undefined,
          meta: { requestId: req.requestId ?? null, courseId },
        },
      );
      return;
    }

    const idempotencyKey = publishRequest.idempotencyKey ?? publishRequest.clientEventId ?? null;
    const incomingVersion = publishRequest.version;
    const publishLogMeta = {
      requestId: req.requestId ?? null,
      userId: context.userId ?? null,
      courseId,
      orgId: null,
    };
    const publishStartedAt = Date.now();

    console.info('[course.publish_attempt]', {
      requestId: publishLogMeta.requestId,
      userId: publishLogMeta.userId,
      courseId: publishLogMeta.courseId,
      incomingVersion,
      idempotencyKey: idempotencyKey ?? null,
    });
    logCourseRequestEvent('admin.courses.publish.start', publishLogMeta);
    res.once('finish', () => {
      logCourseRequestEvent('admin.courses.publish.finish', {
        ...publishLogMeta,
        orgId: publishLogMeta.orgId ?? null,
        status: res.statusCode ?? null,
        errorCode: res.locals?.errorCode ?? null,
      });
    });

    try {
      if (isDemoOrTestMode) {
        const existing = e2eStore.courses.get(courseId);
        if (!existing) {
          res.locals = res.locals || {};
          res.locals.errorCode = 'not_found';
          sendApiError(res, 404, 'not_found', 'Course not found', {
            meta: { requestId: req.requestId ?? null, courseId },
          });
          return;
        }
        publishLogMeta.orgId = existing.organization_id || existing.org_id || existing.organizationId || null;

        existing.status = 'published';
        const currentVersion = typeof existing.version === 'number' ? existing.version : 0;
        existing.version = currentVersion + 1;
        existing.published_at = new Date().toISOString();

        try {
          const orgId = existing.organization_id || existing.org_id || null;
          const payload = { type: 'course_updated', data: existing, timestamp: Date.now() };
          if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
          broadcastToTopic('course:updates', payload);
        } catch (error) {
          console.warn('Failed to broadcast course publish event', error);
        }

        console.info('[course.publish_success]', {
          requestId: publishLogMeta.requestId,
          userId: publishLogMeta.userId,
          orgId: publishLogMeta.orgId,
          courseId,
          mode: 'demo',
          durationMs: Date.now() - publishStartedAt,
        });
        sendApiResponse(res, existing, {
          statusCode: 200,
          code: 'course_published',
          message: 'Course published successfully.',
          meta: {
            requestId: req.requestId ?? null,
            courseId: existing.id ?? courseId,
            orgId: publishLogMeta.orgId ?? null,
            mode: 'demo',
          },
        });
        return;
      }

      const existingCourseRows = await sql`
        select id, organization_id, version
        from public.courses
        where id = ${courseId}::uuid
        limit 1
      `;
      let existingCourseRow = firstRow(existingCourseRows);
      let publishViaSupabaseFallback = false;
      if (!existingCourseRow) {
        const { data: supabaseCourseRow, error: supabaseCourseRowError } = await supabase
          .from('courses')
          .select('id, organization_id, version')
          .eq('id', courseId)
          .maybeSingle();
        if (supabaseCourseRowError) throw supabaseCourseRowError;
        if (supabaseCourseRow) {
          existingCourseRow = supabaseCourseRow;
          publishViaSupabaseFallback = true;
          console.warn('[course.publish] SQL lookup missed course; using Supabase fallback path', {
            requestId: req.requestId ?? null,
            courseId,
          });
        }
      }
      if (!existingCourseRow) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'not_found';
        sendApiError(res, 404, 'not_found', 'Course not found', {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }

      const courseOrgId = existingCourseRow.organization_id || null;
      publishLogMeta.orgId = courseOrgId;
      if (courseOrgId) {
        const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return;
      } else if (!context.isPlatformAdmin) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'org_required';
        sendApiError(res, 403, 'org_required', 'Organization membership required to publish', {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }

      const currentVersion = typeof existingCourseRow.version === 'number' ? existingCourseRow.version : null;
      console.info('[course.publish_version_check]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId,
        incomingVersion,
        persistedVersion: currentVersion,
        source: publishViaSupabaseFallback ? 'supabase_fallback' : 'sql',
      });
      if (incomingVersion !== null && currentVersion !== null && incomingVersion !== currentVersion) {
        res.locals = res.locals || {};
        res.locals.errorCode = 'version_conflict';
        sendApiError(res, 409, 'version_conflict', `Course has newer version ${currentVersion}`, {
          reason: 'stale_version',
          message: `Course has newer version ${currentVersion}`,
          currentVersion,
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }

      let idempotencyTableMissing = false;
      const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
      const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

      if (idempotencyKey) {
        const existingFallback = getInMemoryIdempotencyKey(idempotencyKey);
        if (existingFallback) {
          if (existingFallback.status === 'done' && existingFallback.data) {
            return sendApiResponse(res, existingFallback.data, {
              statusCode: 200,
              code: 'course_publish_idempotent',
              message: 'Course already published for this idempotency key.',
              meta: { idempotent: true, key: idempotencyKey, requestId: req.requestId ?? null },
            });
          }
          if (existingFallback.status === 'in_flight') {
            return sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
              reason: 'idempotency_in_flight',
              meta: { requestId: req.requestId ?? null, courseId },
            });
          }
        }

        const { error: insertError } = await supabase.from('idempotency_keys').insert({
          id: idempotencyKey,
          key_type: 'course_publish',
          resource_id: null,
          payload: { course_id: courseId, version: currentVersion },
        });

        if (insertError) {
          if (isIdempotencyTableMissingError(insertError) || isInfrastructureUnavailableError(insertError)) {
            idempotencyTableMissing = true;
            setInMemoryIdempotencyKey(idempotencyKey, {
              status: 'in_flight',
              createdAt: new Date().toISOString(),
              payload: { course_id: courseId, version: currentVersion },
            });
          } else {
            const isDuplicate = insertError?.code === '23505' || String(insertError?.message || '').toLowerCase().includes('duplicate');
            if (!isDuplicate) {
              sendApiError(res, 500, 'idempotency_insert_failed', 'Unable to register publish idempotency key.', {
                meta: { requestId: req.requestId ?? null, courseId },
              });
              return;
            }

            const { data: existingKey, error: existingKeyError } = await supabase
              .from('idempotency_keys')
              .select('*')
              .eq('id', idempotencyKey)
              .maybeSingle();
            if (existingKeyError || !existingKey) {
              sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
                reason: 'idempotency_in_flight',
                meta: { requestId: req.requestId ?? null, courseId },
              });
              return;
            }
            if (existingKey.resource_id) {
              const { data: publishedCourse, error: publishedCourseError } = await supabase
                .from('courses')
                .select(courseWithModulesLessonsSelect)
                .eq('id', existingKey.resource_id)
                .maybeSingle();
              if (!publishedCourseError && publishedCourse) {
                return sendApiResponse(res, publishedCourse, {
                  statusCode: 200,
                  code: 'course_publish_idempotent',
                  message: 'Course already published for this idempotency key.',
                  meta: { idempotent: true, key: idempotencyKey, requestId: req.requestId ?? null },
                });
              }
            }
            return sendApiError(res, 409, 'idempotency_conflict', 'Another publish request is already in flight.', {
              reason: 'idempotency_in_flight',
              meta: { requestId: req.requestId ?? null, courseId },
            });
          }
        }
      }

      const publishCourseViaSupabaseFallback = async () => {
        const { data: lockedCourse, error: lockedCourseError } = await supabase
          .from('courses')
          .select(courseWithModulesLessonsSelect)
          .eq('id', courseId)
          .maybeSingle();
        if (lockedCourseError) throw lockedCourseError;
        if (!lockedCourse) {
          const error = new Error('Course not found');
          error.code = 'not_found';
          error.status = 404;
          throw error;
        }

        const lockedVersion = typeof lockedCourse.version === 'number' ? lockedCourse.version : null;
        if (incomingVersion !== null && lockedVersion !== null && incomingVersion !== lockedVersion) {
          const error = new Error(`Course has newer version ${lockedVersion}`);
          error.code = 'version_conflict';
          error.status = 409;
          error.currentVersion = lockedVersion;
          throw error;
        }

        const validation = validatePublishableCourse(shapeCourseForValidation(lockedCourse), { intent: 'publish' });
        console.info('[course.publish_validation_result]', {
          requestId: publishLogMeta.requestId,
          userId: publishLogMeta.userId,
          orgId: publishLogMeta.orgId,
          courseId,
          valid: validation.isValid,
          issuesCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
          source: 'supabase_fallback',
        });
        if (!validation.isValid) {
          const error = new Error('Course is not publishable.');
          error.code = 'validation_failed';
          error.status = 422;
          error.issues = validation.issues;
          throw error;
        }

        const publishedAt = new Date().toISOString();
        const nextVersion = (lockedVersion ?? 0) + 1;
        const nextMeta = { ...(lockedCourse.meta_json || {}), published_at: publishedAt };

        let updateQuery = supabase
          .from('courses')
          .update({
            status: 'published',
            published_at: publishedAt,
            version: nextVersion,
            meta_json: nextMeta,
            updated_by: context.userId && isUuid(String(context.userId)) ? context.userId : null,
          })
          .eq('id', courseId)
          .select('id')
          .maybeSingle();

        if (lockedVersion !== null) {
          updateQuery = supabase
            .from('courses')
            .update({
              status: 'published',
              published_at: publishedAt,
              version: nextVersion,
              meta_json: nextMeta,
              updated_by: context.userId && isUuid(String(context.userId)) ? context.userId : null,
            })
            .eq('id', courseId)
            .eq('version', lockedVersion)
            .select('id')
            .maybeSingle();
        }

        const { data: updatedRow, error: updateError } = await updateQuery;
        if (updateError) throw updateError;
        if (!updatedRow?.id) {
          const error = new Error('Course publish failed because the course changed before publish completed.');
          error.code = 'version_conflict';
          error.status = 409;
          error.currentVersion = lockedVersion;
          throw error;
        }

        if (courseOrgId) {
          const membershipOrgColumn = await getOrganizationMembershipsOrgColumnName();
          let membershipQuery = supabase
            .from('organization_memberships')
            .select('user_id')
            .eq(membershipOrgColumn, courseOrgId)
            .not('user_id', 'is', null);

          const membershipsStatusColumn = await getOrganizationMembershipsStatusColumnName();
          if (membershipsStatusColumn === 'is_active') {
            membershipQuery = membershipQuery.eq('is_active', true);
          } else {
            membershipQuery = membershipQuery.eq('status', 'active');
          }

          const { data: memberRows, error: memberRowsError } = await membershipQuery;
          if (memberRowsError) throw memberRowsError;
          const memberIds = Array.from(new Set((memberRows || []).map((row) => row?.user_id).filter(Boolean).map(String)));
          for (const memberId of memberIds) {
            await assignPublishedOrganizationCoursesToUser({
              orgId: courseOrgId,
              actorUserId: context.userId ?? null,
              userId: memberId,
            });
          }
        }

        const { data: refreshedCourse, error: refreshedCourseError } = await supabase
          .from('courses')
          .select(courseWithModulesLessonsSelect)
          .eq('id', courseId)
          .maybeSingle();
        if (refreshedCourseError) throw refreshedCourseError;
        return refreshedCourse || lockedCourse;
      };

      const updatedData = publishViaSupabaseFallback
        ? await publishCourseViaSupabaseFallback()
        : await sql.begin(async (tx) => {
            const lockedCourse = await loadCourseGraphWithTx(tx, courseId);
            if (!lockedCourse) {
              const error = new Error('Course not found');
              error.code = 'not_found';
              error.status = 404;
              throw error;
            }

            const lockedVersion = typeof lockedCourse.version === 'number' ? lockedCourse.version : null;
            if (incomingVersion !== null && lockedVersion !== null && incomingVersion !== lockedVersion) {
              const error = new Error(`Course has newer version ${lockedVersion}`);
              error.code = 'version_conflict';
              error.status = 409;
              error.currentVersion = lockedVersion;
              throw error;
            }

            const validation = validatePublishableCourse(shapeCourseForValidation(lockedCourse), { intent: 'publish' });
            console.info('[course.publish_validation_result]', {
              requestId: publishLogMeta.requestId,
              userId: publishLogMeta.userId,
              orgId: publishLogMeta.orgId,
              courseId,
              valid: validation.isValid,
              issuesCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
              source: 'sql_tx',
            });
            if (!validation.isValid) {
              const error = new Error('Course is not publishable.');
              error.code = 'validation_failed';
              error.status = 422;
              error.issues = validation.issues;
              throw error;
            }

            const publishedAt = new Date().toISOString();
            const nextVersion = (lockedVersion ?? 0) + 1;
            const nextMeta = { ...(lockedCourse.meta_json || {}), published_at: publishedAt };

            const updatedRows =
              lockedVersion !== null
                ? await tx`
                    update public.courses
                    set status = 'published',
                        published_at = ${publishedAt}::timestamptz,
                        version = ${nextVersion},
                        meta_json = ${JSON.stringify(nextMeta)}::jsonb,
                        updated_at = now(),
                        updated_by = ${context.userId && isUuid(String(context.userId)) ? context.userId : null}::uuid
                    where id = ${courseId}::uuid
                      and version = ${lockedVersion}
                    returning id
                  `
                : await tx`
                    update public.courses
                    set status = 'published',
                        published_at = ${publishedAt}::timestamptz,
                        version = ${nextVersion},
                        meta_json = ${JSON.stringify(nextMeta)}::jsonb,
                        updated_at = now(),
                        updated_by = ${context.userId && isUuid(String(context.userId)) ? context.userId : null}::uuid
                    where id = ${courseId}::uuid
                    returning id
                  `;
            if (!firstRow(updatedRows)?.id) {
              const error = new Error('Course publish failed because the course changed before publish completed.');
              error.code = 'version_conflict';
              error.status = 409;
              error.currentVersion = lockedVersion;
              throw error;
            }

            await backfillPublishedCourseAssignmentsWithTx(tx, {
              orgId: courseOrgId,
              courseId,
              actorUserId: context.userId ?? null,
              assignmentsOrgColumn,
              assignmentsSupportUserIdUuid,
            });

            return loadCourseGraphWithTx(tx, courseId);
          });

      if (idempotencyKey) {
        try {
          await supabase.from('idempotency_keys').update({ resource_id: updatedData?.id }).eq('id', idempotencyKey);
        } catch (error) {
          console.warn('Failed to update publish idempotency key with resource id', error);
        }
        if (idempotencyTableMissing) {
          setInMemoryIdempotencyKey(idempotencyKey, {
            status: 'done',
            createdAt: new Date().toISOString(),
            payload: { course_id: courseId, version: currentVersion },
            resourceId: updatedData?.id ?? courseId,
            data: updatedData,
          });
        }
      }

      try {
        const orgId = updatedData?.organization_id || updatedData?.org_id || null;
        const payload = { type: 'course_updated', data: updatedData, timestamp: Date.now() };
        if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
        broadcastToTopic('course:updates', payload);
      } catch (error) {
        console.warn('Failed to broadcast course publish event', error);
      }

      console.info('[course.publish_success]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId,
        mode: 'supabase',
        durationMs: Date.now() - publishStartedAt,
      });
      sendApiResponse(res, updatedData, {
        statusCode: 200,
        code: 'course_published',
        message: 'Course published successfully.',
        meta: {
          requestId: req.requestId ?? null,
          courseId: updatedData?.id ?? courseId,
          orgId: publishLogMeta.orgId ?? null,
        },
      });
    } catch (error) {
      console.error('[course.publish_error]', {
        requestId: publishLogMeta.requestId,
        userId: publishLogMeta.userId,
        orgId: publishLogMeta.orgId,
        courseId,
        durationMs: Date.now() - publishStartedAt,
        error: {
          message: error?.message ?? null,
          code: error?.code ?? null,
          details: error?.details ?? null,
        },
      });
      logAdminCoursesError(req, error, `Failed to publish course ${id}`);
      res.locals = res.locals || {};
      res.locals.errorCode = error?.code ?? 'publish_failed';
      if (error?.status === 409) {
        const conflictCode = error?.code ?? 'version_conflict';
        sendApiError(res, 409, error?.code ?? 'version_conflict', error?.message ?? 'Publish conflict.', {
          reason: error?.reason ?? (conflictCode === 'idempotency_conflict' ? 'idempotency_in_flight' : 'stale_version'),
          currentVersion: error?.currentVersion ?? null,
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
      if (error?.status === 422) {
        sendApiError(res, 422, error?.code ?? 'validation_failed', 'Course is not publishable.', {
          issues: Array.isArray(error?.issues) ? error.issues : [],
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
      if (error?.status === 404) {
        sendApiError(res, 404, error?.code ?? 'not_found', error?.message ?? 'Course not found', {
          meta: { requestId: req.requestId ?? null, courseId },
        });
        return;
      }
      const isInfraUnavailable = isInfrastructureUnavailableError(error);
      sendApiError(
        res,
        isInfraUnavailable ? 503 : 500,
        isInfraUnavailable ? 'database_unavailable' : 'publish_failed',
        isInfraUnavailable
          ? 'Course publish is temporarily unavailable while the database service is degraded. Please retry shortly.'
          : 'Unable to publish course',
        {
          meta: { requestId: req.requestId ?? null, courseId },
        },
      );
    }
    },
  };
};

export default createCourseAdvancedService;
