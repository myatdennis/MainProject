export const createReflectionsController = ({ logger, service }) => {
  const send = (res, result) => {
    if (!result) return;
    return res.status(result.status ?? 200).json(result.payload ?? null);
  };

  return {
    learnerGet: async (req, res) => {
      try {
        return send(res, await service.getLearnerReflection({ req, res }));
      } catch (error) {
        logger.error('learner_reflection_get_failed', {
          requestId: req.requestId ?? null,
          lessonId: req.params?.lessonId ?? req.query?.lessonId ?? req.query?.lesson_id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'reflection_fetch_failed', message: 'Unable to fetch reflection.' });
      }
    },
    learnerSave: async (req, res) => {
      try {
        return send(res, await service.saveLearnerReflection({ req, res }));
      } catch (error) {
        logger.error('learner_reflection_save_failed', {
          requestId: req.requestId ?? null,
          lessonId: req.params?.lessonId ?? req.body?.lessonId ?? req.body?.lesson_id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'reflection_save_failed', message: 'Unable to save reflection.' });
      }
    },
    adminLessonList: async (req, res) => {
      try {
        return send(res, await service.listAdminLessonReflections({ req, res }));
      } catch (error) {
        logger.error('admin_lesson_reflections_failed', {
          requestId: req.requestId ?? null,
          lessonId: req.params?.lessonId ?? req.query?.lessonId ?? req.query?.lesson_id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'reflection_fetch_failed', message: 'Unable to fetch lesson reflections.' });
      }
    },
    adminCourseList: async (req, res) => {
      try {
        return send(res, await service.listAdminCourseReflections({ req, res }));
      } catch (error) {
        logger.error('admin_course_reflections_failed', {
          requestId: req.requestId ?? null,
          courseId: req.params?.courseId ?? req.query?.courseId ?? req.query?.course_id ?? null,
          message: error?.message ?? String(error),
        });
        return res.status(500).json({ error: 'reflection_fetch_failed', message: 'Unable to fetch course reflections.' });
      }
    },
  };
};

export default createReflectionsController;
