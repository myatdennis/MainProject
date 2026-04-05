import { HDI_STAGE_ORDER, HDI_STAGES } from './hdiTemplate.js';
import { computeGrowthBand } from './hdiScoring.js';

const STAGE_INDEX = Object.fromEntries(HDI_STAGE_ORDER.map((stageKey, idx) => [stageKey, idx]));
const STAGE_LABELS = Object.fromEntries(HDI_STAGES.map((stage) => [stage.key, stage.label]));
const round2 = (value) => Math.round(value * 100) / 100;

const stageMovementLabel = (fromKey, toKey) => {
  if (!fromKey || !toKey) return 'No stage movement data.';
  const delta = (STAGE_INDEX[toKey] ?? 0) - (STAGE_INDEX[fromKey] ?? 0);
  if (delta > 0) return `Moved forward ${delta} stage${delta === 1 ? '' : 's'} (${STAGE_LABELS[fromKey]} → ${STAGE_LABELS[toKey]}).`;
  if (delta < 0) return `Moved backward ${Math.abs(delta)} stage${Math.abs(delta) === 1 ? '' : 's'} (${STAGE_LABELS[fromKey]} → ${STAGE_LABELS[toKey]}).`;
  return `Maintained stage placement in ${STAGE_LABELS[toKey]}.`;
};

export const compareHdiReports = ({ preReport, postReport }) => {
  if (!preReport || !postReport) return null;

  const preDo = preReport?.developmentalOrientation?.score;
  const postDo = postReport?.developmentalOrientation?.score;

  if (!Number.isFinite(preDo) || !Number.isFinite(postDo)) return null;

  const doScoreDelta = round2(postDo - preDo);

  const dimensionGrowth = HDI_STAGE_ORDER.map((stageKey) => {
    const preScore = Number(preReport?.normalizedScores?.[stageKey]);
    const postScore = Number(postReport?.normalizedScores?.[stageKey]);
    const delta = Number.isFinite(preScore) && Number.isFinite(postScore) ? round2(postScore - preScore) : null;
    return {
      stageKey,
      stageLabel: STAGE_LABELS[stageKey],
      pre: Number.isFinite(preScore) ? preScore : null,
      post: Number.isFinite(postScore) ? postScore : null,
      delta,
    };
  });

  const growthAreas = dimensionGrowth
    .filter((entry) => Number.isFinite(entry.delta))
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 2);

  const recommendedFocus = growthAreas.length
    ? `Focus next on ${growthAreas.map((item) => item.stageLabel).join(' and ')} for balanced development.`
    : 'Continue reinforcing gains with consistent practice and reflection.';

  const preStageKey = preReport?.stagePlacement?.primaryStage?.key ?? preReport?.developmentalOrientation?.primaryStage?.key ?? null;
  const postStageKey = postReport?.stagePlacement?.primaryStage?.key ?? postReport?.developmentalOrientation?.primaryStage?.key ?? null;

  return {
    doScoreDelta,
    growthBand: computeGrowthBand(doScoreDelta),
    stageMovement: {
      from: preStageKey,
      to: postStageKey,
      summary: stageMovementLabel(preStageKey, postStageKey),
    },
    dimensionGrowth,
    improvementSummary: `Developmental Orientation changed by ${doScoreDelta >= 0 ? '+' : ''}${doScoreDelta} (${computeGrowthBand(
      doScoreDelta,
    )}).`,
    growthAreas,
    recommendedFocus,
  };
};
