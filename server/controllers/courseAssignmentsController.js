import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createCourseAssignmentsController = ({
  logger,
  service,
  ensureSupabase,
  requireUserContext,
  requireOrgAccess,
  isFallbackMode,
}) => ({
  adminAssign: async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await service.assignAdminCourse({ req, res, requireUserContext, requireOrgAccess });
      if (result.error) {
        res.locals = res.locals || {};
        res.locals.errorCode = result.error.code ?? 'assignment_failed';
        if (result.error.code === 'invalid_user_ids' && Array.isArray(result.error.details?.invalidUserIds)) {
          return res.status(result.status).json({
            ok: false,
            code: result.error.code,
            error: result.error.code,
            message: result.error.message,
            invalidUserIds: result.error.details.invalidUserIds,
            details: result.error.details,
            meta: result.meta ?? null,
          });
        }
        return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      }
      return res.status(result.status).json({
        ok: true,
        data: result.data,
        idempotent: result.meta?.idempotent ?? false,
        meta: result.meta ?? null,
      });
    } catch (error) {
      logger.error('admin_course_assignment_create_failed', {
        requestId: req.requestId ?? null,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return sendError(res, 500, 'assignment_failed', 'Unable to assign course');
    }
  },
  clientList: async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    try {
      logger.info('client_assignments_controller_request_received', {
        requestId: req.requestId ?? null,
        path: req.path,
        query: req.query ?? null,
        authUserId: req.authContext?.userId ?? null,
        contextUserId: context.userId ?? null,
      });
    } catch (e) {
      // continue
    }
    try {
      const result = await service.loadClientAssignments({ req, context });
      try {
        logger.info('client_assignments_controller_response', {
          requestId: req.requestId ?? null,
          status: result.status ?? null,
          count: result.meta?.count ?? (Array.isArray(result.data) ? result.data.length : null),
          orgId: result.meta?.orgId ?? null,
        });
      } catch (e) {}
      if (result.error) {
        return sendError(res, result.status, result.error.code, result.error.message, undefined, result.meta);
      }
      return res.status(result.status).json({
        ok: true,
        data: result.data,
        count: result.meta?.count ?? (Array.isArray(result.data) ? result.data.length : 0),
        orgId: result.meta?.orgId ?? null,
        meta: result.meta ?? null,
      });
    } catch (error) {
      logger.error('client_assignments_fetch_failed', {
        requestId: req.requestId,
        userId: req.authContext?.userId ?? null,
        code: error?.code,
        message: error?.message,
        stack: error?.stack ?? null,
        query: req.query ?? null,
      });
      return sendError(res, 500, 'fetch_failed', 'Unable to load assignments');
    }
  },
  adminList: async (req, res) => {
    try {
      const result = await service.listAdminAssignments({ req, isFallbackMode, requireOrgAccess, requireUserContext });
      if (result.error) {
        return sendError(res, result.status, result.error.code, result.error.message);
      }
      return res.status(result.status).json({
        ok: true,
        data: result.data,
        count: result.meta?.count ?? (Array.isArray(result.data) ? result.data.length : 0),
        meta: result.meta ?? null,
      });
    } catch (error) {
      logger.error('admin_course_assignments_fetch_failed', {
        requestId: req.requestId ?? null,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return sendError(res, 500, 'assignments_load_failed', 'Unable to load assignments');
    }
  },
  adminDelete: async (req, res) => {
    try {
      const result = await service.deleteAdminAssignment({ req, requireOrgAccess, requireUserContext });
      if (result.error) {
        return sendError(res, result.status, result.error.code, result.error.message);
      }
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_assignment_delete_failed', {
        requestId: req.requestId ?? null,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      return sendError(res, 500, 'assignment_delete_failed', 'Unable to remove assignment');
    }
  },
});

export default createCourseAssignmentsController;
