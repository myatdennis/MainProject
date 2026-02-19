import express from 'express';
import {
  assignCourse,
  deleteCourse,
  getCourseByIdentifier,
  listCoursesForOrg,
  listPublishedCourses,
  publishCourse,
  upsertCourse,
  type CourseUpsertInput,
} from '../data/mockCourses.js';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { requireOrgContext, type OrgScopedRequest } from '../middleware/orgContext.js';
import { assertOrgAccess } from '../data/mockOrganizations.js';

const router = express.Router();

router.get('/client/courses', async (req, res) => {
  const assignedOnly = String(req.query.assigned || 'false').toLowerCase() === 'true';
  const orgId = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : undefined;

  if (assignedOnly && !orgId) {
    return res.status(400).json({ error: 'orgId is required when assigned=true' });
  }

  try {
    const data = await listPublishedCourses({ assignedOnly, orgId });
    res.json({ data });
  } catch (error) {
    console.error('[courses] list client courses failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/client/courses/:identifier', async (req, res) => {
  try {
    const course = await getCourseByIdentifier(req.params.identifier);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ data: course });
  } catch (error) {
    console.error('[courses] fetch client course failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/admin/courses', requireAdmin, requireOrgContext, async (req: OrgScopedRequest, res) => {
  try {
    const orgId = req.orgContext!.orgId;
    const data = await listCoursesForOrg(orgId);
    res.json({ data, orgId });
  } catch (error) {
    console.error('[courses] admin list failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin/courses', requireAdmin, requireOrgContext, async (req: OrgScopedRequest, res) => {
  try {
    const course = await upsertCourse(req.body as CourseUpsertInput);
    await assignCourse(course.id, req.orgContext!.orgId);
    res.status(201).json({ data: course, orgId: req.orgContext!.orgId });
  } catch (error) {
    console.error('[courses] admin create failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin/courses/import', requireAdmin, requireOrgContext, async (req: OrgScopedRequest, res) => {
  const payload: CourseUpsertInput[] = Array.isArray(req.body?.courses) ? req.body.courses : [];
  if (payload.length === 0) {
    return res.status(400).json({ error: 'courses array is required' });
  }
  try {
    const imported: any[] = [];
    for (const courseInput of payload) {
      const record = await upsertCourse(courseInput);
      await assignCourse(record.id, req.orgContext!.orgId);
      imported.push(record);
    }
    res.json({ data: imported, count: imported.length });
  } catch (error) {
    console.error('[courses] import failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin/courses/:id/publish', requireAdmin, requireOrgContext, async (req, res) => {
  try {
    const course = await publishCourse(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ data: course });
  } catch (error) {
    console.error('[courses] publish failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin/courses/:id/assign', requireAdmin, requireOrgContext, async (req: OrgScopedRequest, res) => {
  const { organization_id, organizationId } = req.body ?? {};
  const fallbackOrg = req.orgContext?.orgId;
  const requestedOrgId = organization_id ?? organizationId ?? fallbackOrg;
  if (!requestedOrgId) {
    return res.status(400).json({ error: 'organization_id is required' });
  }
  const access = assertOrgAccess(req.user!.userId, String(requestedOrgId));
  if (!access) {
    return res.status(403).json({ error: 'org_access_denied' });
  }
  try {
    const assignment = await assignCourse(req.params.id, access.organization.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ data: assignment });
  } catch (error) {
    console.error('[courses] assign failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/admin/courses/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteCourse(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('[courses] delete failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});
export default router;
