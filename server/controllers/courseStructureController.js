export const createCourseStructureController = ({ logger, service }) => ({
  createModule: async (req, res) => {
    try {
      await service.createModule({ req, res });
    } catch (error) {
      logger.error('admin_module_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to create module' });
    }
  },
  updateModule: async (req, res) => {
    try {
      await service.updateModule({ req, res });
    } catch (error) {
      logger.error('admin_module_update_failed', { requestId: req.requestId ?? null, moduleId: req.params.id ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to update module' });
    }
  },
  deleteModule: async (req, res) => {
    try {
      await service.deleteModule({ req, res });
    } catch (error) {
      logger.error('admin_module_delete_failed', { requestId: req.requestId ?? null, moduleId: req.params.id ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to delete module' });
    }
  },
  reorderModules: async (req, res) => {
    try {
      await service.reorderModules({ req, res });
    } catch (error) {
      logger.error('admin_module_reorder_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to reorder modules' });
    }
  },
  createLesson: async (req, res) => {
    try {
      await service.createLesson({ req, res });
    } catch (error) {
      logger.error('admin_lesson_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to create lesson' });
    }
  },
  updateLesson: async (req, res) => {
    try {
      await service.updateLesson({ req, res });
    } catch (error) {
      logger.error('admin_lesson_update_failed', { requestId: req.requestId ?? null, lessonId: req.params.id ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to update lesson' });
    }
  },
  deleteLesson: async (req, res) => {
    try {
      await service.deleteLesson({ req, res });
    } catch (error) {
      logger.error('admin_lesson_delete_failed', { requestId: req.requestId ?? null, lessonId: req.params.id ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to delete lesson' });
    }
  },
  reorderLessons: async (req, res) => {
    try {
      await service.reorderLessons({ req, res });
    } catch (error) {
      logger.error('admin_lesson_reorder_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      if (!res.headersSent) res.status(500).json({ error: 'Unable to reorder lessons' });
    }
  },
});

export default createCourseStructureController;
