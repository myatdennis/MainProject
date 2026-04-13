export const createCourseManagementService = ({
  supabase,
  ensureSupabase,
  isDemoOrTestMode,
  e2eStore,
  persistE2EStore,
  requireUserContext,
  resolveCourseIdentifierToUuid,
  isUuid,
  handleAdminCourseUpsert,
  getCourseOrgId,
  pickOrgId,
  requireOrgAccess,
}) => ({
  createCourse: async ({ req, res }) => {
    await handleAdminCourseUpsert(req, res);
    return null;
  },

  updateCourse: async ({ req, res }) => {
    const { id } = req.params;
    const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
    if (!resolvedCourseId) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'course_not_found';
      return {
        status: 404,
        body: {
          ok: false,
          code: 'course_not_found',
          error: 'course_not_found',
          message: `Course not found for identifier ${id}`,
          meta: { requestId: req.requestId ?? null },
        },
      };
    }
    const courseId = resolvedCourseId;
    if (!isUuid(courseId) && !isDemoOrTestMode) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'invalid_course_id',
          error: 'invalid_course_id',
          message: 'Course ID must be a UUID.',
          meta: { requestId: req.requestId ?? null },
        },
      };
    }
    await handleAdminCourseUpsert(req, res, { courseIdFromParams: courseId });
    return null;
  },

  deleteCourse: async ({ req, res }) => {
    const { id } = req.params;
    const resolvedCourseId = await resolveCourseIdentifierToUuid(id);
    if (!resolvedCourseId) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'course_not_found';
      return {
        status: 404,
        body: { error: 'course_not_found', message: `Course not found for identifier ${id}` },
      };
    }

    const context = requireUserContext(req, res);
    if (!context) return null;

    if (isDemoOrTestMode) {
      const course = e2eStore.courses.get(id);
      if (!course) {
        return { status: 204, body: null };
      }
      const courseOrgId = pickOrgId(course.organization_id, course.org_id, course.organizationId);
      if (courseOrgId) {
        const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return null;
      } else if (!context.isPlatformAdmin) {
        return {
          status: 403,
          body: { error: 'organization_required', message: 'Course is not scoped to an organization.' },
        };
      }
      e2eStore.courses.delete(id);
      persistE2EStore();
      return { status: 204, body: null };
    }

    if (!ensureSupabase(res)) return null;

    try {
      const courseOrgId = await getCourseOrgId(id);
      if (courseOrgId === undefined) {
        return { status: 404, body: { error: 'Course not found' } };
      }
      if (courseOrgId) {
        const access = await requireOrgAccess(req, res, courseOrgId, { write: true, requireOrgAdmin: true });
        if (!access) return null;
      } else if (!context.isPlatformAdmin) {
        return {
          status: 403,
          body: { error: 'organization_required', message: 'Course is not scoped to an organization.' },
        };
      }
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      return { status: 204, body: null };
    } catch (_error) {
      return { status: 500, body: { error: 'Unable to delete course' } };
    }
  },
});

export default createCourseManagementService;
