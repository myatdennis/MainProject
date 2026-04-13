export const createCourseManagementController = ({ logger, service }) => ({
  create: async (req, res) => {
    try {
      const result = await service.createCourse({ req, res });
      if (!result) return;
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('admin_courses_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return res.status(500).json({ error: 'Unable to save course' });
    }
  },
  update: async (req, res) => {
    try {
      const result = await service.updateCourse({ req, res });
      if (!result) return;
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('admin_courses_update_failed', { requestId: req.requestId ?? null, courseId: req.params.id, message: error?.message ?? String(error) });
      return res.status(500).json({ error: 'Unable to save course' });
    }
  },
  delete: async (req, res) => {
    try {
      const result = await service.deleteCourse({ req, res });
      if (!result) return;
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('admin_courses_delete_failed', { requestId: req.requestId ?? null, courseId: req.params.id, message: error?.message ?? String(error) });
      return res.status(500).json({ error: 'Unable to delete course' });
    }
  },
});

export default createCourseManagementController;
