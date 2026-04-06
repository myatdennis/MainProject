import { describe, expect, it } from 'vitest';
import {
  buildParticipantIdentity,
  normalizeHdiAdministrationType,
  validateHdiSubmissionContract,
} from '../hdiContracts.js';
import { buildHdiComparison, buildHdiCohortAnalytics } from '../hdiAnalytics.js';

describe('HDI contract helpers', () => {
  it('builds deterministic participant identity keys (happy path)', () => {
    const identity = buildParticipantIdentity({
      userId: 'USER-123',
      userEmail: 'Leader@Example.com',
      metadata: {
        participantKey: 'P-001',
        participant: { confidentialCode: 'ABC-999' },
      },
      assignmentMetadata: {
        participant_key: 'P-001',
      },
    });

    expect(identity.participantKey).toBe('P-001');
    expect(identity.participantKeys).toContain('user-123');
    expect(identity.participantKeys).toContain('leader@example.com');
    expect(identity.participantKeys).toContain('p-001');
    expect(identity.participantKeys).toContain('abc-999');
  });

  it('rejects malformed pre-assessment linking payloads', () => {
    const validation = validateHdiSubmissionContract({
      administrationType: 'pre',
      linkedAssessmentId: 'resp-123',
      participantKeys: ['user-1'],
    });

    expect(validation.ok).toBe(false);
    expect(validation.code).toBe('invalid_hdi_linking');
  });

  it('normalizes administration aliases to stable types', () => {
    expect(normalizeHdiAdministrationType('follow-up')).toBe('pulse');
    expect(normalizeHdiAdministrationType('POST')).toBe('post');
    expect(normalizeHdiAdministrationType('')).toBe('single');
  });
});

describe('HDI pre/post matching edge behavior', () => {
  it('prefers linkedAssessmentId matching for pre/post comparisons', () => {
    const pre = {
      id: 'pre-linked',
      scoring: {
        developmentalOrientation: { score: 3, normalizedScore: 0.4, primaryStage: { label: 'Minimization' } },
        stageScores: {},
        normalizedScores: {},
      },
      report: {
        developmentalOrientation: { score: 3 },
        stageScores: {},
        normalizedScores: {},
      },
    };
    const post = {
      id: 'post-1',
      scoring: {
        developmentalOrientation: { score: 4, normalizedScore: 1.2, primaryStage: { label: 'Acceptance' } },
        stageScores: {},
        normalizedScores: {},
      },
      report: {
        developmentalOrientation: { score: 4 },
        stageScores: {},
        normalizedScores: {},
      },
    };

    const comparison = buildHdiComparison({ pre, post });
    expect(comparison).toBeTruthy();
    expect(comparison.preResponseId).toBe('pre-linked');
    expect(comparison.postResponseId).toBe('post-1');
  });

  it('returns zero matched comparisons when no pre records exist for post responses', () => {
    const rows = [
      {
        id: 'post-row-1',
        survey_id: 'survey-1',
        user_id: 'u-1',
        metadata: {
          hdi: {
            administrationType: 'post',
            scoring: {
              developmentalOrientation: { score: 4, normalizedScore: 1.1, primaryStage: { label: 'Acceptance' } },
              stageScores: {},
              normalizedScores: {},
            },
            report: {
              developmentalOrientation: { score: 4 },
              stageScores: {},
              normalizedScores: {},
            },
          },
        },
        completed_at: '2026-04-01T00:00:00.000Z',
      },
    ];

    const cohort = buildHdiCohortAnalytics(rows);
    expect(cohort.totalPost).toBe(1);
    expect(cohort.totalPre).toBe(0);
    expect(cohort.matchedComparisons).toBe(0);
  });
});
