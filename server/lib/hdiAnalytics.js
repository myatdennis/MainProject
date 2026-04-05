import { computeGrowthBand } from './hdiScoring.js';

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
  if (!hdi?.scoring) return null;

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
    scoring: hdi.scoring,
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
    overallScore: record.scoring?.overall?.normalizedScore ?? 0,
    rawAverage: record.scoring?.overall?.rawAverage ?? 0,
    scoreBand: record.scoring?.overall?.band ?? 'Unknown',
    dimensionScores: record.scoring?.dimensionScores ?? [],
    topStrengths: record.feedback?.topStrengths ?? [],
    growthAreas: record.feedback?.growthAreas ?? [],
    individualizedInsight: record.feedback?.overallSummary ?? '',
    practicalNextStep: record.feedback?.practicalNextStep ?? '',
  }));
};

export const buildHdiComparison = ({ pre = null, post = null }) => {
  if (!pre || !post) return null;
  const preScore = pre?.scoring?.overall?.normalizedScore;
  const postScore = post?.scoring?.overall?.normalizedScore;
  if (!Number.isFinite(preScore) || !Number.isFinite(postScore)) return null;

  const dimensionMap = new Map();
  (pre.scoring?.dimensionScores ?? []).forEach((dimension) => {
    dimensionMap.set(dimension.key, { key: dimension.key, label: dimension.label, pre: dimension.normalizedScore, post: null });
  });
  (post.scoring?.dimensionScores ?? []).forEach((dimension) => {
    if (!dimensionMap.has(dimension.key)) {
      dimensionMap.set(dimension.key, { key: dimension.key, label: dimension.label, pre: null, post: dimension.normalizedScore });
      return;
    }
    const current = dimensionMap.get(dimension.key);
    current.post = dimension.normalizedScore;
  });

  const dimensionDelta = Array.from(dimensionMap.values()).map((dimension) => ({
    ...dimension,
    delta:
      Number.isFinite(dimension.pre) && Number.isFinite(dimension.post)
        ? Math.round((dimension.post - dimension.pre) * 100) / 100
        : null,
  }));

  const deltaNormalized = Math.round((postScore - preScore) * 100) / 100;

  return {
    preResponseId: pre.id,
    postResponseId: post.id,
    preScore,
    postScore,
    deltaNormalized,
    growthBand: computeGrowthBand(deltaNormalized),
    dimensionDelta,
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

  const avgOverallPre = avg(preRecords.map((record) => record.scoring?.overall?.normalizedScore));
  const avgOverallPost = avg(postRecords.map((record) => record.scoring?.overall?.normalizedScore));
  const delta = Math.round((avgOverallPost - avgOverallPre) * 100) / 100;

  const byDimension = new Map();
  const collectDimension = (source, bucket) => {
    (source?.scoring?.dimensionScores ?? []).forEach((dimension) => {
      if (!byDimension.has(dimension.key)) {
        byDimension.set(dimension.key, {
          key: dimension.key,
          label: dimension.label,
          pre: [],
          post: [],
        });
      }
      byDimension.get(dimension.key)[bucket].push(dimension.normalizedScore);
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
      const band = String(record.scoring?.overall?.band ?? 'Unknown');
      acc[band] = (acc[band] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const meaningfulThresholdCount = comparisons.filter((comparison) => comparison.deltaNormalized >= 5).length;

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
      minimal: comparisons.filter((comparison) => comparison.deltaNormalized >= 1 && comparison.deltaNormalized < 5).length,
      meaningful: comparisons.filter((comparison) => comparison.deltaNormalized >= 5 && comparison.deltaNormalized < 10).length,
      strong: comparisons.filter((comparison) => comparison.deltaNormalized >= 10).length,
    },
  };
};
