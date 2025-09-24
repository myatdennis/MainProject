import type { SurveyTemplate } from '../types/survey';

export const surveyTemplates: SurveyTemplate[] = [
  {
    id: 'climate-assessment',
    name: 'Organizational Climate Assessment',
    description: 'Comprehensive assessment of workplace culture, inclusion, and belonging',
    category: 'climate',
    tags: ['culture', 'climate', 'belonging', 'comprehensive'],
    previewImage: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=400',
    sections: [
      {
        title: 'Demographics',
        description: 'Help us understand your background (all responses are confidential)',
        order: 1,
        questions: [
          {
            id: 'demo-department',
            type: 'demographics',
            title: 'Which department do you work in?',
            required: false,
            order: 1,
            options: ['Human Resources', 'Engineering', 'Marketing', 'Sales', 'Operations', 'Finance', 'Other']
          },
          {
            id: 'demo-tenure',
            type: 'demographics',
            title: 'How long have you been with the organization?',
            required: false,
            order: 2,
            options: ['Less than 1 year', '1-2 years', '3-5 years', '6-10 years', 'More than 10 years']
          },
          {
            id: 'demo-level',
            type: 'demographics',
            title: 'What is your role level?',
            required: false,
            order: 3,
            options: ['Individual Contributor', 'Team Lead', 'Manager', 'Director', 'VP/Executive', 'C-Suite']
          }
        ]
      },
      {
        title: 'Belonging & Inclusion',
        description: 'Your experience of belonging and inclusion in the workplace',
        order: 2,
        questions: [
          {
            id: 'belonging-1',
            type: 'likert-scale',
            title: 'I feel a strong sense of belonging at this organization',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'belonging-2',
            type: 'likert-scale',
            title: 'I can be my authentic self at work',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'belonging-3',
            type: 'likert-scale',
            title: 'My unique perspective is valued by my team',
            required: true,
            order: 3,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'belonging-open',
            type: 'open-ended',
            title: 'What would make you feel a stronger sense of belonging at work?',
            description: 'Please share specific examples or suggestions',
            required: false,
            order: 4,
            validation: {
              maxLength: 500
            }
          }
        ]
      },
      {
        title: 'Psychological Safety',
        description: 'Your comfort level speaking up and sharing ideas',
        order: 3,
        questions: [
          {
            id: 'safety-1',
            type: 'likert-scale',
            title: 'I feel safe speaking up about problems or concerns',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'safety-2',
            type: 'likert-scale',
            title: 'I can share ideas without fear of negative consequences',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'safety-barriers',
            type: 'multiple-choice',
            title: 'What barriers prevent you from speaking up? (Select all that apply)',
            required: false,
            order: 3,
            options: [
              'Fear of retaliation',
              'Concern about being judged',
              'Past negative experiences',
              'Lack of confidence my input matters',
              'Cultural or language barriers',
              'No barriers - I feel comfortable speaking up'
            ],
            allowMultiple: true
          }
        ]
      }
    ],
    defaultSettings: {
      allowAnonymous: true,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      requireCompletion: false,
      accessControl: {
        requireLogin: false
      },
      notifications: {
        sendReminders: true,
        reminderSchedule: [3, 7, 14],
        completionNotification: true
      }
    }
  },
  {
    id: 'inclusion-index',
    name: 'Inclusion Index Survey',
    description: 'Measure inclusion across key dimensions with benchmarking capabilities',
    category: 'inclusion',
    tags: ['inclusion', 'index', 'benchmarking', 'metrics'],
    previewImage: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400',
    sections: [
      {
        title: 'Inclusion Dimensions',
        description: 'Rate your experience across key inclusion factors',
        order: 1,
        questions: [
          {
            id: 'inclusion-matrix',
            type: 'matrix',
            title: 'Rate your agreement with the following statements',
            required: true,
            order: 1,
            matrixRows: [
              'I am treated with respect by my colleagues',
              'My manager values my input and ideas',
              'I have equal access to opportunities',
              'I feel comfortable expressing disagreement',
              'My workload is fair compared to others'
            ],
            matrixColumns: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
            matrixType: 'single'
          },
          {
            id: 'inclusion-ranking',
            type: 'ranking',
            title: 'Rank these factors by importance for feeling included (1 = most important)',
            required: true,
            order: 2,
            rankingItems: [
              'Being heard in meetings',
              'Having a mentor or sponsor',
              'Flexible work arrangements',
              'Recognition for contributions',
              'Access to development opportunities',
              'Diverse leadership representation'
            ],
            maxRankings: 6
          }
        ]
      }
    ],
    defaultSettings: {
      allowAnonymous: true,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: true,
      requireCompletion: true,
      accessControl: {
        requireLogin: false
      },
      notifications: {
        sendReminders: true,
        reminderSchedule: [5, 10],
        completionNotification: true
      }
    }
  },
  {
    id: 'equity-lens',
    name: 'Equity Lens Evaluation',
    description: 'Assess organizational practices through an equity lens',
    category: 'equity',
    tags: ['equity', 'fairness', 'practices', 'evaluation'],
    previewImage: 'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400',
    sections: [
      {
        title: 'Equity in Practices',
        description: 'Evaluate fairness in organizational systems and processes',
        order: 1,
        questions: [
          {
            id: 'equity-hiring',
            type: 'likert-scale',
            title: 'Our hiring process is fair and unbiased',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 7,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'equity-promotion',
            type: 'likert-scale',
            title: 'Promotion decisions are based on merit and are transparent',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 7,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'equity-barriers',
            type: 'open-ended',
            title: 'What systemic barriers do you observe that prevent equitable outcomes?',
            description: 'Think about policies, processes, or practices that may unintentionally disadvantage certain groups',
            required: false,
            order: 3,
            validation: {
              maxLength: 750
            }
          }
        ]
      }
    ],
    defaultSettings: {
      allowAnonymous: true,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      requireCompletion: false,
      accessControl: {
        requireLogin: false
      },
      notifications: {
        sendReminders: true,
        reminderSchedule: [7, 14, 21],
        completionNotification: true
      }
    }
  },
  {
    id: 'microaggressions-assessment',
    name: 'Microaggressions Assessment',
    description: 'Identify and address subtle forms of bias and exclusion in the workplace',
    category: 'belonging',
    tags: ['microaggressions', 'bias', 'inclusion', 'workplace-behavior'],
    previewImage: 'https://images.pexels.com/photos/3184419/pexels-photo-3184419.jpeg?auto=compress&cs=tinysrgb&w=400',
    sections: [
      {
        title: 'Workplace Interactions',
        description: 'Your experiences with everyday workplace interactions and behaviors',
        order: 1,
        questions: [
          {
            id: 'microagg-frequency',
            type: 'multiple-choice',
            title: 'How often do you experience comments or behaviors that make you feel excluded or different at work?',
            required: true,
            order: 1,
            options: ['Never', 'Rarely (less than monthly)', 'Sometimes (monthly)', 'Often (weekly)', 'Very often (daily)']
          },
          {
            id: 'microagg-types',
            type: 'multiple-choice',
            title: 'Which of the following have you experienced at work? (Select all that apply)',
            required: false,
            order: 2,
            options: [
              'Comments about my appearance or style',
              'Assumptions about my capabilities based on identity',
              'Being interrupted or talked over in meetings',
              'Having my ideas ignored then repeated by others',
              'Being asked to speak for my entire demographic group',
              'Comments about my accent or language',
              'Being excluded from informal gatherings',
              'Receiving unsolicited advice about fitting in',
              'None of the above'
            ],
            allowMultiple: true
          },
          {
            id: 'microagg-impact',
            type: 'matrix',
            title: 'When you experience subtle forms of bias, how does it affect you?',
            required: true,
            order: 3,
            matrixRows: [
              'My confidence at work',
              'My willingness to share ideas',
              'My sense of belonging',
              'My job satisfaction',
              'My trust in colleagues'
            ],
            matrixColumns: ['No impact', 'Slight impact', 'Moderate impact', 'Significant impact', 'Major impact'],
            matrixType: 'single'
          },
          {
            id: 'microagg-response',
            type: 'open-ended',
            title: 'What would help you feel more comfortable addressing microaggressions when they occur?',
            description: 'Think about support systems, training, or policies that would be helpful',
            required: false,
            order: 4,
            validation: {
              maxLength: 500
            }
          }
        ]
      },
      {
        title: 'Organizational Response',
        description: 'How well does your organization address subtle forms of bias and exclusion',
        order: 2,
        questions: [
          {
            id: 'org-awareness',
            type: 'likert-scale',
            title: 'My organization takes microaggressions and subtle bias seriously',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'reporting-comfort',
            type: 'likert-scale',
            title: 'I feel comfortable reporting incidents of subtle bias or exclusion',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          }
        ]
      }
    ],
    defaultSettings: {
      allowAnonymous: true,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      requireCompletion: false,
      accessControl: {
        requireLogin: false
      },
      notifications: {
        sendReminders: true,
        reminderSchedule: [7, 14],
        completionNotification: true
      }
    }
  },
  {
    id: 'leadership-effectiveness',
    name: 'Inclusive Leadership Effectiveness',
    description: 'Assess inclusive leadership behaviors and their impact on team dynamics',
    category: 'leadership',
    tags: ['leadership', 'inclusive-leadership', 'management', 'team-dynamics'],
    previewImage: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400',
    sections: [
      {
        title: 'Leadership Behaviors',
        description: 'Evaluate your leader\'s inclusive behaviors and practices',
        order: 1,
        questions: [
          {
            id: 'leader-listening',
            type: 'likert-scale',
            title: 'My immediate supervisor actively listens to diverse perspectives',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 7,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'leader-equity',
            type: 'likert-scale',
            title: 'My leader ensures fair distribution of opportunities and resources',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 7,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'leader-behaviors-matrix',
            type: 'matrix',
            title: 'How often does your leader demonstrate these inclusive behaviors?',
            required: true,
            order: 3,
            matrixRows: [
              'Acknowledges and addresses bias when it occurs',
              'Seeks input from diverse team members',
              'Advocates for team members\' career advancement',
              'Creates psychological safety for open dialogue',
              'Addresses exclusionary behaviors promptly',
              'Values different work styles and approaches'
            ],
            matrixColumns: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
            matrixType: 'single'
          }
        ]
      },
      {
        title: 'Team Impact',
        description: 'How inclusive leadership affects team performance and culture',
        order: 2,
        questions: [
          {
            id: 'team-psychological-safety',
            type: 'likert-scale',
            title: 'I feel safe expressing my authentic self on this team',
            required: true,
            order: 1,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'team-innovation',
            type: 'likert-scale',
            title: 'Our team leverages diverse perspectives to drive innovation',
            required: true,
            order: 2,
            scale: {
              min: 1,
              max: 5,
              minLabel: 'Strongly Disagree',
              maxLabel: 'Strongly Agree',
              midLabel: 'Neutral'
            }
          },
          {
            id: 'leadership-improvement',
            type: 'open-ended',
            title: 'What specific actions could your leader take to be more inclusive?',
            description: 'Provide constructive suggestions for leadership development',
            required: false,
            order: 3,
            validation: {
              maxLength: 750
            }
          }
        ]
      }
    ],
    defaultSettings: {
      allowAnonymous: false,
      allowSaveAndContinue: true,
      showProgressBar: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      requireCompletion: true,
      accessControl: {
        requireLogin: true
      },
      notifications: {
        sendReminders: true,
        reminderSchedule: [3, 7, 14],
        completionNotification: true
      }
    }
  }
];

