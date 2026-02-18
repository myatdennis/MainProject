import express from 'express';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import {
  getSurveyById,
  listSurveyResponses,
  listSurveys,
  recordSurveyResponse,
  upsertSurvey,
  type SurveyUpsertInput,
} from '../data/mockSurveys.js';

const router = express.Router();

router.get('/admin/surveys', requireAdmin, (_req, res) => {
  res.json({ data: listSurveys() });
});

router.get('/admin/surveys/:id', requireAdmin, (req, res) => {
  const survey = getSurveyById(req.params.id);
  if (!survey) {
    return res.status(404).json({ error: 'Survey not found' });
  }
  res.json({ data: survey });
});

router.get('/admin/surveys/:id/responses', requireAdmin, (req, res) => {
  res.json({ data: listSurveyResponses(req.params.id) });
});

router.post('/admin/surveys', requireAdmin, (req, res) => {
  const survey = upsertSurvey(req.body as SurveyUpsertInput);
  res.status(201).json({ data: survey });
});

router.get('/client/surveys', (req: AuthenticatedRequest, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const surveys = status ? listSurveys(status as any) : listSurveys('published');
  res.json({ data: surveys });
});

router.post('/client/surveys/:id/submit', requireAuth, (req: AuthenticatedRequest, res) => {
  const survey = getSurveyById(req.params.id);
  if (!survey) {
    return res.status(404).json({ error: 'Survey not found' });
  }
  const response = recordSurveyResponse(survey.id, req.body, req.user?.userId);
  res.status(201).json({ data: response });
});

export default router;
