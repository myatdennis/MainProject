import { HDI_DIMENSIONS } from './hdiTemplate.js';

const SCORE_BANDS = [
  { key: 'emerging', label: 'Emerging', min: 0, max: 39 },
  { key: 'developing', label: 'Developing', min: 40, max: 59 },
  { key: 'practicing', label: 'Practicing', min: 60, max: 79 },
  { key: 'integrating', label: 'Integrating', min: 80, max: 100 },
];

const toSafeNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === 'object') {
    const candidate = value.value ?? value.score ?? value.rating ?? value.selected;
    return toSafeNumber(candidate);
  }
  return null;
};

const clampLikert = (value) => Math.max(1, Math.min(5, Math.round(value)));
const reverseLikert = (value) => 6 - value;
const round2 = (value) => Math.round(value * 100) / 100;
const normalize100 = (avg) => round2(((avg - 1) / 4) * 100);

const resolveBand = (normalized) => {
  for (const band of SCORE_BANDS) {
    if (normalized >= band.min && normalized <= band.max) {
      return band;
    }
  }
  return SCORE_BANDS[0];
};

const defaultDimensionMap = new Map();
const coreDimensionKeys = new Set(HDI_DIMENSIONS.map((dimension) => dimension.key));
HDI_DIMENSIONS.forEach((dimension) => {
  dimension.items.forEach((item) => {
    defaultDimensionMap.set(item, {
      dimensionKey: dimension.key,
      dimensionLabel: dimension.label,
      reverseScored: false,
      scoringWeight: 1,
    });
  });
});

const flattenSurveyQuestions = (survey = {}) => {
  const sections = Array.isArray(survey.sections) ? survey.sections : [];
  const flattened = [];
  sections.forEach((section) => {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    questions.forEach((question, index) => {
      const metadata = question?.metadata && typeof question.metadata === 'object' ? question.metadata : {};
      const fallback = defaultDimensionMap.get(question?.title) ?? {};
      flattened.push({
        id: question?.id,
        title: question?.title,
        order: Number(metadata.questionOrder ?? question?.order ?? index + 1),
        dimensionKey: metadata.dimensionKey ?? fallback.dimensionKey ?? null,
        dimensionLabel: metadata.dimensionLabel ?? fallback.dimensionLabel ?? null,
        reverseScored: Boolean(metadata.reverseScored ?? fallback.reverseScored ?? false),
        scoringWeight: Number(metadata.scoringWeight ?? fallback.scoringWeight ?? 1) || 1,
      });
    });
  });
  return flattened;
};

export const scoreBands = SCORE_BANDS;

export const scoreHdiSubmission = ({ survey, responses }) => {
  const responseMap = responses && typeof responses === 'object' ? responses : {};
  const questions = flattenSurveyQuestions(survey)
    .filter((question) => question.id)
    .sort((a, b) => a.order - b.order);

  const byDimension = new Map();
  const scoredItems = [];

  questions.forEach((question) => {
    const rawInput = responseMap[question.id];
    const numeric = toSafeNumber(rawInput);
    if (numeric === null) return;

    const baseScore = clampLikert(numeric);
    const scored = question.reverseScored ? reverseLikert(baseScore) : baseScore;
    const weight = Number.isFinite(question.scoringWeight) ? question.scoringWeight : 1;

    const dimensionKey = question.dimensionKey ?? 'unmapped';
    const dimensionLabel = question.dimensionLabel ?? 'Unmapped';
    if (!byDimension.has(dimensionKey)) {
      byDimension.set(dimensionKey, {
        key: dimensionKey,
        label: dimensionLabel,
        weightedTotal: 0,
        weightTotal: 0,
        itemCount: 0,
      });
    }

    const dimension = byDimension.get(dimensionKey);
    dimension.weightedTotal += scored * weight;
    dimension.weightTotal += weight;
    dimension.itemCount += 1;

    scoredItems.push({
      questionId: question.id,
      questionTitle: question.title,
      dimensionKey,
      dimensionLabel,
      reverseScored: question.reverseScored,
      raw: baseScore,
      scored,
      weight,
    });
  });

  const dimensionScores = Array.from(byDimension.values())
    .filter((entry) => entry.weightTotal > 0)
    .map((entry) => {
      const average = entry.weightedTotal / entry.weightTotal;
      const normalized = normalize100(average);
      const band = resolveBand(normalized);
      return {
        key: entry.key,
        label: entry.label,
        itemCount: entry.itemCount,
        rawAverage: round2(average),
        normalizedScore: normalized,
        band: band.label,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const coreDimensions = dimensionScores.filter((dimension) => coreDimensionKeys.has(dimension.key));
  const dimensionsForOverall = coreDimensions.length > 0 ? coreDimensions : dimensionScores;

  const overallRawAverage =
    dimensionsForOverall.length > 0
      ? round2(dimensionsForOverall.reduce((sum, dimension) => sum + dimension.rawAverage, 0) / dimensionsForOverall.length)
      : 0;
  const overallNormalized = normalize100(overallRawAverage || 1);
  const overallBand = resolveBand(overallNormalized);

  return {
    responseCount: scoredItems.length,
    scoredItems,
    dimensionScores,
    overall: {
      rawAverage: overallRawAverage,
      normalizedScore: overallNormalized,
      band: overallBand.label,
      bandKey: overallBand.key,
    },
  };
};

export const computeGrowthBand = (delta) => {
  if (!Number.isFinite(delta)) return 'No baseline';
  if (delta >= 10) return 'Strong growth';
  if (delta >= 5) return 'Meaningful growth';
  if (delta >= 1) return 'Minimal growth';
  if (delta <= -1) return 'Declined';
  return 'Stable';
};
