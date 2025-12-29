import express from 'express';
import {
  assignCourse,
  deleteCourse,
  getCourseByIdentifier,
  listAllCourses,
  listPublishedCourses,
  publishCourse,
  upsertCourse,
  type CourseUpsertInput,
} from '../data/mockCourses';
import { requireAdmin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/client/courses', (req, res) => {
  const assignedOnly = String(req.query.assigned || 'false').toLowerCase() === 'true';
  const orgId = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : undefined;

  if (assignedOnly && !orgId) {
    return res.status(400).json({ error: 'orgId is required when assigned=true' });
  }

  res.json({ data: listPublishedCourses({ assignedOnly, orgId }) });
});

router.get('/client/courses/:identifier', (req, res) => {
  const course = getCourseByIdentifier(req.params.identifier);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json({ data: course });
});

router.get('/admin/courses', requireAdmin, (_req, res) => {
  res.json({ data: listAllCourses() });
});

router.post('/admin/courses', requireAdmin, (req, res) => {
  const course = upsertCourse(req.body as CourseUpsertInput);
  res.status(201).json({ data: course });
});

router.post('/admin/courses/import', requireAdmin, (req, res) => {
  const payload: CourseUpsertInput[] = Array.isArray(req.body?.courses) ? req.body.courses : [];
  const imported = payload.map((course: CourseUpsertInput) => upsertCourse(course));
  res.json({ data: imported, count: imported.length });
});

router.post('/admin/courses/:id/publish', requireAdmin, (req, res) => {
  const course = publishCourse(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json({ data: course });
});

router.post('/admin/courses/:id/assign', requireAdmin, (req, res) => {
  const { organization_id, organizationId } = req.body ?? {};
  const orgId = organization_id ?? organizationId;
  if (!orgId) {
    return res.status(400).json({ error: 'organization_id is required' });
  }
  const assignment = assignCourse(req.params.id, String(orgId));
  if (!assignment) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json({ data: assignment });
});

router.delete('/admin/courses/:id', requireAdmin, (req, res) => {
  const deleted = deleteCourse(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.status(204).send();
});

export default router;
