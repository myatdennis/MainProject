import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAdminSurveysController = ({ logger, service }) => ({
  participantReport: async (req, res) => {
    try {
      const result = await service.getHdiParticipantReport({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_surveys_participant_report_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'hdi_participant_report_failed', 'Unable to load HDI participant report');
    }
  },
  cohortAnalytics: async (req, res) => {
    try {
      const result = await service.getHdiCohortAnalytics({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_surveys_cohort_analytics_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'hdi_cohort_analytics_failed', 'Unable to load HDI cohort analytics');
    }
  },
  prePostComparison: async (req, res) => {
    try {
      const result = await service.getHdiPrePostComparison({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_surveys_pre_post_comparison_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'hdi_pre_post_comparison_failed', 'Unable to load HDI pre/post comparison');
    }
  },
  results: async (req, res) => {
    try {
      const result = await service.getResults({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details, result.meta);
      return sendOk(res, result.data, { status: result.status, meta: result.meta });
    } catch (error) {
      logger.error('admin_surveys_results_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_results_failed', 'Unable to load survey results');
    }
  },
  hdiTemplate: async (_req, res) => {
    try {
      const result = await service.getHdiTemplate();
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_hdi_template_failed', { message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_template_fetch_failed', 'Unable to fetch survey template');
    }
  },
  list: async (req, res) => {
    try {
      const result = await service.listSurveys({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'surveys_fetch_failed', 'Unable to fetch surveys');
    }
  },
  detail: async (req, res) => {
    try {
      const result = await service.getSurvey({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_detail_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_fetch_failed', 'Unable to fetch survey');
    }
  },
  create: async (req, res) => {
    try {
      const result = await service.createSurvey({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_create_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_save_failed', 'Unable to save survey');
    }
  },
  update: async (req, res) => {
    try {
      const result = await service.updateSurvey({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_update_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_update_failed', 'Unable to update survey');
    }
  },
  delete: async (req, res) => {
    try {
      const result = await service.deleteSurvey({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      if (result.status === 204) return res.status(204).end();
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('admin_surveys_delete_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_delete_failed', 'Unable to delete survey');
    }
  },
});

export default createAdminSurveysController;
