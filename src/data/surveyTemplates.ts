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