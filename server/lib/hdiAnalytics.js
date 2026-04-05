import { computeGrowthBand } from './hdiScoring.js';
import { compareHdiReports } from './hdiComparison.js';

const stableKeyCandidates = (response = {}) => {
  const metadata = response?.metadata && typeof response.metadata === 'object' ? response.metadata : {};
  const participant = metadata?.participant && typeof metadata.participant === 'object' ? metadata.participant : {};
  return [
    response.user_id,
    metadata.participantKey,
    metadata.participant_key,
    participant.key,
    metadata.email,
    participant.email,
    metadata.confidentialCode,
    metadata.confidential_code,
    participant.confidentialCode,
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
};

export const toHdiRecord = (row = {}) => {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const hdi = metadata?.hdi && typeof metadata.hdi === 'object' ? metadata.hdi : null;
  if (!hdi?.scoring && !hdi?.report) return null;

  const scoring = hdi?.scoring ?? null;
  const report = hdi?.report ?? null;
  const profile = hdi?.profile ?? report?.profile ?? null;

  return {
    id: row.id,
    surveyId: row.survey_id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    completedAt: row.completed_at ?? row.created_at ?? null,
    administrationType: String(hdi.administrationType ?? metadata.administrationType ?? 'single').toLowerCase(),
    linkedAssessmentId: hdi.linkedAssessmentId ?? metadata.linkedAssessmentId ?? null,
    participantKeys: stableKeyCandidates(row),
    scoring,
    report,
    profile,
    feedback: hdi.feedback ?? null,
  };
};

const avg = (values = []) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 100) / 100;
};

export const buildHdiParticipantRows = (responseRows = []) => {
  const rows = responseRows.map(toHdiRecord).filter(Boolean);
  return rows.map((record) => ({
    responseId: record.id,
    participantIdentifier: record.participantKeys[0] ?? record.userId ?? 'anonymous',
    assessmentDate: record.completedAt,
    administrationType: record.administrationType,
    overallScore: record.scoring?.developmentalOrientation?.score ?? record.scoring?.doScore ?? 0,
    normalizedScore: record.scoring?.developmentalOrientation?.normalizedScore ?? record.scoring?.overall?.normalizedScore ?? 0,
    rawAverage: record.scoring?.developmentalOrientation?.score ?? record.scoring?.overall?.rawAverage ?? 0,
    scoreBand: record.scoring?.developmentalOrientation?.primaryStage?.label ?? record.scoring?.overall?.band ?? 'Unknown',
    stagePlacement: record.report?.stagePlacement ?? {
      primaryStage: record.scoring?.primaryStage ?? null,
      secondaryStage: record.scoring?.secondaryStage ?? null,
    },
    stageScores: record.scoring?.stageScores ?? {},
    normalizedScores: record.scoring?.normalizedScores ?? {},
    topStrengths: record.report?.strengths ?? [],
    growthAreas: record.report?.growthAreas ?? [],
    individualizedInsight: record.report?.summary ?? record.feedback?.overallSummary ?? '',
    practicalNextStep: record.profile?.nextAction ?? record.feedback?.practicalNextStep ?? '',
    profile: record.profile ?? record.report?.profile ?? null,
  }));
};

export const buildHdiComparison = ({ pre = null, post = null }) => {
  if (!pre || !post) return null;
  const preReport = pre.report ?? {
    stageScores: pre.scoring?.stageScores ?? {},
    normalizedScores: pre.scoring?.normalizedScores ?? {},
    developmentalOrientation: pre.scoring?.developmentalOrientation ?? null,
    stagePlacement: {
      primaryStage: pre.scoring?.primaryStage ?? null,
      secondaryStage: pre.scoring?.secondaryStage ?? null,
    },
  };
  const postReport = post.report ?? {
    stageScores: post.scoring?.stageScores ?? {},
    normalizedScores: post.scoring?.normalizedScores ?? {},
    developmentalOrientation: post.scoring?.developmentalOrientation ?? null,
    stagePlacement: {
      primaryStage: post.scoring?.primaryStage ?? null,
      secondaryStage: post.scoring?.secondaryStage ?? null,
    },
  };

  const comparison = compareHdiReports({ preReport, postReport });
  if (!comparison) return null;

  return {
    preResponseId: pre.id,
    postResponseId: post.id,
    preScore: preReport?.developmentalOrientation?.score ?? null,
    postScore: postReport?.developmentalOrientation?.score ?? null,
    deltaNormalized: comparison.doScoreDelta,
    growthBand: comparison.growthBand ?? computeGrowthBand(comparison.doScoreDelta),
    dimensionDelta: comparison.dimensionGrowth,
    stageMovement: comparison.stageMovement,
    recommendedFocus: comparison.recommendedFocus,
    improvementSummary: comparison.improvementSummary,
  };
};

