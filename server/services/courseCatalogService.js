export const createCourseCatalogService = ({
  logger,
  supabase,
  getSupabase,
  e2eStore,
  nodeEnv,
  isDemoMode,
  isDemoOrTestMode,
  isTestMode,
  defaultSandboxOrgId,
  ensureSupabase,
  requireUserContext,
  pickOrgId,
  coerceOrgIdentifierToUuid,
  isUuid,
  hasOrgAdminRole,
  normalizeOrgIdValue,
  requireOrgAccess,
  parseBooleanParam,
  parsePaginationParams,
  sanitizeIlike,
  runSupabaseReadQueryWithRetry,
  runSupabaseTransientRetry,
  resolveOrgScopeForRequest,
  detectAssignmentsUserIdUuidColumnAvailability,
  getAssignmentsOrgColumnName,
  ensureOrgFieldCompatibility,
  ensureCourseStructureLoaded,
  normalizeModuleGraph,
  attachCompletionRuleForResponse,
  e2eFindCourse,
  logAdminCoursesError,
  logStructuredError,
  courseModulesWithLessonFields,
  courseModulesNoLessonsFields,
  courseWithModulesLessonsSelect,
  moduleLessonsForeignTable,
  resolveOrgScopeForRequestFallback,
}) => {
  const isProduction = nodeEnv === 'production';

  const getSupabaseClient = () => {
    if (typeof getSupabase === 'function') {
      return getSupabase();
    }
    return supabase;
  };

  const requireSupabaseClient = () => {
    const client = getSupabaseClient();
    if (!client) {
      const error = new Error('Supabase client unavailable');
      error.code = 'SUPABASE_CLIENT_UNAVAILABLE';
      throw error;
    }
    return client;
  };

  const chunkValues = (values = [], size = 80) => {
    const chunks = [];
    for (let i = 0; i < values.length; i += size) {
      chunks.push(values.slice(i, i + size));
    }
    return chunks;
  };

  const sortCoursesByCreatedAtDesc = (rows = []) =>
    [...rows].sort((left, right) => {
      const leftTime = Date.parse(left?.created_at ?? left?.updated_at ?? '') || 0;
      const rightTime = Date.parse(right?.created_at ?? right?.updated_at ?? '') || 0;
      return rightTime - leftTime;
    });

  const resolveOrganizationCourseIds = async (orgIds = [], { requestId = null } = {}) => {
    const normalizedOrgIds = Array.from(
      new Set(
        (Array.isArray(orgIds) ? orgIds : [orgIds])
          .map((value) => normalizeOrgIdValue(value))
          .filter(Boolean),
      ),
    );
    if (normalizedOrgIds.length === 0) return null;

    const { data, error } = await requireSupabaseClient()
      .from('organization_courses')
      .select('course_id,organization_id')
      .in('organization_id', normalizedOrgIds);

    if (error) {
      const missingRelation =
        error?.code === '42P01' ||
        (typeof error?.message === 'string' && /relation .*organization_courses.* does not exist/i.test(error.message));
      if (missingRelation) {
        logger.warn('organization_courses_missing_for_scope', {
          requestId,
          orgCount: normalizedOrgIds.length,
          message: error?.message ?? null,
        });
      }
      throw error;
    }

    const ids = Array.from(new Set((data || []).map((row) => row?.course_id).filter(Boolean).map(String)));
    logger.info('organization_courses_scope_resolved', {
      requestId,
      orgCount: normalizedOrgIds.length,
      courseCount: ids.length,
    });
    return ids;
  };

  const isCourseLinkedToOrgScope = async (courseId, orgIds = [], { requestId = null } = {}) => {
    const normalizedCourseId = typeof courseId === 'string' ? courseId.trim() : courseId ? String(courseId).trim() : '';
    const normalizedOrgIds = Array.from(
      new Set(
        (Array.isArray(orgIds) ? orgIds : [orgIds])
          .map((value) => normalizeOrgIdValue(value))
          .filter(Boolean),
      ),
    );
    if (!normalizedCourseId || normalizedOrgIds.length === 0) return false;

    const { data, error } = await requireSupabaseClient()
      .from('organization_courses')
      .select('course_id,organization_id')
      .eq('course_id', normalizedCourseId)
      .in('organization_id', normalizedOrgIds)
      .limit(1);

    if (error) {
      const missingRelation =
        error?.code === '42P01' ||
        (typeof error?.message === 'string' && /relation .*organization_courses.* does not exist/i.test(error.message));
      if (missingRelation) {
        logger.warn('organization_courses_missing_for_detail_scope', {
          requestId,
          courseId: normalizedCourseId,
          orgCount: normalizedOrgIds.length,
          message: error?.message ?? null,
        });
      }
      throw error;
    }

    return Array.isArray(data) && data.length > 0;
  };


  const buildAdminOrgAccess = async ({ req, res, context, requestedOrgId }) => {
    // In demo/test/E2E modes we accept non-UUID org identifiers (slugs) from the
    // request (tests pass 'demo-sandbox-org'). Avoid a hard 403 when coercion to
    // a UUID fails in test/demo mode; instead normalize the identifier string so
    // downstream checks can validate membership against it.
    let resolvedRequestedOrgId = null;
    if (requestedOrgId) {
      if (isDemoOrTestMode || req?.e2eBypass) {
        resolvedRequestedOrgId = normalizeOrgIdValue(requestedOrgId);
      } else {
        resolvedRequestedOrgId = await coerceOrgIdentifierToUuid(req, requestedOrgId);
      }
    }
    if (requestedOrgId && !resolvedRequestedOrgId && !(isDemoOrTestMode || req?.e2eBypass)) {
      return {
        result: { status: 403, body: { error: 'org_access_denied', message: 'Organization scope not permitted' } },
      };
    }

    const resolveMembershipOrgId = (membership) =>
      normalizeOrgIdValue(
        membership?.orgId ?? membership?.organizationId ?? membership?.organization_id ?? membership?.org_id ?? null,
      );

    const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.platformRole === 'platform_admin');
    let adminOrgIds = Array.isArray(context.memberships)
      ? context.memberships
          .filter((membership) => hasOrgAdminRole(membership.role) && resolveMembershipOrgId(membership))
          .map(resolveMembershipOrgId)
          .filter(Boolean)
      : [];
    let allowedOrgIdSet = new Set(adminOrgIds);

    const supabaseClient = getSupabaseClient();
    if (!isPlatformAdmin && adminOrgIds.length === 0 && supabaseClient) {
      try {
        const { data: adminMemberships, error: adminMembershipsError } = await supabaseClient
          .from('organization_memberships')
          .select('organization_id, org_id, role, status')
          .eq('user_id', context.userId)
          .eq('status', 'active');
        if (adminMembershipsError) throw adminMembershipsError;

        adminOrgIds = (adminMemberships || [])
          .filter((membership) => hasOrgAdminRole(membership.role))
          .map((membership) =>
            normalizeOrgIdValue(
              membership.organization_id ?? membership.org_id ?? null,
            ),
          )
          .filter(Boolean);
        allowedOrgIdSet = new Set(adminOrgIds);
      } catch (membershipLookupError) {
        logAdminCoursesError(req, membershipLookupError, 'Failed to load admin memberships');
        return {
          result: {
            status: 500,
            body: { error: 'Unable to verify admin organization memberships' },
          },
        };
      }
    }

    if (!isPlatformAdmin && adminOrgIds.length === 0) {
      return {
        result: { status: 403, body: { error: 'org_admin_required', message: 'Admin membership required.' } },
      };
    }

    if (resolvedRequestedOrgId) {
      const access = await requireOrgAccess(req, res, resolvedRequestedOrgId, { write: false, requireOrgAdmin: true });
      if (!access) return { handled: true };
      if (!isPlatformAdmin && !allowedOrgIdSet.has(resolvedRequestedOrgId)) {
        return {
          result: { status: 403, body: { error: 'org_access_denied', message: 'Organization scope not permitted' } },
        };
      }
    }

    return {
      isPlatformAdmin,
      adminOrgIds,
      allowedOrgIdSet,
      resolvedRequestedOrgId,
      restrictToAllowed: !isPlatformAdmin && !resolvedRequestedOrgId,
    };
  };

  const shapeDemoCatalogCourse = (course) => ({
    id: course.id,
    slug: course.slug ?? course.id,
    title: course.title,
    description: course.description ?? null,
    status: course.status ?? 'draft',
    version: course.version ?? 1,
    meta_json: course.meta_json ?? {},
    published_at: course.published_at ?? null,
    thumbnail: course.thumbnail ?? null,
    difficulty: course.difficulty ?? null,
    duration: course.duration ?? null,
    organization_id: course.organization_id ?? course.org_id ?? null,
    organizationId: course.organizationId ?? course.organization_id ?? course.org_id ?? null,
    org_id: course.org_id ?? course.organization_id ?? null,
    instructorName: course.instructorName ?? null,
    estimatedDuration: course.estimatedDuration ?? null,
    keyTakeaways: course.keyTakeaways ?? [],
    modules: course.modules || [],
  });

  const adminListCourses = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;

    const requestedOrgId = pickOrgId(
      req.query?.orgId,
      req.query?.org_id,
      req.query?.organization_id,
      req.query?.organizationId,
      req.body?.orgId,
      req.body?.org_id,
      req.body?.organization_id,
      req.body?.organizationId,
      context.requestedOrgId,
      context.activeOrganizationId,
    );
    // Allow platform_admin to omit orgId (they can see all orgs). For non-platform
    // admins an explicit orgId or header is still required.
    if (!requestedOrgId && !context.isPlatformAdmin) {
      return {
        status: 400,
        body: { error: 'org_id_required', message: 'orgId query parameter or X-Org-Id header is required.' },
      };
    }

    const accessContext = await buildAdminOrgAccess({ req, res, context, requestedOrgId });
    if (accessContext?.handled) return null;
    if (accessContext?.result) return accessContext.result;

    const { isPlatformAdmin, adminOrgIds, allowedOrgIdSet, resolvedRequestedOrgId, restrictToAllowed } = accessContext;
    logger.info('admin_courses_request_context', {
      requestId: req.requestId ?? null,
      route: '/api/admin/courses',
      userId: context.userId ?? null,
      requestedOrgId,
      resolvedRequestedOrgId: resolvedRequestedOrgId ?? null,
      activeOrganizationId: context.activeOrganizationId ?? null,
      isPlatformAdmin,
    });

    if (isDemoOrTestMode) {
      try {
        const reqIncludeStructure = parseBooleanParam(req.query.includeStructure, false);
        const reqIncludeLessons = parseBooleanParam(req.query.includeLessons, reqIncludeStructure);
        const shaped = Array.from(e2eStore.courses.values())
          .filter((course) => isTestMode || !String(course?.title ?? '').toLowerCase().includes('__e2e_purge__'))
          .map(shapeDemoCatalogCourse);

        const filtered = shaped.filter((course) => {
          const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
          if (resolvedRequestedOrgId) {
            return courseOrgId === resolvedRequestedOrgId;
          }
          if (!isPlatformAdmin) {
            return courseOrgId ? allowedOrgIdSet.has(courseOrgId) : false;
          }
          return true;
        });

        const responseData = reqIncludeStructure
          ? await Promise.all(filtered.map((course) => ensureCourseStructureLoaded(course, { includeLessons: reqIncludeLessons })))
          : filtered;

        const body = {
          data: responseData,
          pagination: {
            page: 1,
            pageSize: responseData.length,
            total: responseData.length,
            hasMore: false,
          },
        };
        if (!isProduction) {
          body.debug = {
            filterOrgId: requestedOrgId || null,
            totalCountForOrg: responseData.length,
            totalCountAllOrgs: shaped.length,
          };
        }
        logger.info('admin_courses_response_ready', {
          requestId: req.requestId ?? null,
          route: '/api/admin/courses',
          requestedOrgId,
          resolvedRequestedOrgId: resolvedRequestedOrgId ?? null,
          rowCount: responseData.length,
          envelopeKeys: Object.keys(body),
        });
        return { status: 200, body };
      } catch (error) {
        logAdminCoursesError(req, error, 'E2E fetch courses failed');
        return { status: 500, body: { error: 'Unable to fetch courses' } };
      }
    }

    if (!ensureSupabase(res)) return null;

    const { page, pageSize, from, to } = parsePaginationParams(req, { defaultSize: 20, maxSize: 100 });
    const includeStructure = parseBooleanParam(req.query.includeStructure, false);
    const includeLessons = parseBooleanParam(req.query.includeLessons, includeStructure);
    const search = (req.query.search || '').toString().trim();
    const statusFilter = (req.query.status || '')
      .toString()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const orgFilter = resolvedRequestedOrgId || '';

    const baseFields = [
      'id',
      'slug',
      'title',
      'description',
      'status',
      'meta_json',
      'published_at',
      'thumbnail',
      'difficulty',
      'duration',
      'organization_id',
      'org_id:organization_id',
      'organizationId:organization_id',
      'created_at',
      'updated_at',
    ];
    const moduleFields = includeStructure
      ? includeLessons
        ? courseModulesWithLessonFields
        : courseModulesNoLessonsFields
      : '';

    try {
      // If requester is platform admin, do not restrict to organization scope.
      const orgScopeIds = orgFilter ? [orgFilter] : !isPlatformAdmin ? adminOrgIds : [];
      const scopedCourseIds =
        !isPlatformAdmin && orgScopeIds.length > 0
          ? await resolveOrganizationCourseIds(orgScopeIds, { requestId: req.requestId ?? null })
          : null;

      if (orgScopeIds.length > 0 && Array.isArray(scopedCourseIds) && scopedCourseIds.length === 0) {
        const emptyBody = {
          data: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            hasMore: false,
          },
        };
        return { status: 200, body: emptyBody };
      }

      if (orgScopeIds.length > 0 && Array.isArray(scopedCourseIds) && scopedCourseIds.length > 80) {
        const scopedRows = [];
        for (const chunk of chunkValues(scopedCourseIds)) {
          const chunkQuery = () => {
            let query = requireSupabaseClient()
              .from('courses')
              .select(`${baseFields.join(',')}${moduleFields}`)
              .in('id', chunk);
            if (search) {
              const term = sanitizeIlike(search);
              query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
            }
            if (statusFilter.length) {
              query = query.in('status', statusFilter);
            }
            return query;
          };
          const { data: chunkData } = await runSupabaseReadQueryWithRetry('admin.courses.list.chunked', chunkQuery);
          if (chunkData != null && !Array.isArray(chunkData)) {
            const shapeError = new Error('Invalid admin courses chunk response shape');
            shapeError.code = 'INVALID_RESPONSE_SHAPE';
            throw shapeError;
          }
          scopedRows.push(...(chunkData || []));
        }

        const sortedRows = sortCoursesByCreatedAtDesc(scopedRows);
        const pageRows = sortedRows.slice(from, from + pageSize);
        const hydratedData = includeStructure
          ? await Promise.all(pageRows.map((courseRecord) => ensureCourseStructureLoaded(courseRecord, { includeLessons })))
          : pageRows;
        const body = {
          data: hydratedData,
          pagination: {
            page,
            pageSize,
            total: sortedRows.length,
            hasMore: to + 1 < sortedRows.length,
          },
        };
        if (!isProduction) {
          body.debug = {
            filterOrgId: orgFilter || (restrictToAllowed ? '[allowed_orgs]' : null),
            totalCountForOrg: sortedRows.length,
            totalCountAllOrgs: sortedRows.length,
          };
        }
        logger.info('admin_courses_response_ready', {
          requestId: req.requestId ?? null,
          route: '/api/admin/courses',
          requestedOrgId,
          resolvedRequestedOrgId: resolvedRequestedOrgId ?? null,
          rowCount: hydratedData.length,
          total: sortedRows.length,
          chunked: true,
          envelopeKeys: Object.keys(body),
        });
        return { status: 200, body };
      }

      const buildQuery = () => {
        let query = requireSupabaseClient()
          .from('courses')
          .select(`${baseFields.join(',')}${moduleFields}`, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (search) {
          const term = sanitizeIlike(search);
          query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
        }
        if (statusFilter.length) {
          query = query.in('status', statusFilter);
        }
        // Only restrict by resolved scopedCourseIds for non-platform admins.
        if (!isPlatformAdmin && orgScopeIds.length > 0) {
          query = query.in('id', scopedCourseIds);
        }
        return query;
      };

      const { data, count } = await runSupabaseReadQueryWithRetry('admin.courses.list', buildQuery);
      if (data != null && !Array.isArray(data)) {
        const shapeError = new Error('Invalid admin courses response shape');
        shapeError.code = 'INVALID_RESPONSE_SHAPE';
        throw shapeError;
      }
      const normalizedData = data || [];
      const hydratedData = includeStructure
        ? await Promise.all(normalizedData.map((courseRecord) => ensureCourseStructureLoaded(courseRecord, { includeLessons })))
        : normalizedData;

      let debugMeta = null;
      if (!isProduction) {
        debugMeta = {
          filterOrgId: orgFilter || (restrictToAllowed ? '[allowed_orgs]' : null),
          totalCountForOrg: typeof count === 'number' ? count : 0,
          totalCountAllOrgs: typeof count === 'number' ? count : 0,
        };
      }

      const body = {
        data: hydratedData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          hasMore: to + 1 < (count || 0),
        },
      };
      if (debugMeta) {
        body.debug = debugMeta;
      }
      logger.info('admin_courses_response_ready', {
        requestId: req.requestId ?? null,
        route: '/api/admin/courses',
        requestedOrgId,
        resolvedRequestedOrgId: resolvedRequestedOrgId ?? null,
        rowCount: hydratedData.length,
        totalCount: count || 0,
        envelopeKeys: Object.keys(body),
      });
      return { status: 200, body };
    } catch (error) {
      logAdminCoursesError(req, error, 'Failed to fetch courses');
      return { status: 500, body: { error: 'Unable to fetch courses' } };
    }
  };

  const adminGetCourse = async ({ req, res }) => {
    const context = requireUserContext(req, res);
    if (!context) return null;
    const identifier = (req.params?.identifier || '').trim();
    if (!identifier) {
      return {
        status: 400,
        body: { error: 'course_identifier_required', message: 'Provide a course id or slug.' },
      };
    }

    const requestedOrgId = pickOrgId(
      req.query?.orgId,
      req.query?.org_id,
      req.query?.organization_id,
      req.query?.organizationId,
      req.body?.orgId,
      req.body?.org_id,
      req.body?.organization_id,
      req.body?.organizationId,
      context.requestedOrgId,
      context.activeOrganizationId,
    );
    const includeStructure = parseBooleanParam(req.query.includeStructure, true);
    const includeLessons = parseBooleanParam(req.query.includeLessons, true);

    const accessContext = await buildAdminOrgAccess({ req, res, context, requestedOrgId });
    if (accessContext?.handled) return null;
    if (accessContext?.result) return accessContext.result;
    const { isPlatformAdmin, allowedOrgIdSet } = accessContext;

    if (isDemoOrTestMode) {
      let courseRecord = e2eStore.courses.get(identifier) || null;
      if (!courseRecord) {
        for (const record of e2eStore.courses.values()) {
          if ((record.slug && String(record.slug).trim() === identifier) || record.id === identifier) {
            courseRecord = record;
            break;
          }
        }
      }
      if (!courseRecord) return { status: 404, body: { error: 'course_not_found' } };

      const courseOrgId = pickOrgId(courseRecord.organization_id, courseRecord.org_id, courseRecord.organizationId);
      if (requestedOrgId && courseOrgId && requestedOrgId !== courseOrgId) {
        return { status: 404, body: { error: 'course_not_found' } };
      }
      if (!isPlatformAdmin && courseOrgId && !allowedOrgIdSet.has(courseOrgId)) {
        return { status: 403, body: { error: 'org_access_denied', message: 'Organization scope not permitted' } };
      }
      const responseCourse = includeStructure
        ? { ...courseRecord, modules: normalizeModuleGraph(courseRecord.modules || [], { includeLessons }) }
        : (() => {
            const { modules, ...rest } = courseRecord;
            return rest;
          })();
      return { status: 200, body: { data: responseCourse } };
    }

    if (!ensureSupabase(res)) return null;

    const fetchCourseRecord = async (column, value) => {
      try {
        const { data } = await runSupabaseReadQueryWithRetry(`admin.courses.detail.${column}`, () =>
          requireSupabaseClient().from('courses').select(courseWithModulesLessonsSelect).eq(column, value).maybeSingle(),
        );
        return data;
      } catch (error) {
        if (error?.code === 'PGRST116') return null;
        throw error;
      }
    };

    try {
      let courseRecord = await fetchCourseRecord('id', identifier);
      if (!courseRecord) {
        courseRecord = await fetchCourseRecord('slug', identifier);
      }
      if (!courseRecord) return { status: 404, body: { error: 'course_not_found' } };

      const courseOrgId = pickOrgId(courseRecord.organization_id, courseRecord.org_id, courseRecord.organizationId);
      if (requestedOrgId && courseOrgId && requestedOrgId !== courseOrgId) {
        return { status: 404, body: { error: 'course_not_found' } };
      }
      if (!isPlatformAdmin) {
        const targetOrgId = courseOrgId || requestedOrgId;
        if (!targetOrgId || !allowedOrgIdSet.has(targetOrgId)) {
          return { status: 403, body: { error: 'org_access_denied', message: 'Organization scope not permitted' } };
        }
      }
      if (courseOrgId) {
        const access = await requireOrgAccess(req, res, courseOrgId, { write: false, requireOrgAdmin: true });
        if (!access) return null;
      }

      const shapedCourse = includeStructure
        ? await ensureCourseStructureLoaded(courseRecord, { includeLessons })
        : (() => {
            const { modules, ...rest } = courseRecord;
            return rest;
          })();
      return { status: 200, body: { data: shapedCourse } };
    } catch (error) {
      logAdminCoursesError(req, error, 'Failed to fetch course');
      return { status: 500, body: { error: 'Unable to fetch course' } };
    }
  };

  const clientListCourses = async ({ req, res }) => {
    const requestId = req.requestId ?? null;
    const assignedOnly = String(req.query.assigned || 'false').toLowerCase() === 'true';
    const queryOrgParam =
      typeof req.query.orgId === 'string'
        ? req.query.orgId
        : typeof req.query.organizationId === 'string'
          ? req.query.organizationId
          : null;

    let context = null;
    if (isDemoOrTestMode) {
      context = {
        userId: null,
        userRole: 'admin',
        memberships: [],
        organizationIds: [],
        requestedOrgId: null,
        activeOrganizationId: null,
        isPlatformAdmin: true,
      };
    } else {
      context = requireUserContext(req, res);
      if (!context) return null;
    }

    if (
      !context.isPlatformAdmin &&
      context.userId &&
      (!Array.isArray(context.memberships) || context.memberships.length === 0) &&
      (!Array.isArray(context.organizationIds) || context.organizationIds.length === 0)
    ) {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        try {
          const { data: membershipRows, error: membershipError } = await supabaseClient
            .from('organization_memberships')
            .select('organization_id, org_id, role, status')
            .eq('user_id', context.userId)
            .eq('status', 'active');
          if (membershipError) throw membershipError;
          const hydratedMemberships = (membershipRows || [])
            .map((membership) => {
              const orgId = normalizeOrgIdValue(
                pickOrgId(membership?.organization_id, membership?.org_id),
              );
              return orgId
                ? {
                    orgId,
                    organizationId: orgId,
                    organization_id: orgId,
                    role: membership?.role ?? 'member',
                    status: membership?.status ?? 'active',
                  }
                : null;
            })
            .filter(Boolean);
          if (hydratedMemberships.length > 0) {
            context = {
              ...context,
              memberships: hydratedMemberships,
              organizationIds: hydratedMemberships.map((membership) => membership.orgId),
              activeOrganizationId: context.activeOrganizationId || hydratedMemberships[0].orgId,
              requestedOrgId: context.requestedOrgId || hydratedMemberships[0].orgId,
            };
            logger.info('client_courses_membership_context_hydrated', {
              requestId,
              userId: context.userId,
              membershipCount: hydratedMemberships.length,
            });
          }
        } catch (membershipError) {
          logger.warn('client_courses_membership_context_hydration_failed', {
            requestId,
            userId: context.userId,
            message: membershipError?.message ?? String(membershipError),
          });
        }
      }
    }

    if (!isDemoMode && !isUuid(context.userId || '') && !context.isPlatformAdmin) {
      return { status: 200, body: { ok: true, courses: [], total: 0, requestId } };
    }

    const orgScope = await (resolveOrgScopeForRequest || resolveOrgScopeForRequestFallback)(req, context, {
      queryOrgId: queryOrgParam,
      requireExplicitSelection: true,
    });
    const { resolvedOrgId, scopedOrgIds, membershipSet, primaryOrgId, requiresExplicitSelection } = orgScope;
    if (requiresExplicitSelection) {
      return {
        status: 403,
        body: {
          ok: false,
          code: 'org_selection_required',
          message: 'Select an organization before loading learner courses.',
          requestId,
        },
      };
    }

    let effectiveScopedOrgIds = Array.isArray(scopedOrgIds) ? [...scopedOrgIds] : [];
    let effectiveAssignedOnly = assignedOnly;
    let membershipFallbackApplied = false;
    const requestOrgId = req.organizationId || null;
    let effectiveOrgId = requestOrgId || resolvedOrgId || primaryOrgId || null;

    if (effectiveOrgId && !context.isPlatformAdmin && !membershipSet.has(effectiveOrgId)) {
      return {
        status: 403,
        body: { ok: false, code: 'org_forbidden', message: 'You do not have access to this organization.', requestId },
      };
    }

    if (!context.isPlatformAdmin && effectiveScopedOrgIds.length === 0) {
      if (effectiveScopedOrgIds.length === 0) {
        return {
          status: 200,
          body: {
            ok: true,
            data: [],
            requestId,
            meta: { code: 'org_membership_required', membershipFallbackApplied: false },
          },
        };
      }
    }

    const assignmentOrgId = effectiveOrgId ?? primaryOrgId;
    if (effectiveAssignedOnly && !assignmentOrgId && !context.isPlatformAdmin) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'org_required',
          message: 'Specify an orgId or set an active organization to view assignments.',
          requestId,
        },
      };
    }

  const sessionUserId = (typeof req.getUserId === 'function' ? req.getUserId() : (req.user && (req.user.userId || req.user.id || req.user.sub))) || context.userId || null;
    const normalizedSessionUserId = sessionUserId ? String(sessionUserId).trim().toLowerCase() : null;

    const resolveAssignmentCourseIds = async () => {
      if (!effectiveAssignedOnly || !assignmentOrgId) return null;
      const ids = new Set();
      const pushIds = (rows = []) => {
        rows.forEach((assignment) => {
          if (!assignment) return;
          const targetUser = typeof assignment.user_id === 'string' ? assignment.user_id.trim().toLowerCase() : null;
          if (assignment.active === false || (normalizedSessionUserId && targetUser && targetUser !== normalizedSessionUserId)) {
            return;
          }
          if (!targetUser && normalizedSessionUserId) {
            const assignmentOrg = pickOrgId(assignment.organization_id, assignment.org_id, assignment.organizationId, assignment.orgId);
            if (String(assignmentOrg || '').trim() !== assignmentOrgId) return;
          }
          const courseId = assignment.course_id || assignment.courseId || null;
          if (courseId) ids.add(String(courseId));
        });
      };

      if (!getSupabaseClient()) {
        if (isDemoOrTestMode) {
          pushIds(e2eStore.assignments || []);
          return Array.from(ids);
        }
        return null;
      }

      const tablesToTry = ['assignments', 'course_assignments'];
      const assignmentsSupportUserIdUuid = await detectAssignmentsUserIdUuidColumnAvailability();
      const assignmentsOrgColumn = await getAssignmentsOrgColumnName();

      for (const table of tablesToTry) {
        let tableResults = null;
        const orgColumnCandidates =
          table === 'assignments'
            ? [
                {
                  column: assignmentsOrgColumn,
                  select: assignmentsOrgColumn === 'organization_id'
                    ? 'course_id,organization_id,user_id,active'
                    : 'course_id,org_id,user_id,active',
                },
                {
                  column: assignmentsOrgColumn === 'organization_id' ? 'org_id' : 'organization_id',
                  select: assignmentsOrgColumn === 'organization_id'
                    ? 'course_id,org_id,user_id,active'
                    : 'course_id,organization_id,user_id,active',
                },
              ]
            : [
                { column: 'organization_id', select: 'course_id,organization_id,user_id,active' },
                { column: 'org_id', select: 'course_id,org_id,user_id,active' },
              ];

        for (const candidate of orgColumnCandidates) {
          const buildQuery = () => {
            let query = requireSupabaseClient().from(table).select(candidate.select).eq(candidate.column, assignmentOrgId);
            if (normalizedSessionUserId) {
              if (table === 'assignments' && assignmentsSupportUserIdUuid) {
                query = query.or(`user_id.eq.${normalizedSessionUserId},user_id_uuid.eq.${normalizedSessionUserId},user_id.is.null`);
              } else {
                query = query.or(`user_id.eq.${normalizedSessionUserId},user_id.is.null`);
              }
            } else {
              query = query.is('user_id', null);
            }
            return query;
          };

          let data = null;
          try {
            const result = await runSupabaseReadQueryWithRetry(`client.courses.assignments.${table}.${candidate.column}`, buildQuery);
            data = result?.data ?? null;
          } catch (error) {
            const missingRelation = typeof error.message === 'string' && /relation/.test(error.message);
            const missingColumn = error.code === '42703' || (typeof error.message === 'string' && /column .* does not exist/i.test(error.message));
            if (missingRelation) {
              tableResults = null;
              break;
            }
            if (missingColumn) {
              continue;
            }
            throw error;
          }
          tableResults = data || [];
          break;
        }

        if (tableResults) {
          pushIds(tableResults);
          if (ids.size > 0 || table === tablesToTry[tablesToTry.length - 1]) {
            break;
          }
        }
      }

      return Array.from(ids);
    };

    const respondWithDemoCourses = async () => {
      let courses = Array.from(e2eStore.courses.values()).map((course) => {
        const normalizedCourse = ensureOrgFieldCompatibility(course, { fallbackOrgId: defaultSandboxOrgId }) || course;
        const { org_id, ...rest } = normalizedCourse;
        return rest;
      });

      if (!context.isPlatformAdmin && effectiveScopedOrgIds.length > 0 && !isTestMode) {
        const scopedOrgIdSet = new Set(effectiveScopedOrgIds);
        courses = courses.filter((course) => {
          const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
          const normalizedCourseOrg = normalizeOrgIdValue(courseOrgId);
          return normalizedCourseOrg ? scopedOrgIdSet.has(normalizedCourseOrg) : false;
        });
      }

      if (assignedOnly && assignmentOrgId) {
        const demoAssignments = (e2eStore.assignments || [])
          .map((assignment) => ensureOrgFieldCompatibility(assignment, { fallbackOrgId: defaultSandboxOrgId }) || assignment)
          .filter(
            (assignment) =>
              assignment &&
              assignment.active !== false &&
              String(assignment.organization_id || '').trim() === assignmentOrgId &&
              (!normalizedSessionUserId || assignment.user_id === null || String(assignment.user_id).trim().toLowerCase() === normalizedSessionUserId),
          );
        const assignedIds = new Set(demoAssignments.map((assignment) => String(assignment.course_id)));
        courses = courses.filter((course) => assignedIds.has(String(course.id)) || assignedIds.has(String(course.slug)));
      }

      return courses.map((courseRecord) => {
        const course = ensureOrgFieldCompatibility(courseRecord, { fallbackOrgId: defaultSandboxOrgId }) || courseRecord;
        return {
          id: course.id,
          slug: course.slug ?? course.id,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          meta_json: course.meta_json ?? {},
          published_at: course.published_at ?? null,
          thumbnail: course.thumbnail ?? null,
          difficulty: course.difficulty ?? null,
          duration: course.duration ?? null,
          organization_id: course.organization_id ?? null,
          organizationId: course.organizationId ?? course.organization_id ?? null,
          instructorName: course.instructorName ?? null,
          estimatedDuration: course.estimatedDuration ?? null,
          keyTakeaways: course.keyTakeaways ?? [],
          modules: (course.modules || []).map((module) => ({
            id: module.id,
            course_id: course.id,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? module.order ?? 0,
            lessons: (module.lessons || []).map((lesson) => {
              const lessonRecord = {
                id: lesson.id,
                module_id: module.id,
                title: lesson.title,
                description: lesson.description ?? null,
                type: lesson.type,
                order_index: lesson.order_index ?? lesson.order ?? 0,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? lesson.content ?? {},
              };
              attachCompletionRuleForResponse(lessonRecord);
              return lessonRecord;
            }),
          })),
        };
      });
    };

    if (isDemoOrTestMode) {
      const demoData = await respondWithDemoCourses();
      return { status: 200, body: { ok: true, data: demoData, requestId } };
    }

    if (!ensureSupabase(res)) return null;

    try {
      let assignmentCourseIds = null;
      if (effectiveAssignedOnly && assignmentOrgId) {
        assignmentCourseIds = await runSupabaseTransientRetry('client.courses.resolve_assignment_ids', () => resolveAssignmentCourseIds());
        if (effectiveAssignedOnly && Array.isArray(assignmentCourseIds) && assignmentCourseIds.length === 0) {
          return { status: 200, body: { ok: true, data: [], requestId } };
        }
      }

      const shouldScopeByOrganizationCourses = !context.isPlatformAdmin || effectiveScopedOrgIds.length > 0;
      const organizationCourseIds =
        shouldScopeByOrganizationCourses && effectiveScopedOrgIds.length > 0
          ? await resolveOrganizationCourseIds(effectiveScopedOrgIds, { requestId })
          : null;

      if (
        shouldScopeByOrganizationCourses &&
        effectiveScopedOrgIds.length > 0 &&
        Array.isArray(organizationCourseIds) &&
        organizationCourseIds.length === 0
      ) {
        return {
          status: 200,
          body: {
            ok: true,
            data: [],
            requestId,
            meta: {
              orgId: assignmentOrgId ?? (effectiveScopedOrgIds.length === 1 ? effectiveScopedOrgIds[0] : null),
              scopedOrgCount: effectiveScopedOrgIds.length,
              assignedOnly: effectiveAssignedOnly,
              assignmentFilterActive: effectiveAssignedOnly && Array.isArray(assignmentCourseIds),
              assignmentCourseCount: Array.isArray(assignmentCourseIds) ? assignmentCourseIds.length : null,
              organizationCourseFilterActive: true,
              organizationCourseCount: 0,
              membershipFallbackApplied,
              count: 0,
            },
          },
        };
      }

      const buildQuery = () => {
        let courseQuery = requireSupabaseClient()
          .from('courses')
          .select(courseWithModulesLessonsSelect)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .order('order_index', { ascending: true, foreignTable: 'modules' })
          .order('order_index', { ascending: true, foreignTable: moduleLessonsForeignTable });

        if (effectiveAssignedOnly && assignmentOrgId && Array.isArray(assignmentCourseIds)) {
          courseQuery = courseQuery.in('id', assignmentCourseIds);
        }
        if (Array.isArray(organizationCourseIds)) {
          courseQuery = courseQuery.in('id', organizationCourseIds);
        }
        return courseQuery;
      };

      let data = null;
      let chunkedCourseIds = null;
      if (Array.isArray(organizationCourseIds) && organizationCourseIds.length > 80) {
        const assignmentFilter = effectiveAssignedOnly && assignmentOrgId && Array.isArray(assignmentCourseIds)
          ? new Set(assignmentCourseIds.map((value) => String(value)))
          : null;
        chunkedCourseIds = assignmentFilter
          ? organizationCourseIds.filter((courseId) => assignmentFilter.has(String(courseId)))
          : organizationCourseIds;
        const chunkRows = [];
        for (const chunk of chunkValues(chunkedCourseIds)) {
          const chunkQuery = () =>
            requireSupabaseClient()
              .from('courses')
              .select(courseWithModulesLessonsSelect)
              .eq('status', 'published')
              .in('id', chunk)
              .order('created_at', { ascending: false })
              .order('order_index', { ascending: true, foreignTable: 'modules' })
              .order('order_index', { ascending: true, foreignTable: moduleLessonsForeignTable });
          const { data: chunkData } = await runSupabaseReadQueryWithRetry('client.courses.published.chunked', chunkQuery);
          if (chunkData != null && !Array.isArray(chunkData)) {
            const shapeError = new Error('Invalid client courses chunk response shape');
            shapeError.code = 'INVALID_RESPONSE_SHAPE';
            throw shapeError;
          }
          chunkRows.push(...(chunkData || []));
        }
        data = sortCoursesByCreatedAtDesc(chunkRows);
      } else {
        const result = await runSupabaseReadQueryWithRetry('client.courses.published', buildQuery);
        data = result?.data ?? null;
      }
      if (data != null && !Array.isArray(data)) {
        const shapeError = new Error('Invalid client courses response shape');
        shapeError.code = 'INVALID_RESPONSE_SHAPE';
        throw shapeError;
      }
      const list = data || [];
      const responseMeta = {
        orgId: assignmentOrgId ?? (effectiveScopedOrgIds.length === 1 ? effectiveScopedOrgIds[0] : null),
        scopedOrgCount: effectiveScopedOrgIds.length,
        assignedOnly: effectiveAssignedOnly,
        assignmentFilterActive: effectiveAssignedOnly && Array.isArray(assignmentCourseIds),
        assignmentCourseCount: Array.isArray(assignmentCourseIds) ? assignmentCourseIds.length : null,
        organizationCourseFilterActive: Array.isArray(organizationCourseIds),
        organizationCourseCount: Array.isArray(organizationCourseIds) ? organizationCourseIds.length : null,
        chunkedOrganizationCourseCount: Array.isArray(chunkedCourseIds) ? chunkedCourseIds.length : null,
        membershipFallbackApplied,
        count: list.length,
      };
      return { status: 200, body: { ok: true, data: list, requestId, meta: responseMeta } };
    } catch (error) {
      logStructuredError('[client/courses] published_fetch_failed', error, {
        route: '/api/client/courses',
        queryName: error?.queryName ?? 'client_courses_published',
        assignedOnly: effectiveAssignedOnly,
        orgId: assignmentOrgId ?? null,
        requestId,
      });
      return {
        status: 500,
        body: {
          ok: false,
          code: error?.code ?? 'catalog_fetch_failed',
          message: error?.message ?? 'Unable to fetch courses.',
          hint: error?.hint ?? null,
          requestId,
          queryName: error?.queryName ?? 'client_courses_published',
        },
      };
    }
  };

  const clientGetCourse = async ({ req, res }) => {
    const { courseIdentifier } = req.params;
    const includeDrafts = String(req.query.includeDrafts || '').toLowerCase() === 'true';
    const requestId = req.requestId ?? null;
    let context = null;
    if (isDemoOrTestMode) {
      context = {
        userId: null,
        userRole: 'admin',
        memberships: [],
        organizationIds: [],
        requestedOrgId: null,
        activeOrganizationId: null,
        isPlatformAdmin: true,
      };
    } else {
      context = requireUserContext(req, res);
      if (!context) return null;
    }

    const orgScope = await (resolveOrgScopeForRequest || resolveOrgScopeForRequestFallback)(req, context, { requireExplicitSelection: true });
    const { membershipSet, scopedOrgIds, requiresExplicitSelection } = orgScope;
    if (requiresExplicitSelection) {
      return {
        status: 403,
        body: {
          ok: false,
          code: 'org_selection_required',
          message: 'Select an organization before opening this course.',
          requestId,
        },
      };
    }

    const allowAllOrgAccess = context.isPlatformAdmin || scopedOrgIds.length === 0;
    const isOrgAllowed = (orgId) => {
      if (allowAllOrgAccess) return true;
      const normalized = normalizeOrgIdValue(orgId);
      return normalized ? membershipSet.has(normalized) : false;
    };
    const detailScopeOrgIds = allowAllOrgAccess
      ? []
      : scopedOrgIds.length > 0
        ? scopedOrgIds
        : [normalizeOrgIdValue(context.activeOrganizationId ?? context.requestedOrgId ?? null)].filter(Boolean);
    const isCourseAllowedForDetail = async (course) => {
      if (allowAllOrgAccess) return true;
      return isCourseLinkedToOrgScope(course?.id, detailScopeOrgIds, { requestId });
    };

    if (isDemoOrTestMode) {
      try {
        const course = e2eFindCourse(courseIdentifier);
        if (!course) {
          return { status: 200, body: { data: null } };
        }

        const normalizedCourse = ensureOrgFieldCompatibility(course, { fallbackOrgId: defaultSandboxOrgId }) || course;
        const courseOrgId = normalizedCourse.organization_id ?? normalizedCourse.org_id ?? normalizedCourse.organizationId ?? null;
        if (!isOrgAllowed(courseOrgId)) {
          return { status: 200, body: { data: null } };
        }

        const normalizeLessonContent = (lesson) => {
          const baseContent = lesson?.content_json ?? lesson?.content ?? {};
          const nextContent = { ...(baseContent || {}) };
          const body = typeof baseContent?.body === 'object' && baseContent.body ? baseContent.body : null;
          if (!nextContent.videoUrl && body?.videoUrl) nextContent.videoUrl = body.videoUrl;
          if (!nextContent.video && nextContent.videoUrl) nextContent.video = { url: nextContent.videoUrl };
          return nextContent;
        };

        const data = {
          id: normalizedCourse.id,
          slug: normalizedCourse.slug ?? normalizedCourse.id,
          title: normalizedCourse.title,
          description: normalizedCourse.description ?? null,
          status: normalizedCourse.status ?? 'draft',
          version: normalizedCourse.version ?? 1,
          meta_json: normalizedCourse.meta_json ?? {},
          published_at: normalizedCourse.published_at ?? null,
          thumbnail: normalizedCourse.thumbnail ?? null,
          difficulty: normalizedCourse.difficulty ?? null,
          duration: normalizedCourse.duration ?? null,
          organization_id: normalizedCourse.organization_id ?? normalizedCourse.org_id ?? null,
          organizationId: normalizedCourse.organizationId ?? normalizedCourse.organization_id ?? normalizedCourse.org_id ?? null,
          org_id: normalizedCourse.org_id ?? normalizedCourse.organization_id ?? null,
          instructorName: normalizedCourse.instructorName ?? null,
          estimatedDuration: normalizedCourse.estimatedDuration ?? null,
          keyTakeaways: normalizedCourse.keyTakeaways ?? [],
          modules: (normalizedCourse.modules || []).map((module) => ({
            id: module.id,
            course_id: normalizedCourse.id,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? module.order ?? 0,
            lessons: (module.lessons || []).map((lesson) => {
              const normalizedContent = normalizeLessonContent(lesson);
              const responseLessonId =
                (typeof lesson?.client_temp_id === 'string' && lesson.client_temp_id.trim()) ||
                (typeof lesson?.clientTempId === 'string' && lesson.clientTempId.trim()) ||
                lesson.id;
              const lessonRecord = {
                id: responseLessonId,
                module_id: module.id,
                title: lesson.title,
                description: lesson.description ?? null,
                type: lesson.type,
                order_index: lesson.order_index ?? lesson.order ?? 0,
                duration_s: lesson.duration_s ?? null,
                content: normalizedContent,
                content_json: normalizedContent,
              };
              attachCompletionRuleForResponse(lessonRecord);
              return lessonRecord;
            }),
          })),
        };
        return { status: 200, body: { ok: true, data, requestId } };
      } catch (error) {
        return {
          status: 500,
          body: {
            ok: false,
            code: 'course_fetch_failed',
            message: 'Unable to load course.',
            hint: null,
            requestId,
            queryName: 'client_course_detail',
          },
        };
      }
    }

    if (!ensureSupabase(res)) return null;

    const buildQuery = (column, value) => {
      let query = requireSupabaseClient()
        .from('courses')
        .select(courseWithModulesLessonsSelect)
        .eq(column, value)
        .order('order_index', { ascending: true, foreignTable: 'modules' })
        .order('order_index', { ascending: true, foreignTable: moduleLessonsForeignTable })
        .maybeSingle();
      if (!includeDrafts) query = query.eq('status', 'published');
      return query;
    };

    const queryName = 'client_course_detail';
    let identifierType = 'slug';
    try {
      identifierType = isUuid(courseIdentifier) ? 'uuid' : 'slug';
      const identifierValue = courseIdentifier;
      let data = null;
      if (identifierType === 'uuid') {
        try {
          const result = await runSupabaseReadQueryWithRetry('client.course.detail.id', () => buildQuery('id', identifierValue));
          data = result?.data ?? null;
        } catch (error) {
          if (error?.code !== 'PGRST116') throw error;
        }
      }
      if (!data) {
        try {
          const result = await runSupabaseReadQueryWithRetry('client.course.detail.slug', () => buildQuery('slug', identifierValue));
          data = result?.data ?? null;
        } catch (error) {
          if (error?.code !== 'PGRST116') throw error;
        }
      }
      if (data) {
        if (!(await isCourseAllowedForDetail(data))) {
          return { status: 200, body: { ok: true, data: null, requestId } };
        }
        const hydrated = await ensureCourseStructureLoaded(data, { includeLessons: true });
        return { status: 200, body: { ok: true, data: hydrated, requestId } };
      }
      return { status: 200, body: { ok: true, data: null, requestId } };
    } catch (error) {
      logStructuredError('[client/courses] detail_fetch_failed', error, {
        route: '/api/client/courses/:courseIdentifier',
        queryName,
        identifier: courseIdentifier,
        identifierType,
        requestId,
      });
      return {
        status: 500,
        body: {
          ok: false,
          code: error?.code ?? 'course_fetch_failed',
          message: error?.message ?? 'Unable to load course.',
          hint: error?.hint ?? null,
          requestId,
          queryName,
        },
      };
    }
  };

  return {
    adminListCourses,
    adminGetCourse,
    clientListCourses,
    clientGetCourse,
  };
};

export default createCourseCatalogService;
