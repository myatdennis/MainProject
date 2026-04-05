export const buildHdiReport = ({ participant = {}, scoring, profile }) => {
  const stageScores = scoring?.stageScores ?? {};
  const normalizedScores = scoring?.normalizedScores ?? {};

  const ranked = Object.values(stageScores)
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

  const strengths = ranked.slice(0, 2).map((entry) => ({
    stageKey: entry.key,
    stageLabel: entry.label,
    score: normalizedScores?.[entry.key] ?? null,
  }));

  const growthAreas = [...ranked]
    .reverse()
    .slice(0, 2)
    .map((entry) => ({
      stageKey: entry.key,
      stageLabel: entry.label,
      score: normalizedScores?.[entry.key] ?? null,
    }));

  const placement = {
    primaryStage: scoring?.developmentalOrientation?.primaryStage ?? scoring?.primaryStage ?? null,
    secondaryStage: scoring?.developmentalOrientation?.secondaryStage ?? scoring?.secondaryStage ?? null,
  };

  const summary = placement.primaryStage
    ? `Current developmental orientation is ${placement.primaryStage.label} with strongest momentum in ${
        strengths[0]?.stageLabel ?? 'key areas'
      }.`
    : 'Developmental orientation could not be determined.';

  return {
    participant,
    stageScores,
    normalizedScores,
    developmentalOrientation: scoring?.developmentalOrientation ?? null,
    stagePlacement: placement,
    profile,
    strengths,
    growthAreas,
    summary,
    nextSteps: profile?.nextAction ? [profile.nextAction] : [],
  };
};
