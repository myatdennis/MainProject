import { describe, expect, it } from 'vitest';
import {
  createHdiResponseEnvelope,
  HDI_RESPONSE_CONTRACT_VERSION,
  HDI_RESPONSE_SHAPES,
} from '../hdiResponseContracts.js';

describe('HDI response contracts', () => {
  it('builds typed response envelope with stable contract version', () => {
    const envelope = createHdiResponseEnvelope(HDI_RESPONSE_SHAPES.COHORT_ANALYTICS, { totalResponses: 10 }, { surveyId: 's1' });

    expect(envelope.contract.shape).toBe(HDI_RESPONSE_SHAPES.COHORT_ANALYTICS);
    expect(envelope.contract.version).toBe(HDI_RESPONSE_CONTRACT_VERSION);
    expect(envelope.data.totalResponses).toBe(10);
    expect(envelope.meta.surveyId).toBe('s1');
  });
});
