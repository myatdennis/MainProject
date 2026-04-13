export const createProgressReadController = ({ logger, service }) => {
  const send = (res, result) => {
    if (!result) return;
    return res.status(result.status ?? 200).json(result.payload ?? null);
  };

  return {
    learnerProgress: async (req, res) => {
      try {
        return send(res, await service.getLearnerProgress({ req, res }));
      } catch (error) {
        logger.error('learner_progress_read_failed', {
          requestId: req.requestId ?? null,
          userId: req.user?.userId ?? req.user?.id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({
          ok: false,
          code: 'progress_fetch_failed',
          message: 'Unable to fetch progress',
          requestId: req.requestId ?? null,
          hint: error?.hint ?? null,
          details: error?.message ?? null,
        });
      }
    },
    clientSummary: async (req, res) => {
      try {
        return send(res, await service.getClientProgressSummary({ req, res }));
      } catch (error) {
        logger.warn('client_progress_summary_failed', {
          requestId: req.requestId ?? null,
          userId: req.user?.userId ?? req.user?.id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'Unable to fetch progress summary' });
      }
    },
  };
};

export default createProgressReadController;
