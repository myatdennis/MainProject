export const HDI_RESPONSE_CONTRACT_VERSION = '2026-04-hdi-response-v1';

export const HDI_RESPONSE_SHAPES = {
  PARTICIPANT_REPORT: 'hdi.participant-report.v1',
  COHORT_ANALYTICS: 'hdi.cohort-analytics.v1',
  PRE_POST_COMPARISON: 'hdi.pre-post-comparison.v1',
  LEARNER_RESULTS: 'hdi.learner-results.v1',
};

export const createHdiResponseEnvelope = (shape, data, meta = {}) => ({
  contract: {
    shape,
    version: HDI_RESPONSE_CONTRACT_VERSION,
  },
  data,
  meta: {
    ...(meta && typeof meta === 'object' ? meta : {}),
  },
});
