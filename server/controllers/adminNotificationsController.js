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
      return sendError(res, 500, 'notifications_fetch_failed', 'Unable to fetch notifications');
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
      return sendError(res, 500, 'notifications_create_failed', 'Unable to create notification');
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
      return sendError(res, 500, 'notifications_broadcast_failed', 'Unable to broadcast notifications');
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
      return sendError(res, 500, 'notifications_update_failed', 'Unable to update notification');
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
      return sendError(res, 500, 'notifications_delete_failed', 'Unable to delete notification');
    }
  },
});

export default createAdminNotificationsController;
