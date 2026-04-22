import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAdminNotificationsController = ({ logger, service }) => ({
  list: async (req, res) => {
    try {
      const result = await service.listNotifications({ req, res });
      if (!result) return;
      if (result.raw) return res.status(result.status).json(result.payload);
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_notifications_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      const isDbDown = error?.statusCode === 503 || String(error?.code || '').toLowerCase().includes('database') || String(error?.code || '').toLowerCase().includes('timeout');
      if (isDbDown) {
        return sendError(res, 503, 'database_unavailable', 'Notifications service temporarily unavailable');
      }
      return sendError(res, 503, error?.code ?? 'service_unavailable', error?.message ?? 'Service temporarily unavailable');
    }
  },

  create: async (req, res) => {
    try {
      const result = await service.createNotification({ req, res });
      if (!result) return;
      if (result.raw) return res.status(result.status).json(result.payload);
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_notifications_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      const isDbDown = error?.statusCode === 503 || String(error?.code || '').toLowerCase().includes('database') || String(error?.code || '').toLowerCase().includes('timeout');
      if (isDbDown) {
        return sendError(res, 503, 'database_unavailable', 'Notifications service temporarily unavailable');
      }
      return sendError(res, 503, error?.code ?? 'service_unavailable', error?.message ?? 'Service temporarily unavailable');
    }
  },

  broadcast: async (req, res) => {
    try {
      const result = await service.broadcastNotifications({ req, res });
      if (!result) return;
      if (result.raw) return res.status(result.status).json(result.payload);
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_notifications_broadcast_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      const isDbDown = error?.statusCode === 503 || String(error?.code || '').toLowerCase().includes('database') || String(error?.code || '').toLowerCase().includes('timeout');
      if (isDbDown) {
        return sendError(res, 503, 'database_unavailable', 'Notifications service temporarily unavailable');
      }
      return sendError(res, 503, error?.code ?? 'service_unavailable', error?.message ?? 'Service temporarily unavailable');
    }
  },

  markRead: async (req, res) => {
    try {
      const result = await service.markRead({ req, res });
      if (!result) return;
      if (result.raw) return res.status(result.status).json(result.payload);
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_notifications_mark_read_failed', {
        requestId: req.requestId ?? null,
        notificationId: req.params.id,
        message: error?.message ?? String(error),
      });
      const isDbDown = error?.statusCode === 503 || String(error?.code || '').toLowerCase().includes('database') || String(error?.code || '').toLowerCase().includes('timeout');
      if (isDbDown) {
        return sendError(res, 503, 'database_unavailable', 'Notifications service temporarily unavailable');
      }
      return sendError(res, 503, error?.code ?? 'service_unavailable', error?.message ?? 'Service temporarily unavailable');
    }
  },

  delete: async (req, res) => {
    try {
      const result = await service.deleteNotification({ req, res });
      if (!result) return;
      if (result.raw) return res.status(result.status).json(result.payload);
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_notifications_delete_failed', {
        requestId: req.requestId ?? null,
        notificationId: req.params.id,
        message: error?.message ?? String(error),
      });
      const isDbDown = error?.statusCode === 503 || String(error?.code || '').toLowerCase().includes('database') || String(error?.code || '').toLowerCase().includes('timeout');
      if (isDbDown) {
        return sendError(res, 503, 'database_unavailable', 'Notifications service temporarily unavailable');
      }
      return sendError(res, 503, error?.code ?? 'service_unavailable', error?.message ?? 'Service temporarily unavailable');
    }
  },
});

export default createAdminNotificationsController;
