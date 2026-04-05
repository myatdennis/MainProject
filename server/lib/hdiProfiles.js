const PROFILE_LIBRARY = {
  reflective_learner: {
    name: 'Reflective Learner',
    strengths: [
      'Building awareness of differences and perspective variability',
      'Open to reflection and developmental feedback',
    ],
    blindSpots: [
      'May under-translate awareness into visible inclusive behavior',
      'Can default to neutrality when action is needed',
    ],
    coachingRecommendation:
      'Pair reflection with one explicit inclusion behavior each week and review outcomes with a manager or coach.',
    nextAction: 'Run one conversation this week using a pause-ask-validate sequence before responding.',
  },
  curious_connector: {
    name: 'Curious Connector',
    strengths: [
      'Shows genuine curiosity about others’ perspectives',
      'Growing consistency in cross-difference collaboration',
    ],
    blindSpots: [
      'Can stop at curiosity without sustained adaptation',
      'May avoid tension when conversations become uncomfortable',
    ],
    coachingRecommendation:
      'Practice adaptive communication in high-stakes meetings and track impact on understanding and trust.',
    nextAction: 'In your next two meetings, invite one perspective you would not normally hear first.',
  },
  inclusive_communicator: {
    name: 'Inclusive Communicator',
    strengths: [
      'Adapts communication effectively across differences',
      'Creates psychologically safer interactions in teams',
    ],
    blindSpots: [
      'May miss structural opportunities to shape inclusive systems',
      'Can over-rely on interpersonal skill over accountability mechanisms',
    ],
    coachingRecommendation:
      'Expand from inclusive communication to systems-level influence using clear inclusion metrics and accountability loops.',
    nextAction: 'Define one team norm change that improves participation equity and implement it this sprint.',
  },
  courageous_contributor: {
    name: 'Courageous Contributor',
    strengths: [
      'Takes visible action when inclusion risks appear',
      'Willing to challenge unhelpful norms constructively',
    ],
    blindSpots: [
      'Action pace may exceed collective readiness in some groups',
      'May underinvest in socializing changes before driving them',
    ],
    coachingRecommendation:
      'Balance urgency with coalition-building so action translates into sustained adoption.',
    nextAction: 'Identify two allies and co-design one measurable inclusion improvement together.',
  },
  bridge_builder: {
    name: 'Bridge Builder',
    strengths: [
      'Integrates awareness, empathy, and action across contexts',
      'Helps teams navigate differences while preserving trust and results',
    ],
    blindSpots: [
      'Can become default mediator without distributing capacity',
      'May carry disproportionate emotional labor',
    ],
    coachingRecommendation:
      'Scale your impact by mentoring others to lead inclusion practices independently.',
    nextAction: 'Coach one peer this month on a real cross-difference challenge and debrief outcomes.',
  },
  growth_starter: {
    name: 'Growth Starter',
    strengths: [
      'Early-stage openness to development',
      'Willingness to engage foundational concepts',
    ],
    blindSpots: [
      'Limited recognition of how differences shape outcomes',
      'May default to sameness framing in complex contexts',
    ],
    coachingRecommendation:
      'Start with foundational awareness practices and low-risk behavioral experiments in day-to-day interactions.',
    nextAction: 'Complete one weekly reflection on a cross-difference interaction and identify one improvement step.',
  },
};

const round2 = (value) => Math.round(value * 100) / 100;

const average = (values = []) => {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return round2(safe.reduce((sum, value) => sum + value, 0) / safe.length);
};

const profileByRules = ({ primaryStageKey, awarenessScore, actionScore, actionVsAwarenessGap }) => {
  if (primaryStageKey === 'integration') return 'bridge_builder';
  if (primaryStageKey === 'adaptation' && actionVsAwarenessGap >= 5) return 'courageous_contributor';
  if (primaryStageKey === 'adaptation' || primaryStageKey === 'acceptance') return 'inclusive_communicator';
  if (primaryStageKey === 'minimization' && awarenessScore >= 55) return 'curious_connector';
  if (primaryStageKey === 'polarization' || primaryStageKey === 'avoidance') return 'growth_starter';
  if (actionScore - awarenessScore <= -8) return 'reflective_learner';
  return 'curious_connector';
};

export const buildHdiProfile = ({ scoring }) => {
  const normalized = scoring?.normalizedScores ?? {};
  const awarenessScore = average([
    normalized.avoidance,
    normalized.polarization,
    normalized.minimization,
    normalized.acceptance,
  ]);
  const actionScore = average([normalized.adaptation, normalized.integration]);
  const actionVsAwarenessGap = round2(actionScore - awarenessScore);

  const primaryStageKey =
    String(scoring?.developmentalOrientation?.primaryStage?.key ?? scoring?.primaryStage?.key ?? '').toLowerCase() ||
    'minimization';

  const profileKey = profileByRules({
    primaryStageKey,
    awarenessScore,
    actionScore,
    actionVsAwarenessGap,
  });

  const profile = PROFILE_LIBRARY[profileKey] ?? PROFILE_LIBRARY.reflective_learner;

  return {
    key: profileKey,
    name: profile.name,
    strengths: profile.strengths,
    blindSpots: profile.blindSpots,
    coachingRecommendation: profile.coachingRecommendation,
    nextAction: profile.nextAction,
    diagnostics: {
      awarenessScore,
      actionScore,
      actionVsAwarenessGap,
      primaryStageKey,
    },
  };
};
