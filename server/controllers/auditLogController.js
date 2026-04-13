import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAuditLogController = ({ logger, service }) => ({
  record: async (req, res) => {
    try {
      const result = await service.record({ req, res });
      if (result.error) {
        return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      }
      return sendOk(res, result.data, {
        status: result.status,
        code: result.code,
        message: result.message,
        meta: result.meta,
      });
    } catch (error) {
      logger.error('audit_log_route_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'audit_log_failed', 'Unable to process audit log request');
    }
  },
});

export default createAuditLogController;
