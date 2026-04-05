import { HDI_STAGE_ORDER, HDI_STAGES } from './hdiTemplate.js';

const STAGE_WEIGHTS = Object.fromEntries(HDI_STAGES.map((stage) => [stage.key, stage.weight]));
const STAGE_LABELS = Object.fromEntries(HDI_STAGES.map((stage) => [stage.key, stage.label]));

const DO_STAGE_BANDS = [
  { key: 'avoidance', label: 'Avoidance', min: 1.0, max: 1.74 },
  { key: 'polarization', label: 'Polarization', min: 1.75, max: 2.49 },
  { key: 'minimization', label: 'Minimization', min: 2.5, max: 3.49 },
  { key: 'acceptance', label: 'Acceptance', min: 3.5, max: 4.49 },
  { key: 'adaptation', label: 'Adaptation', min: 4.5, max: 5.49 },
  { key: 'integration', label: 'Integration', min: 5.5, max: 6.0 },
];

const round2 = (value) => Math.round(value * 100) / 100;
const clampLikert = (value) => Math.max(1, Math.min(5, Number(value)));
const normalize100 = (avg) => round2(((avg - 1) / 4) * 100);
const doToPercent = (doScore) => round2(((doScore - 1) / 5) * 100);

const getStageFromQuestion = (question = {}, titleFallback = '') => {
  const metadata = question?.metadata && typeof question.metadata === 'object' ? question.metadata : {};
  const stageKey = String(
    metadata.stage_key ?? metadata.stageKey ?? metadata.dimensionKey ?? question.stage_key ?? question.stageKey ?? '',
  )
    .trim()
    .toLowerCase();

  if (STAGE_WEIGHTS[stageKey]) {
    return {
      key: stageKey,
      label: metadata.stageLabel ?? metadata.dimensionLabel ?? STAGE_LABELS[stageKey],
      reverseScored: Boolean(metadata.reverse_scored ?? metadata.reverseScored ?? false),
      weight: Number(metadata.weight ?? metadata.scoringWeight ?? 1) || 1,
    };
  }

  const normalizedTitle = String(titleFallback).trim();
  for (const stage of HDI_STAGES) {
    if (stage.items.includes(normalizedTitle)) {
      return {
        key: stage.key,
        label: stage.label,
        reverseScored: false,
        weight: 1,
      };
    }
  }

  return null;
};

const flattenSurveyQuestions = (survey = {}) => {
  const sections = Array.isArray(survey?.sections) ? survey.sections : [];
  const flattened = [];
  sections.forEach((section) => {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    questions.forEach((question, idx) => {
      const stage = getStageFromQuestion(question, question?.title ?? '');
      flattened.push({
        id: String(question?.id ?? ''),
        title: String(question?.title ?? ''),
        order: Number(question?.order ?? idx + 1) || idx + 1,
        stage,
      });
    });
  });
  return flattened;
};

const resolveDoStage = (doScore) => {
  for (const band of DO_STAGE_BANDS) {
    if (doScore >= band.min && doScore <= band.max) {
      return { key: band.key, label: band.label, min: band.min, max: band.max };
    }
  }
  return doScore > 6 ? DO_STAGE_BANDS[DO_STAGE_BANDS.length - 1] : DO_STAGE_BANDS[0];
};

const coerceNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === 'object') {
    return coerceNumeric(value.value ?? value.score ?? value.rating ?? value.selected);
  }
  return null;
};

export const validateHdiAnswers = ({ survey, responses }) => {
  const responseMap = responses && typeof responses === 'object' ? responses : {};
  const questions = flattenSurveyQuestions(survey);

  const stageCounts = Object.fromEntries(HDI_STAGE_ORDER.map((stageKey) => [stageKey, 0]));
  const missingQuestionIds = [];
  const invalidQuestionIds = [];

  questions.forEach((question) => {
    if (!question.stage || !question.id) return;
    const raw = coerceNumeric(responseMap[question.id]);
    if (raw === null) {
      missingQuestionIds.push(question.id);
      return;
    }
    if (raw < 1 || raw > 5) {
      invalidQuestionIds.push(question.id);
      return;
    }
    stageCounts[question.stage.key] += 1;
  });

  const incompleteStages = HDI_STAGE_ORDER.filter((stageKey) => stageCounts[stageKey] < 6);

  return {
    isValid: missingQuestionIds.length === 0 && invalidQuestionIds.length === 0 && incompleteStages.length === 0,
    missingQuestionIds,
    invalidQuestionIds,
    incompleteStages,
    answeredCount: questions.length - missingQuestionIds.length - invalidQuestionIds.length,
    expectedQuestionCount: 36,
  };
};

