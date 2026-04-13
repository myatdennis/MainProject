export const createProgressWriteController = ({ logger, service }) => {
  const send = (res, result) => {
    if (!result) return;
    return res.status(result.status ?? 200).json(result.payload ?? null);
  };

  return {
    learnerSnapshot: async (req, res) => {
      try {
        return send(res, await service.saveLearnerSnapshot({ req, res }));
      } catch (error) {
        logger.error('learner_progress_snapshot_unhandled', {
          requestId: req.requestId ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({
          ok: false,
          code: 'progress_sync_failed',
          message: error?.message || 'Unable to sync progress',
          requestId: req.requestId ?? null,
        });
      }
    },
    clientCourse: async (req, res) => {
      try {
        return send(res, await service.saveClientCourseProgress({ req, res }));
      } catch (error) {
        logger.error('client_course_progress_unhandled', {
          requestId: req.requestId ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'Unable to save course progress' });
      }
    },
    clientLesson: async (req, res) => {
      try {
        return send(res, await service.saveClientLessonProgress({ req, res }));
      } catch (error) {
        logger.error('client_lesson_progress_unhandled', {
          requestId: req.requestId ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'Unable to save lesson progress' });
      }
    },
    clientBatch: async (req, res) => {
      try {
        return send(res, await service.saveClientProgressBatch({ req, res }));
      } catch (error) {
        logger.error('client_progress_batch_unhandled', {
          requestId: req.requestId ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'Unable to process batch' });
      }
    },
  };
};

export default createProgressWriteController;