export const questionTypes = [
  {
    id: 'multiple-choice',
    name: 'Multiple Choice',
    description: 'Single or multiple selection from predefined options',
    icon: 'CheckCircle',
    category: 'Selection'
  },
  {
    id: 'likert-scale',
    name: 'Likert Scale',
    description: 'Rating scale for measuring agreement or satisfaction',
    icon: 'BarChart3',
    category: 'Rating'
  },
  {
    id: 'ranking',
    name: 'Ranking',
    description: 'Rank items in order of preference or importance',
    icon: 'ArrowUpDown',
    category: 'Ordering'
  },
  {
    id: 'open-ended',
    name: 'Open-Ended',
    description: 'Free text response for detailed feedback',
    icon: 'MessageSquare',
    category: 'Text'
  },
  {
    id: 'matrix',
    name: 'Matrix/Grid',
    description: 'Multiple questions with the same response options',
    icon: 'Grid3X3',
    category: 'Complex'
  },
  {
    id: 'demographics',
    name: 'Demographics',
    description: 'Collect demographic information for analysis',
    icon: 'Users',
    category: 'Data'
  }
];

// Enhanced AI-powered question suggestions organized by category and context
export const aiGeneratedQuestions = {
  belonging: [
    {
      type: 'likert-scale',
      title: 'I feel comfortable expressing my authentic self at work',
      description: 'Measures psychological safety and authenticity in the workplace',
      scale: {
        min: 1,
        max: 5,
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree',
        midLabel: 'Neutral'
      },
      category: 'Belonging & Authenticity',
      tags: ['authenticity', 'psychological-safety']
    },
    {
      type: 'likert-scale',
      title: 'My unique background and perspective are valued by my team',
      description: 'Assesses appreciation for diverse perspectives and experiences',
      scale: {
        min: 1,
        max: 7,
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree',
        midLabel: 'Neutral'
      },
      category: 'Belonging & Value',
      tags: ['diversity', 'value-recognition']
    },
    {
      type: 'open-ended',
      title: 'Describe a time when you felt most included and valued at work',
      description: 'Captures positive inclusion experiences to identify best practices',
      validation: {
        minLength: 50,
        maxLength: 500
      },
      category: 'Positive Experiences',
      tags: ['inclusion-stories', 'best-practices']
    }
  ],
  equity: [
    {
      type: 'multiple-choice',
      title: 'Which of the following best describes your experience with career advancement opportunities?',
      description: 'Assesses equity in career development and advancement',
      options: [
        'I have clear pathways and support for advancement',
        'Opportunities exist but are not clearly communicated',
        'I face barriers that others do not seem to experience',
        'I am unsure about advancement opportunities',
        'I do not see advancement as relevant to my role'
      ],
      allowMultiple: false,
      allowOther: true,
      category: 'Equity & Advancement',
      tags: ['career-advancement', 'barriers']
    },
    {
      type: 'matrix',
      title: 'Rate the fairness of these organizational processes',
      description: 'Evaluates equity across key organizational systems',
      matrixRows: [
        'Hiring and recruitment practices',
        'Performance evaluation process',
        'Promotion and advancement decisions',
        'Work assignment distribution',
        'Access to training and development',
        'Recognition and rewards systems'
      ],
      matrixColumns: ['Very Unfair', 'Unfair', 'Neutral', 'Fair', 'Very Fair'],
      matrixType: 'single',
      category: 'Systemic Equity',
      tags: ['fairness', 'organizational-processes']
    }
  ],
  inclusion: [
    {
      type: 'ranking',
      title: 'Rank these factors by their importance for creating an inclusive workplace (1 = most important)',
      description: 'Identifies organizational priorities for inclusion initiatives',
      rankingItems: [
        'Leadership commitment and modeling',
        'Clear policies against discrimination',
        'Employee resource groups and networks',
        'Inclusive hiring and promotion practices',
        'Regular training and education',
        'Open dialogue and feedback mechanisms'
      ],
      maxRankings: 6,
      category: 'Inclusion Priorities',
      tags: ['priorities', 'organizational-change']
    },
    {
      type: 'matrix',
      title: 'Rate your experience with the following aspects of our organization',
      description: 'Comprehensive assessment across multiple inclusion dimensions',
      matrixRows: [
        'Feeling valued for my contributions',
        'Having my voice heard in decisions',
        'Receiving fair treatment from supervisors',
        'Access to development opportunities',
        'Feeling safe to share concerns'
      ],
      matrixColumns: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
      matrixType: 'single',
      category: 'Multi-Dimensional Assessment',
      tags: ['comprehensive', 'experience-rating']
    },
    {
      type: 'multiple-choice',
      title: 'In the past year, have you experienced or witnessed any of the following? (Select all that apply)',
      description: 'Identifies specific incidents and patterns of exclusion or bias',
      options: [
        'Microaggressions or subtle bias',
        'Exclusion from informal networks or conversations',
        'Unequal access to opportunities or resources',
        'Discrimination based on identity',
        'Retaliation for speaking up about concerns',
        'None of the above',
        'Prefer not to answer'
      ],
      allowMultiple: true,
      allowOther: true,
      category: 'Experiences & Incidents',
      tags: ['incidents', 'bias-patterns']
    }
  ],
  leadership: [
    {
      type: 'likert-scale',
      title: 'My manager actively supports diversity and inclusion in our team',
      description: 'Measures leadership commitment to DEI at the direct supervisor level',
      scale: {
        min: 1,
        max: 7,
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree',
        midLabel: 'Neutral'
      },
      category: 'Leadership & Management',
      tags: ['management', 'leadership-commitment']
    },
    {
      type: 'matrix',
      title: 'How effectively does leadership demonstrate inclusive behaviors?',
      description: 'Evaluates specific inclusive leadership competencies',
      matrixRows: [
        'Listens to diverse perspectives without judgment',
        'Takes action to address bias and discrimination',
        'Creates opportunities for all team members',
        'Acknowledges and learns from their own mistakes',
        'Advocates for underrepresented team members'
      ],
      matrixColumns: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'],
      matrixType: 'single',
      category: 'Leadership Effectiveness',
      tags: ['leadership-behaviors', 'effectiveness']
    }
  ],
  microaggressions: [
    {
      type: 'multiple-choice',
      title: 'How comfortable do you feel addressing microaggressions when they occur?',
      description: 'Measures confidence and support for addressing subtle bias',
      options: [
        'Very comfortable - I always address them',
        'Somewhat comfortable - I address them sometimes',
        'Neutral - depends on the situation',
        'Somewhat uncomfortable - I rarely address them',
        'Very uncomfortable - I never address them',
        'I\'m not sure what constitutes a microaggression'
      ],
      allowMultiple: false,
      allowOther: false,
      category: 'Microaggression Response',
      tags: ['response-comfort', 'intervention']
    },
    {
      type: 'ranking',
      title: 'Rank these approaches by how helpful they would be for addressing microaggressions',
      description: 'Identifies preferred organizational responses to subtle bias',
      rankingItems: [
        'Bystander intervention training',
        'Clear reporting mechanisms',
        'Leadership accountability measures',
        'Regular awareness workshops',
        'Peer support networks',
        'Restorative justice approaches'
      ],
      maxRankings: 6,
      category: 'Intervention Strategies',
      tags: ['intervention', 'organizational-response']
    }
  ],
  demographics: [
    {
      type: 'demographics',
      title: 'Which of the following best describes your racial/ethnic identity?',
      description: 'Census-aligned demographic data for intersectional analysis',
      options: [
        'American Indian or Alaska Native',
        'Asian',
        'Black or African American',
        'Hispanic or Latino',
        'Native Hawaiian or Other Pacific Islander',
        'White',
        'Two or more races',
        'Prefer not to answer'
      ],
      allowMultiple: true,
      allowOther: true,
      category: 'Demographics',
      tags: ['race-ethnicity', 'identity']
    },
    {
      type: 'demographics',
      title: 'What is your gender identity?',
      description: 'Inclusive gender identity options for comprehensive analysis',
      options: [
        'Woman',
        'Man',
        'Non-binary',
        'Transgender woman',
        'Transgender man',
        'Genderfluid',
        'Agender',
        'Prefer to self-describe',
        'Prefer not to answer'
      ],
      allowMultiple: false,
      allowOther: true,
      category: 'Demographics',
      tags: ['gender-identity', 'identity']
    },
    {
      type: 'multiple-choice',
      title: 'Do you identify as a person with a disability?',
      description: 'Disability status for accessibility and accommodation analysis',
      options: [
        'Yes, I have a visible disability',
        'Yes, I have a non-visible disability',
        'No, I do not have a disability',
        'Prefer not to answer'
      ],
      allowMultiple: false,
      allowOther: false,
      category: 'Demographics',
      tags: ['disability', 'accessibility']
    }
  ]
};