const matchPreForPost = (postRecord, preRecords = []) => {
  if (!postRecord) return null;

  if (postRecord.linkedAssessmentId) {
    const linked = preRecords.find((candidate) => candidate.id === postRecord.linkedAssessmentId);
    if (linked) return linked;
  }

  if (postRecord.participantKeys.length > 0) {
    const keySet = new Set(postRecord.participantKeys);
    const matched = preRecords.find((candidate) => candidate.participantKeys.some((key) => keySet.has(key)));
    if (matched) return matched;
  }

  if (postRecord.userId) {
    const matched = preRecords.find((candidate) => candidate.userId && String(candidate.userId) === String(postRecord.userId));
    if (matched) return matched;
  }

  return null;
};

export const buildHdiCohortAnalytics = (responseRows = []) => {
  const records = responseRows.map(toHdiRecord).filter(Boolean);
  const preRecords = records.filter((record) => record.administrationType === 'pre');
  const postRecords = records.filter((record) => record.administrationType === 'post');

  const comparisons = postRecords
    .map((post) => {
      const pre = matchPreForPost(post, preRecords);
      if (!pre) return null;
      return buildHdiComparison({ pre, post });
    })
    .filter(Boolean);

  const avgOverallPre = avg(preRecords.map((record) => record.scoring?.developmentalOrientation?.score));
  const avgOverallPost = avg(postRecords.map((record) => record.scoring?.developmentalOrientation?.score));
  const delta = Math.round((avgOverallPost - avgOverallPre) * 100) / 100;

  const byDimension = new Map();
  const collectDimension = (source, bucket) => {
    const stageScores = source?.scoring?.stageScores ?? {};
    Object.entries(source?.scoring?.normalizedScores ?? {}).forEach(([stageKey, normalizedScore]) => {
      if (!byDimension.has(stageKey)) {
        byDimension.set(stageKey, {
          key: stageKey,
          label: stageScores?.[stageKey]?.label ?? stageKey,
          pre: [],
          post: [],
        });
      }
      byDimension.get(stageKey)[bucket].push(normalizedScore);
    });
  };
  preRecords.forEach((record) => collectDimension(record, 'pre'));
  postRecords.forEach((record) => collectDimension(record, 'post'));

  const dimensionAverages = Array.from(byDimension.values()).map((dimension) => {
    const pre = avg(dimension.pre);
    const post = avg(dimension.post);
    return {
      key: dimension.key,
      label: dimension.label,
      pre,
      post,
      delta: Math.round((post - pre) * 100) / 100,
    };
  });

  const distribution = records.reduce(
    (acc, record) => {
  const band = String(record.scoring?.developmentalOrientation?.primaryStage?.label ?? 'Unknown');
      acc[band] = (acc[band] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const meaningfulThresholdCount = comparisons.filter((comparison) => comparison.deltaNormalized >= 0.35).length;

  return {
    totalResponses: records.length,
    totalPre: preRecords.length,
    totalPost: postRecords.length,
    matchedComparisons: comparisons.length,
    averageOverallPre: avgOverallPre,
    averageOverallPost: avgOverallPost,
    averageDelta: delta,
    dimensionAverages,
    scoreBandDistribution: distribution,
    meaningfulImprovementPercent:
      comparisons.length > 0 ? Math.round((meaningfulThresholdCount / comparisons.length) * 10000) / 100 : 0,
    growthBreakdown: {
      minimal: comparisons.filter((comparison) => comparison.deltaNormalized >= 0.1 && comparison.deltaNormalized < 0.35).length,
      meaningful: comparisons.filter((comparison) => comparison.deltaNormalized >= 0.35 && comparison.deltaNormalized < 0.75).length,
      strong: comparisons.filter((comparison) => comparison.deltaNormalized >= 0.75).length,
    },
  };
};
