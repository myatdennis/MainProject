import { describe, expect, it } from 'vitest';
import { buildHdiSurveyTemplate } from '../hdiTemplate.js';
import { scoreHdiSubmission } from '../hdiScoring.js';
import { buildHdiProfile } from '../hdiProfiles.js';
import { buildHdiReport } from '../hdiReportBuilder.js';
import { compareHdiReports } from '../hdiComparison.js';
import { buildHdiCohortAnalytics } from '../hdiAnalytics.js';

const templateSurvey = {
  type: 'hdi',
  sections: buildHdiSurveyTemplate().sections,
};

const allQuestionIds = templateSurvey.sections[0].questions.map((question) => question.id);
const buildResponses = ({ base = 4 } = {}) =>
  allQuestionIds.reduce((acc, id) => {
    acc[id] = base;
    return acc;
  }, {});

describe('HDI scoring engine', () => {
  it('computes stage scores and developmental orientation mapping', () => {
    const scoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 4 }),
    });

    expect(scoring.validation.isValid).toBe(true);
    expect(scoring.stageScores.avoidance.average).toBe(4);
    expect(scoring.stageScores.integration.average).toBe(4);
    expect(scoring.developmentalOrientation.score).toBe(4);
    expect(scoring.developmentalOrientation.primaryStage.label).toBe('Acceptance');
  });

  it('assigns profile and builds structured report', () => {
    const scoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 3 }),
    });

    const profile = buildHdiProfile({ scoring });
    const report = buildHdiReport({
      participant: { userId: 'user-1' },
      scoring,
      profile,
    });

    expect(profile.name).toBeTruthy();
    expect(profile.nextAction.length).toBeGreaterThan(20);
    expect(report.stagePlacement.primaryStage.label).toBeTruthy();
    expect(Array.isArray(report.strengths)).toBe(true);
    expect(Array.isArray(report.growthAreas)).toBe(true);
  });

  it('computes pre/post comparison and cohort analytics', () => {
    const preScoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 3 }),
    });
    const postScoring = scoreHdiSubmission({
      survey: templateSurvey,
      responses: buildResponses({ base: 4 }),
    });

    const preProfile = buildHdiProfile({ scoring: preScoring });
    const postProfile = buildHdiProfile({ scoring: postScoring });

    const preReport = buildHdiReport({ participant: { userId: 'user-1' }, scoring: preScoring, profile: preProfile });
    const postReport = buildHdiReport({ participant: { userId: 'user-1' }, scoring: postScoring, profile: postProfile });

    const comparison = compareHdiReports({
      preReport,
      postReport,
    });

    expect(comparison?.doScoreDelta).toBeGreaterThan(0.75);
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
            report: preReport,
            profile: preProfile,
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
            report: postReport,
            profile: postProfile,
          },
        },
        completed_at: '2026-02-01T00:00:00.000Z',
      },
    ];

    const cohort = buildHdiCohortAnalytics(rows);
    expect(cohort.totalPre).toBe(1);
    expect(cohort.totalPost).toBe(1);
    expect(cohort.matchedComparisons).toBe(1);
    expect(cohort.averageDelta).toBeGreaterThan(0.75);
    expect(cohort.meaningfulImprovementPercent).toBe(100);
  });
});
