import type { SurveyTemplate } from '../types/survey';

const LIKERT_SCALE = {
  min: 1,
  max: 5,
  minLabel: 'Strongly Disagree',
  midLabel: 'Neutral / Unsure',
  maxLabel: 'Strongly Agree',
};

const buildQuestion = (
  id: string,
  order: number,
  title: string,
  dimensionKey: string,
  dimensionLabel: string,
  reverseScored = false,
) => ({
  id,
  type: 'likert-scale' as const,
  title,
  required: true,
  order,
  scale: LIKERT_SCALE,
  metadata: {
    assessmentType: 'hdi',
    dimensionKey,
    dimensionLabel,
    scoringWeight: 1,
    reverseScored,
    questionOrder: order,
    scoringLocked: true,
  },
});

export const hdiTemplate: SurveyTemplate = {
  id: 'hdi-intercultural-development-index',
  name: 'The Huddle Co. Intercultural Development Index (HDI)',
  description:
    'Custom internal assessment for intercultural development, empathy, belonging, inclusive leadership, and actionable growth.',
  category: 'leadership',
  tags: ['hdi', 'intercultural', 'pre-post', 'development', 'inclusive-leadership'],
  sections: [
    {
      title: 'The Huddle Co. Intercultural Development Index (HDI)',
      description: 'Please rate each statement based on your current experiences and practices.',
      order: 1,
      questions: [
        buildQuestion('hdi-q-1', 1, 'I understand how my background and identity shape the way I see others.', 'self_awareness_identity', 'Self-Awareness & Identity'),
        buildQuestion('hdi-q-2', 2, 'I regularly reflect on how my experiences influence my assumptions.', 'self_awareness_identity', 'Self-Awareness & Identity'),
        buildQuestion('hdi-q-3', 3, 'I can recognize when my cultural perspective is not universal.', 'self_awareness_identity', 'Self-Awareness & Identity'),
        buildQuestion('hdi-q-4', 4, 'I am aware of the ways power, privilege, or marginalization can affect interactions.', 'self_awareness_identity', 'Self-Awareness & Identity'),
        buildQuestion('hdi-q-5', 5, 'I am genuinely curious about perspectives that differ from my own.', 'openness_curiosity', 'Openness & Curiosity'),
        buildQuestion('hdi-q-6', 6, 'I can stay engaged even when someone’s beliefs or communication style feel unfamiliar to me.', 'openness_curiosity', 'Openness & Curiosity'),
        buildQuestion('hdi-q-7', 7, 'I seek opportunities to learn from people with different cultural or life experiences.', 'openness_curiosity', 'Openness & Curiosity'),
        buildQuestion('hdi-q-8', 8, 'I can notice my initial reactions without letting them fully determine my response.', 'openness_curiosity', 'Openness & Curiosity'),
        buildQuestion('hdi-q-9', 9, 'I try to understand how others may experience the same situation differently.', 'empathy_perspective_taking', 'Empathy & Perspective-Taking'),
        buildQuestion('hdi-q-10', 10, 'I listen for understanding, not just to respond.', 'empathy_perspective_taking', 'Empathy & Perspective-Taking'),
        buildQuestion('hdi-q-11', 11, 'I can appreciate another person’s perspective even when I do not fully agree.', 'empathy_perspective_taking', 'Empathy & Perspective-Taking'),
        buildQuestion('hdi-q-12', 12, 'I consider how policies, norms, or decisions may impact people differently.', 'empathy_perspective_taking', 'Empathy & Perspective-Taking'),
        buildQuestion('hdi-q-13', 13, 'I adapt my communication style when needed to improve understanding across differences.', 'inclusive_communication', 'Inclusive Communication'),
        buildQuestion('hdi-q-14', 14, 'I make an effort to ensure others feel heard and respected in group settings.', 'inclusive_communication', 'Inclusive Communication'),
        buildQuestion('hdi-q-15', 15, 'I am mindful of language that could unintentionally exclude or alienate others.', 'inclusive_communication', 'Inclusive Communication'),
        buildQuestion('hdi-q-16', 16, 'I invite input from people whose voices may be overlooked.', 'inclusive_communication', 'Inclusive Communication'),
        buildQuestion('hdi-q-17', 17, 'I can remain respectful and grounded during difficult conversations across difference.', 'navigating_difference_conflict', 'Navigating Difference & Conflict'),
        buildQuestion('hdi-q-18', 18, 'I am willing to address misunderstandings instead of avoiding them.', 'navigating_difference_conflict', 'Navigating Difference & Conflict'),
        buildQuestion('hdi-q-19', 19, 'I can recognize when discomfort is part of learning and growth.', 'navigating_difference_conflict', 'Navigating Difference & Conflict'),
        buildQuestion('hdi-q-20', 20, 'I can engage conflict in a way that supports trust and understanding.', 'navigating_difference_conflict', 'Navigating Difference & Conflict'),
        buildQuestion('hdi-q-21', 21, 'I take responsibility when my words or actions have unintended impact.', 'action_accountability', 'Action & Accountability'),
        buildQuestion('hdi-q-22', 22, 'I actively look for ways to make teams or spaces more inclusive.', 'action_accountability', 'Action & Accountability'),
        buildQuestion('hdi-q-23', 23, 'I speak up or intervene when I notice exclusion, bias, or inequity.', 'action_accountability', 'Action & Accountability'),
        buildQuestion('hdi-q-24', 24, 'I set goals for how I want to grow in my intercultural effectiveness.', 'action_accountability', 'Action & Accountability'),
        buildQuestion('hdi-q-25', 25, 'I usually assume that if something works for me, it should work for most people.', 'reverse_control', 'Optional Reverse-Scored Items', true),
        buildQuestion('hdi-q-26', 26, 'I find it hard to relate to people whose values are very different from mine.', 'reverse_control', 'Optional Reverse-Scored Items', true),
        buildQuestion('hdi-q-27', 27, 'I prefer to avoid conversations about identity, culture, or difference.', 'reverse_control', 'Optional Reverse-Scored Items', true),
        buildQuestion('hdi-q-28', 28, 'When conflict happens, it is usually better to move on quickly than to unpack what happened.', 'reverse_control', 'Optional Reverse-Scored Items', true),
      ],
    },
  ],
  defaultSettings: {
    allowAnonymous: false,
    allowSaveAndContinue: true,
    showProgressBar: true,
    randomizeQuestions: false,
    randomizeOptions: false,
    requireCompletion: true,
    accessControl: {
      requireLogin: true,
    },
    notifications: {
      sendReminders: true,
      reminderSchedule: [3, 7, 14],
      completionNotification: true,
    },
  },
};
