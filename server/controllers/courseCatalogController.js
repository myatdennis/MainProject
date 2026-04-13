export const createCourseCatalogController = ({ logger, service }) => ({
  adminList: async (req, res) => {
    try {
      const result = await service.adminListCourses({ req, res });
      if (!result) return;
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('admin_courses_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return res.status(500).json({ error: 'Unable to fetch courses' });
    }
  },
  adminDetail: async (req, res) => {
    try {
      const result = await service.adminGetCourse({ req, res });
      if (!result) return;
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('admin_courses_detail_failed', { requestId: req.requestId ?? null, identifier: req.params.identifier, message: error?.message ?? String(error) });
      return res.status(500).json({ error: 'Unable to fetch course' });
    }
  },
  clientList: async (req, res) => {
    try {
      const result = await service.clientListCourses({ req, res });
      if (!result) return;
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('client_courses_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return res.status(500).json({ ok: false, code: 'catalog_fetch_failed', message: 'Unable to fetch courses.' });
    }
  },
  clientDetail: async (req, res) => {
    try {
      const result = await service.clientGetCourse({ req, res });
      if (!result) return;
      return res.status(result.status).json(result.body);
    } catch (error) {
      logger.error('client_courses_detail_failed', { requestId: req.requestId ?? null, identifier: req.params.courseIdentifier, message: error?.message ?? String(error) });
      return res.status(500).json({ ok: false, code: 'course_fetch_failed', message: 'Unable to load course.' });
    }
  },
});

export default createCourseCatalogController;
