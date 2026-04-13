import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createClientSurveysController = ({ logger, service }) => ({
  list: async (req, res) => {
    try {
      const result = await service.listClientSurveys({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('client_surveys_list_failed', { requestId: req.requestId ?? null, message: error?.message ?? String(error) });
      return sendError(res, 500, 'client_surveys_fetch_failed', 'Unable to fetch client surveys');
    }
  },
  submit: async (req, res) => {
    try {
      const result = await service.submitClientSurvey({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('client_surveys_submit_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_submit_failed', 'Unable to submit survey response');
    }
  },
  results: async (req, res) => {
    try {
      const result = await service.getClientSurveyResults({ req, res });
      if (!result) return;
      if (result.error) return sendError(res, result.status, result.error.code, result.error.message, result.error.details);
      return sendOk(res, result.data, { status: result.status });
    } catch (error) {
      logger.error('client_surveys_results_failed', { requestId: req.requestId ?? null, surveyId: req.params.id, message: error?.message ?? String(error) });
      return sendError(res, 500, 'survey_results_failed', 'Unable to load survey results');
    }
  },
});

export default createClientSurveysController;
