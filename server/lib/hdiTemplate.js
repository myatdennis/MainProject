export const HDI_ASSESSMENT_TYPE = 'hdi';

export const HDI_STAGE_ORDER = [
  'avoidance',
  'polarization',
  'minimization',
  'acceptance',
  'adaptation',
  'integration',
];

export const HDI_STAGES = [
  {
    key: 'avoidance',
    label: 'Avoidance',
    weight: 1,
    items: [
      'I rarely think about how identity or culture affects interactions.',
      'People’s differences do not significantly impact how I work with them.',
      'I don’t notice many differences between people in my day-to-day work.',
      'Conversations about identity or culture feel unrelated to my role.',
      'I tend to focus on similarities rather than differences in most situations.',
      'I don’t see cultural or identity differences as important in teamwork.',
    ],
  },
  {
    key: 'polarization',
    label: 'Polarization',
    weight: 2,
    items: [
      'Some ways of communicating or behaving are better than others.',
      'I find myself judging behaviors that are very different from my own.',
      'People from certain backgrounds tend to approach things the “wrong” way.',
      'I feel frustrated when others don’t approach work the way I would.',
      'It is difficult for me to understand perspectives that strongly differ from mine.',
      'I believe some perspectives are more valid than others.',
    ],
  },
  {
    key: 'minimization',
    label: 'Minimization',
    weight: 3,
    items: [
      'At the end of the day, people are more alike than different.',
      'I treat everyone the same regardless of their background.',
      'Focusing too much on differences can create unnecessary division.',
      'I believe fairness means treating everyone equally.',
      'I don’t think differences should significantly influence workplace decisions.',
      'Emphasizing similarities helps teams work better together.',
    ],
  },
  {
    key: 'acceptance',
    label: 'Acceptance',
    weight: 4,
    items: [
      'People’s identities and experiences shape how they see the world.',
      'I recognize that others may experience the same situation very differently than I do.',
      'I am curious about how others’ backgrounds influence their perspectives.',
      'I understand that cultural and identity differences can impact communication.',
      'I value learning about perspectives that are different from my own.',
      'I recognize that my perspective is not universal.',
    ],
  },
  {
    key: 'adaptation',
    label: 'Adaptation',
    weight: 5,
    items: [
      'I adjust my communication style when working with different people.',
      'I can shift my approach to better connect with people from different backgrounds.',
      'I am able to navigate misunderstandings across differences effectively.',
      'I actively consider how my actions may impact others differently.',
      'I can build meaningful relationships across differences.',
      'I adapt my behavior to create more inclusive environments.',
    ],
  },
  {
    key: 'integration',
    label: 'Integration',
    weight: 6,
    items: [
      'Engaging across differences is a natural part of how I interact with others.',
      'I regularly reflect on how I can grow in my interactions across difference.',
      'I help others navigate differences more effectively.',
      'I see inclusive behavior as part of my identity.',
      'I actively contribute to building inclusive environments.',
      'I integrate awareness, empathy, and action in how I lead and interact.',
    ],
  },
];

export const HDI_DIMENSIONS = HDI_STAGES;

const LIKERT_SCALE = {
  min: 1,
  max: 5,
  minLabel: 'Strongly Disagree',
  midLabel: 'Neutral / Unsure',
  maxLabel: 'Strongly Agree',
};

export const buildHdiQuestions = () => {
  const items = [];
  let order = 1;
  HDI_STAGES.forEach((stage) => {
    stage.items.forEach((title) => {
      items.push({
        id: `hdi-q-${order}`,
        type: 'likert-scale',
        title,
        required: true,
        order,
        scale: { ...LIKERT_SCALE },
        metadata: {
          assessmentType: HDI_ASSESSMENT_TYPE,
          stageKey: stage.key,
          stageLabel: stage.label,
          stage_key: stage.key,
          dimensionKey: stage.key,
          dimensionLabel: stage.label,
          reverse_scored: false,
          weight: 1,
          reverseScored: false,
          scoringWeight: 1,
          questionOrder: order,
          scoringLocked: true,
        },
      });
      order += 1;
    });
  });

  return items;
};

export const buildHdiSurveyTemplate = () => ({
  id: 'hdi-huddle-development-inventory',
  name: 'The Huddle Co. Huddle Development Inventory (HDI)',
  description:
    'Premium developmental assessment that measures progression from Avoidance to Integration across 36 Likert items.',
  category: 'leadership',
  tags: ['hdi', 'developmental-orientation', 'pre-post', 'inclusion', 'leadership'],
  sections: [
    {
      title: 'The Huddle Co. Huddle Development Inventory (HDI)',
      description: 'Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).',
      order: 1,
      questions: buildHdiQuestions(),
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
  const assessmentType = String(surveyLike?.assessment_type ?? surveyLike?.assessmentType ?? '').toLowerCase();
  return (
    type === HDI_ASSESSMENT_TYPE ||
    type === 'hdi-assessment' ||
    type === 'hdi-huddle-development-inventory' ||
    settingsType === HDI_ASSESSMENT_TYPE ||
    metadataType === HDI_ASSESSMENT_TYPE ||
    assessmentType === HDI_ASSESSMENT_TYPE
  );
};
