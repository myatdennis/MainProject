import { sendError } from '../lib/apiEnvelope.js';
import { buildClientMePayload, createClientPortalService } from '../services/clientPortalService.js';

export const createClientPortalController = ({
  logger,
  supabase,
  e2eStore,
  isDemoOrTestMode,
  ensureSupabase,
  requireUserContext,
}) => {
  const service = createClientPortalService({
    logger,
    supabase,
    e2eStore,
    isDemoOrTestMode,
  });

  const getClientMe = async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;

    return service.respondClientMe(
      res,
      buildClientMePayload({
        context,
        sessionUser: req.user || {},
      }),
    );
  };

  const getClientActivity = async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    if (!isDemoOrTestMode && !ensureSupabase(res)) {
      return;
    }

    try {
      const activities = await service.loadClientActivity({
        userId: context.userId,
        limit,
      });
      return service.respondClientMe(res, activities);
    } catch (error) {
      if (!isDemoOrTestMode && !supabase) {
        return sendError(res, 503, 'database_unavailable', 'Database unavailable');
      }
      return service.handleClientActivityError(res, error, context.userId);
    }
  };

  return {
    getClientMe,
    getClientActivity,
  };
};

