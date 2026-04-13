import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAdminCrmController = ({ logger, service }) => ({
  summary: async (req, res) => {
    try {
      const result = await service.loadSummary({ req, res });
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_crm_summary_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'crm_summary_failed', 'Unable to load CRM summary');
    }
  },
  activity: async (req, res) => {
    try {
      const result = await service.loadActivity({ req, res });
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_crm_activity_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'crm_activity_failed', 'Unable to load CRM activity');
    }
  },
});

export default createAdminCrmController;
