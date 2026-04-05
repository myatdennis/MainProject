import { describe, expect, it } from 'vitest';
import { buildHdiSurveyTemplate } from '../hdiTemplate.js';
import { scoreHdiSubmission } from '../hdiScoring.js';
import { generateHdiFeedback } from '../hdiFeedback.js';
import { buildHdiCohortAnalytics, buildHdiComparison } from '../hdiAnalytics.js';

const templateSurvey = {
  type: 'hdi',
  sections: buildHdiSurveyTemplate().sections,
};

const allQuestionIds = templateSurvey.sections[0].questions.map((question) => question.id);
const reverseQuestionIds = ['hdi-q-25', 'hdi-q-26', 'hdi-q-27', 'hdi-q-28'];

const buildResponses = ({ base = 4, reverse = 1 } = {}) =>
  allQuestionIds.reduce((acc, id) => {
    acc[id] = reverseQuestionIds.includes(id) ? reverse : base;
    return acc;
  }, {});

describe('HDI scoring engine', () => {
  it('scores core dimensions and applies reverse scoring', () => {
    const scoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 4, reverse: 1 }),
    });

    expect(scoring.dimensionScores.length).toBeGreaterThanOrEqual(6);
    expect(scoring.overall.rawAverage).toBe(4);
    expect(scoring.overall.normalizedScore).toBe(75);
    expect(scoring.overall.band).toBe('Practicing');

    const reverseSample = scoring.scoredItems.find((item) => item.questionId === 'hdi-q-25');
    expect(reverseSample?.raw).toBe(1);
    expect(reverseSample?.scored).toBe(5);
  });

  it('produces individualized feedback from scoring output', () => {
    const scoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 3, reverse: 3 }),
    });

    const feedback = generateHdiFeedback({ scoring });

    expect(feedback.profile).toBeTruthy();
    expect(feedback.overallSummary.length).toBeGreaterThan(20);
    expect(feedback.topStrengths).toHaveLength(2);
    expect(feedback.growthAreas).toHaveLength(2);
    expect(feedback.practicalNextStep.length).toBeGreaterThan(20);
  });

  it('computes pre/post cohort analytics and meaningful growth', () => {
    const preScoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 3, reverse: 3 }),
    });
    const postScoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 4, reverse: 2 }),
    });

    const comparison = buildHdiComparison({
      pre: {
        id: 'pre-1',
        userId: 'user-1',
        participantKeys: ['user-1'],
        administrationType: 'pre',
        scoring: preScoring,
      },
      post: {
        id: 'post-1',
        userId: 'user-1',
        participantKeys: ['user-1'],
        administrationType: 'post',
        scoring: postScoring,
      },
    });

    expect(comparison?.deltaNormalized).toBeGreaterThan(5);
    expect(comparison?.growthBand).toMatch(/Meaningful|Strong/);

    const rows = [
      {
        id: 'pre-row',
        survey_id: 'survey-1',
        user_id: 'user-1',
        metadata: {
          hdi: {
            administrationType: 'pre',
            scoring: preScoring,
            feedback: generateHdiFeedback({ scoring: preScoring }),
          },
        },
        completed_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'post-row',
        survey_id: 'survey-1',
        user_id: 'user-1',
        metadata: {
          hdi: {
            administrationType: 'post',
            scoring: postScoring,
            feedback: generateHdiFeedback({ scoring: postScoring }),
          },
        },
        completed_at: '2026-02-01T00:00:00.000Z',
      },
    ];

    const cohort = buildHdiCohortAnalytics(rows);
    expect(cohort.totalPre).toBe(1);
    expect(cohort.totalPost).toBe(1);
    expect(cohort.matchedComparisons).toBe(1);
    expect(cohort.averageDelta).toBeGreaterThan(5);
    expect(cohort.meaningfulImprovementPercent).toBe(100);
  });
});