export const scoreHdiSubmission = ({ survey, responses }) => {
  const responseMap = responses && typeof responses === 'object' ? responses : {};
  const questions = flattenSurveyQuestions(survey).sort((a, b) => a.order - b.order);

  const validation = validateHdiAnswers({ survey, responses });

  const stageBuckets = new Map();
  HDI_STAGES.forEach((stage) => {
    stageBuckets.set(stage.key, {
      key: stage.key,
      label: stage.label,
      weight: stage.weight,
      weightedTotal: 0,
      weightTotal: 0,
      itemCount: 0,
    });
  });

  questions.forEach((question) => {
    if (!question.id || !question.stage) return;
    const value = coerceNumeric(responseMap[question.id]);
    if (value === null || value < 1 || value > 5) return;

    const stageEntry = stageBuckets.get(question.stage.key);
    if (!stageEntry) return;

    const numeric = clampLikert(value);
    const scored = question.stage.reverseScored ? 6 - numeric : numeric;
    const itemWeight = Number(question.stage.weight ?? 1) || 1;

    stageEntry.weightedTotal += scored * itemWeight;
    stageEntry.weightTotal += itemWeight;
    stageEntry.itemCount += 1;
  });

  const stageScores = {};
  const normalizedScores = {};

  HDI_STAGE_ORDER.forEach((stageKey) => {
    const stage = stageBuckets.get(stageKey);
    const avg = stage && stage.weightTotal > 0 ? round2(stage.weightedTotal / stage.weightTotal) : 0;
    stageScores[stageKey] = {
      key: stageKey,
      label: STAGE_LABELS[stageKey],
      average: avg,
      itemCount: stage?.itemCount ?? 0,
      weight: STAGE_WEIGHTS[stageKey],
    };
    normalizedScores[stageKey] = normalize100(avg || 1);
  });

  const weightedTop = HDI_STAGE_ORDER.reduce((sum, stageKey) => {
    return sum + (stageScores[stageKey].average || 0) * STAGE_WEIGHTS[stageKey];
  }, 0);
  const weightedBottom = HDI_STAGE_ORDER.reduce((sum, stageKey) => sum + STAGE_WEIGHTS[stageKey], 0);
  const doScore = weightedBottom > 0 ? round2(weightedTop / weightedBottom) : 0;

  const primaryStageBand = resolveDoStage(doScore);
  const secondaryStage = [...HDI_STAGE_ORDER]
    .map((stageKey) => ({ stageKey, average: stageScores[stageKey].average }))
    .filter((entry) => entry.stageKey !== primaryStageBand.key)
    .sort((a, b) => b.average - a.average)[0];

  const developmentalOrientation = {
    score: doScore,
    normalizedScore: doToPercent(doScore || 1),
    primaryStage: primaryStageBand,
    secondaryStage: secondaryStage
      ? {
          key: secondaryStage.stageKey,
          label: STAGE_LABELS[secondaryStage.stageKey],
        }
      : null,
  };

  return {
    validation,
    stageScores,
    normalizedScores,
    developmentalOrientation,
    doScore,
    primaryStage: developmentalOrientation.primaryStage,
    secondaryStage: developmentalOrientation.secondaryStage,
    overall: {
      rawAverage: doScore,
      normalizedScore: developmentalOrientation.normalizedScore,
      band: developmentalOrientation.primaryStage.label,
      bandKey: developmentalOrientation.primaryStage.key,
    },
  };
};

export const computeGrowthBand = (delta) => {
  if (!Number.isFinite(delta)) return 'No baseline';
  if (delta >= 0.75) return 'Strong growth';
  if (delta >= 0.35) return 'Meaningful growth';
  if (delta >= 0.1) return 'Minimal growth';
  if (delta <= -0.1) return 'Declined';
  return 'Stable';
};
