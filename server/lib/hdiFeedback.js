import { computeGrowthBand } from './hdiScoring.js';

const PROFILE_BY_BAND = {
  integrating: 'Bridge Builder',
  practicing: 'Inclusive Communicator',
  developing: 'Curious Connector',
  emerging: 'Growth Starter',
};

const DIMENSION_FEEDBACK = {
  self_awareness_identity: {
    high: 'You demonstrate strong self-reflection and awareness of how identity and lived experience shape perspective. This creates a grounded foundation for inclusive leadership.',
    medium: 'You are building consistent self-awareness and reflection habits. With regular pause-and-reflect practices, you can turn insight into clearer day-to-day choices.',
    low: 'You are at an important growth point in noticing how identity and assumptions influence interpretation. Small, intentional reflection routines can quickly strengthen this area.',
  },
  openness_curiosity: {
    high: 'You show strong curiosity across differences and remain engaged when viewpoints feel unfamiliar. That posture helps create learning-rich conversations.',
    medium: 'You are showing openness in many situations and can deepen this by proactively seeking perspectives that challenge your defaults.',
    low: 'You have an opportunity to expand curiosity across difference. Practicing active inquiry before judgment can increase trust and understanding quickly.',
  },
  empathy_perspective_taking: {
    high: 'You consistently listen for understanding and consider varied impacts across people and groups. This is a core strength for inclusive decision-making.',
    medium: 'You are building empathy and perspective-taking capacity. Structured listening prompts can help you translate empathy into more inclusive action.',
    low: 'You can strengthen perspective-taking by pausing to ask, “Who experiences this differently, and why?” before finalizing conclusions.',
  },
  inclusive_communication: {
    high: 'You adapt communication effectively and actively invite voices that may be overlooked. This helps people feel respected, seen, and included.',
    medium: 'You are moving toward inclusive communication and can grow further by using explicit inclusion habits in meetings and decisions.',
    low: 'You are at a meaningful growth stage in inclusive communication. Small shifts in language, invitation, and listening can quickly improve belonging.',
  },
  navigating_difference_conflict: {
    high: 'You remain grounded and respectful in difficult conversations and can work through conflict in ways that build trust.',
    medium: 'You show growing ability to stay engaged in productive tension. Practicing repair-oriented dialogue can deepen your effectiveness.',
    low: 'You have a clear opportunity to build confidence in navigating conflict across difference. Using a simple pause-clarify-repair sequence can help.',
  },
  action_accountability: {
    high: 'You consistently translate values into action and accountability. This is a strong marker of inclusive leadership maturity.',
    medium: 'You are taking meaningful action and can accelerate impact by setting and tracking specific inclusion goals over time.',
    low: 'You can strengthen follow-through by choosing one concrete inclusion commitment and revisiting progress weekly.',
  },
  reverse_control: {
    high: 'You are demonstrating healthy flexibility and openness in situations that often trigger rigid assumptions.',
    medium: 'You are developing flexibility across difference; with continued reflection, this can become a reliable strength.',
    low: 'You have a useful opportunity to challenge default assumptions and build more adaptive responses across difference.',
  },
  unmapped: {
    high: 'You are showing strong performance in this area.',
    medium: 'You are progressing steadily in this area.',
    low: 'This area has room for intentional growth.',
  },
};

const bandKeyFromLabel = (label = '') => {
  const normalized = String(label).toLowerCase();
  if (normalized.includes('integrating')) return 'integrating';
  if (normalized.includes('practicing')) return 'practicing';
  if (normalized.includes('developing')) return 'developing';
  return 'emerging';
};

const tierFromScore = (normalized = 0) => {
  if (normalized >= 80) return 'high';
  if (normalized >= 60) return 'medium';
  return 'low';
};

const topAndBottomDimensions = (dimensionScores = []) => {
  const ordered = [...dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore);
  return {
    strengths: ordered.slice(0, 2),
    growthAreas: [...ordered].reverse().slice(0, 2),
  };
};

const chooseNextStep = ({ growthAreas }) => {
  if (!growthAreas?.length) {
    return 'Choose one inclusion behavior to practice this week and reflect on what changed in your interactions.';
  }

  const primary = growthAreas[0];
  return `For the next two weeks, pick one behavior tied to ${primary.label} and practice it in at least two real conversations, then note what improved.`;
};

export const generateHdiFeedback = ({ scoring, prePostComparison = null }) => {
  const overallBandKey = bandKeyFromLabel(scoring?.overall?.band);
  const profile = PROFILE_BY_BAND[overallBandKey] ?? 'Reflective Learner';
  const { strengths, growthAreas } = topAndBottomDimensions(scoring?.dimensionScores ?? []);

  const strengthsSummary = strengths
    .map((dimension) => {
      const blocks = DIMENSION_FEEDBACK[dimension.key] ?? DIMENSION_FEEDBACK.unmapped;
      return blocks[tierFromScore(dimension.normalizedScore)];
    })
    .join(' ');

  const growthSummary = growthAreas
    .map((dimension) => {
      const blocks = DIMENSION_FEEDBACK[dimension.key] ?? DIMENSION_FEEDBACK.unmapped;
      return blocks[tierFromScore(dimension.normalizedScore)];
    })
    .join(' ');

  const progressDelta = prePostComparison?.deltaNormalized;
  const growthBand = computeGrowthBand(progressDelta);
  const progressInterpretation = Number.isFinite(progressDelta)
    ? `Compared with your earlier administration, your normalized score changed by ${progressDelta.toFixed(1)} points (${growthBand}).`
    : 'Complete a linked pre and post administration to unlock progress interpretation.';

  const overallSummary = `You are currently in the ${scoring?.overall?.band ?? 'Developing'} range and your profile is ${profile}. Your results suggest meaningful capacity for inclusive leadership and intercultural growth.`;

  return {
    profile,
    overallSummary,
    strengthsParagraph: strengthsSummary,
    growthAreasParagraph: growthSummary,
    practicalNextStep: chooseNextStep({ growthAreas }),
    progressInterpretation,
    topStrengths: strengths.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      score: dimension.normalizedScore,
    })),
    growthAreas: growthAreas.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      score: dimension.normalizedScore,
    })),
    progressDelta: Number.isFinite(progressDelta) ? progressDelta : null,
    progressBand: growthBand,
  };
};
