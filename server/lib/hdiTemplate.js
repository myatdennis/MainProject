export const HDI_ASSESSMENT_TYPE = 'hdi';

export const HDI_DIMENSIONS = [
  {
    key: 'self_awareness_identity',
    label: 'Self-Awareness & Identity',
    items: [
      'I understand how my background and identity shape the way I see others.',
      'I regularly reflect on how my experiences influence my assumptions.',
      'I can recognize when my cultural perspective is not universal.',
      'I am aware of the ways power, privilege, or marginalization can affect interactions.',
    ],
  },
  {
    key: 'openness_curiosity',
    label: 'Openness & Curiosity',
    items: [
      'I am genuinely curious about perspectives that differ from my own.',
      'I can stay engaged even when someone’s beliefs or communication style feel unfamiliar to me.',
      'I seek opportunities to learn from people with different cultural or life experiences.',
      'I can notice my initial reactions without letting them fully determine my response.',
    ],
  },
  {
    key: 'empathy_perspective_taking',
    label: 'Empathy & Perspective-Taking',
    items: [
      'I try to understand how others may experience the same situation differently.',
      'I listen for understanding, not just to respond.',
      'I can appreciate another person’s perspective even when I do not fully agree.',
      'I consider how policies, norms, or decisions may impact people differently.',
    ],
  },
  {
    key: 'inclusive_communication',
    label: 'Inclusive Communication',
    items: [
      'I adapt my communication style when needed to improve understanding across differences.',
      'I make an effort to ensure others feel heard and respected in group settings.',
      'I am mindful of language that could unintentionally exclude or alienate others.',
      'I invite input from people whose voices may be overlooked.',
    ],
  },
  {
    key: 'navigating_difference_conflict',
    label: 'Navigating Difference & Conflict',
    items: [
      'I can remain respectful and grounded during difficult conversations across difference.',
      'I am willing to address misunderstandings instead of avoiding them.',
      'I can recognize when discomfort is part of learning and growth.',
      'I can engage conflict in a way that supports trust and understanding.',
    ],
  },
  {
    key: 'action_accountability',
    label: 'Action & Accountability',
    items: [
      'I take responsibility when my words or actions have unintended impact.',
      'I actively look for ways to make teams or spaces more inclusive.',
      'I speak up or intervene when I notice exclusion, bias, or inequity.',
      'I set goals for how I want to grow in my intercultural effectiveness.',
    ],
  },
];

export const HDI_REVERSE_ITEMS = [
  'I usually assume that if something works for me, it should work for most people.',
  'I find it hard to relate to people whose values are very different from mine.',
  'I prefer to avoid conversations about identity, culture, or difference.',
  'When conflict happens, it is usually better to move on quickly than to unpack what happened.',
];

const LIKERT_SCALE = {
  min: 1,
  max: 5,
  minLabel: 'Strongly Disagree',
  midLabel: 'Neutral / Unsure',
  maxLabel: 'Strongly Agree',
};

export const buildHdiQuestions = ({ includeReverse = true } = {}) => {
  const items = [];
  let order = 1;
  HDI_DIMENSIONS.forEach((dimension) => {
    dimension.items.forEach((title) => {
      items.push({
        id: `hdi-q-${order}`,
        type: 'likert-scale',
        title,
        required: true,
        order,
        scale: { ...LIKERT_SCALE },
        metadata: {
          assessmentType: HDI_ASSESSMENT_TYPE,
          dimensionKey: dimension.key,
          dimensionLabel: dimension.label,
          reverseScored: false,
          scoringWeight: 1,
          questionOrder: order,
          scoringLocked: true,
        },
      });
      order += 1;
    });
  });

  if (includeReverse) {
    HDI_REVERSE_ITEMS.forEach((title) => {
      items.push({
        id: `hdi-q-${order}`,
        type: 'likert-scale',
        title,
        required: true,
        order,
        scale: { ...LIKERT_SCALE },
        metadata: {
          assessmentType: HDI_ASSESSMENT_TYPE,
          dimensionKey: 'reverse_control',
          dimensionLabel: 'Optional Reverse-Scored Items',
          reverseScored: true,
          scoringWeight: 1,
          questionOrder: order,
          scoringLocked: true,
        },
      });
      order += 1;
    });
  }

  return items;
};

export const buildHdiSurveyTemplate = () => ({
  id: 'hdi-intercultural-development-index',
  name: 'The Huddle Co. Intercultural Development Index (HDI)',
  description:
    'Custom internal assessment measuring intercultural development across awareness, empathy, communication, and accountability.',
  category: 'leadership',
  tags: ['hdi', 'intercultural', 'inclusion', 'leadership', 'pre-post'],
  sections: [
    {
      title: 'The Huddle Co. Intercultural Development Index (HDI)',
      description: 'Rate each statement based on your current practice and mindset.',
      order: 1,
      questions: buildHdiQuestions({ includeReverse: true }),
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
});

export const isHdiAssessment = (surveyLike = {}) => {
  const type = String(surveyLike?.type ?? '').toLowerCase();
  const settingsType = String(surveyLike?.settings?.assessmentType ?? '').toLowerCase();
  const metadataType = String(surveyLike?.metadata?.assessmentType ?? '').toLowerCase();
  return (
    type === HDI_ASSESSMENT_TYPE ||
    type === 'hdi-assessment' ||
    settingsType === HDI_ASSESSMENT_TYPE ||
    metadataType === HDI_ASSESSMENT_TYPE
  );
};
