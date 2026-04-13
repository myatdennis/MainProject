export const createCourseAdvancedController = ({ logger, service }) => ({
  importCourses: async (req, res) => {
    try {
      await service.importCourses({ req, res });
    } catch (error) {
      logger.error('admin_courses_import_failed', {
        requestId: req.requestId ?? null,
        message: error?.message ?? String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          code: 'import_failed',
          error: 'import_failed',
          message: 'Import failed',
          meta: { requestId: req.requestId ?? null },
        });
      }
    }
  },

  publishCourse: async (req, res) => {
    try {
      await service.publishCourse({ req, res });
    } catch (error) {
      logger.error('admin_courses_publish_failed', {
        requestId: req.requestId ?? null,
        courseId: req.params.id ?? null,
        message: error?.message ?? String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          code: 'publish_failed',
          error: 'publish_failed',
          message: 'Unable to publish course',
          meta: { requestId: req.requestId ?? null },
        });
      }
    }
  },
});

export default createCourseAdvancedController;