// Legacy format for backward compatibility - flattens all categories
export const aiGeneratedQuestionsLegacy = [
  ...aiGeneratedQuestions.belonging,
  ...aiGeneratedQuestions.equity,
  ...aiGeneratedQuestions.inclusion,
  ...aiGeneratedQuestions.leadership,
  ...aiGeneratedQuestions.microaggressions,
  ...aiGeneratedQuestions.demographics
];

export const censusDemographicOptions = {
  race: [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Two or more races',
    'Prefer not to answer'
  ],
  gender: [
    'Woman',
    'Man',
    'Non-binary',
    'Transgender woman',
    'Transgender man',
    'Genderfluid',
    'Agender',
    'Prefer to self-describe',
    'Prefer not to answer'
  ],
  age: [
    'Under 18',
    '18-24',
    '25-34',
    '35-44',
    '45-54',
    '55-64',
    '65 or older',
    'Prefer not to answer'
  ],
  education: [
    'Less than high school',
    'High school diploma or equivalent',
    'Some college, no degree',
    'Associate degree',
    'Bachelor\'s degree',
    'Master\'s degree',
    'Professional degree',
    'Doctoral degree',
    'Prefer not to answer'
  ],
  disability: [
    'Yes, I have a visible disability',
    'Yes, I have a non-visible disability',
    'No, I do not have a disability',
    'Prefer not to answer'
  ],
  veteranStatus: [
    'Veteran',
    'Active military',
    'Military spouse/family',
    'Not applicable',
    'Prefer not to answer'
  ],
  sexualOrientation: [
    'Heterosexual/Straight',
    'Gay',
    'Lesbian',
    'Bisexual',
    'Pansexual',
    'Asexual',
    'Queer',
    'Prefer to self-describe',
    'Prefer not to answer'
  ]
};

export const defaultBranding: SurveyBranding = {
  primaryColor: '#FF8895', // Sunrise Orange
  secondaryColor: '#D72638', // Deep Red
  accentColor: '#3A7DFF', // Sky Blue
  fontFamily: {
    heading: 'Montserrat',
    body: 'Lato',
    highlight: 'Quicksand'
  }
};