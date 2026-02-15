import {
  CourseValidationError,
  deleteCourseFromDatabase,
  getAllCoursesFromDatabase,
  syncCourseToDatabase,
} from '../dal/adminCourses';
import { fetchPublishedCourses, fetchCourse } from '../dal/clientCourses';
import { Course, Module, Lesson } from '../types/courseTypes';
import { slugify, normalizeCourse } from '../utils/courseNormalization';
import { getUserSession, getActiveOrgPreference } from '../lib/secureStorage';
import { getAssignmentsForUser } from '../utils/assignmentStorage';
import type { CourseAssignment } from '../types/assignment';
import { refreshRuntimeStatus, getRuntimeStatus } from '../state/runtimeStatus';
import { loadStoredCourseProgress } from '../utils/courseProgress';
import { hasStoredProgressHistory } from '../utils/courseAvailability';
import { saveDraftSnapshot, markDraftSynced, deleteDraftSnapshot } from '../dal/courseDrafts';
import { ApiError } from '../utils/apiClient';
import { cloneWithCanonicalOrgId, resolveOrgIdFromCarrier, stampCanonicalOrgId } from '../utils/orgFieldUtils';
import { nanoid } from 'nanoid';

// Course data types
export interface ScenarioChoice {
  id: string;
  text: string;
  feedback: string;
  isCorrect: boolean;
  nextScenarioId?: string; // For branching scenarios
  points?: number;
}

export interface Scenario {
  id: string;
  title: string;
  text: string;
  image?: string;
  choices: ScenarioChoice[];
  isStartingScenario?: boolean;
  isEndingScenario?: boolean;
}

export interface DragDropItem {
  id: string;
  text: string;
  image?: string;
  category?: string;
}

export interface DragDropZone {
  id: string;
  label: string;
  acceptedItems: string[]; // Array of item IDs that belong in this zone
  feedback: string;
  image?: string;
}

export interface DragDropExercise {
  id: string;
  title: string;
  instructions: string;
  items: DragDropItem[];
  zones: DragDropZone[];
  shuffleItems?: boolean;
}

export interface ClickableRegion {
  id: string;
  x: number; // X coordinate (percentage)
  y: number; // Y coordinate (percentage)
  width: number; // Width (percentage)
  height: number; // Height (percentage)
  feedback: string;
  isCorrect: boolean;
  points?: number;
}

export interface ClickableGraphic {
  id: string;
  title: string;
  instructions: string;
  image: string;
  regions: ClickableRegion[];
  allowMultipleClicks?: boolean;
}

export interface EmbeddedQuizQuestion {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[]; // For multiple choice
  correctAnswer: string | number; // Answer text or option index
  explanation: string;
  points?: number;
}

export interface EmbeddedQuiz {
  id: string;
  title: string;
  instructions?: string;
  questions: EmbeddedQuizQuestion[];
  passingScore?: number;
  showResultsImmediately?: boolean;
}

export interface InteractiveElement {
  id: string;
  type: 'scenario' | 'drag-drop' | 'clickable-graphic' | 'embedded-quiz';
  title: string;
  order: number;
  data: Scenario[] | DragDropExercise | ClickableGraphic | EmbeddedQuiz;
}

// Interfaces now imported from courseTypes

// Load courses from localStorage or use defaults
const _loadCoursesFromLocalStorage = (): { [key: string]: Course } => ({ });

const _saveCoursesToLocalStorage = (_courses: { [key: string]: Course }): void => {
  // persistence handled via CourseService / API gateway
};

export const createModuleId = (): string => `mod-${nanoid(10)}`;
export const createLessonId = (): string => `les-${nanoid(10)}`;

export const sanitizeModuleGraph = (modules: Module[] = []): Module[] =>
  modules.map((module, moduleIndex) => {
    const moduleId = module.id || createModuleId();
    const normalizedLessons = (module.lessons || []).map((lesson, lessonIndex) => {
      const lessonId = lesson.id || createLessonId();
      const resolvedModuleId = lesson.module_id || (lesson as any).moduleId || moduleId;
      return {
        ...lesson,
        id: lessonId,
        module_id: resolvedModuleId,
        moduleId: resolvedModuleId,
        order: lesson.order ?? lessonIndex + 1,
      };
    });

    return {
      ...module,
      id: moduleId,
      order: module.order ?? moduleIndex + 1,
      lessons: normalizedLessons,
    };
  });

const createCoursePayloadForApi = (course: Course): Course => {
  const { clone } = cloneWithCanonicalOrgId(course, { removeAliases: true });
  const sanitizedModules = sanitizeModuleGraph((clone as Course).modules || []);
  (clone as Course).modules = sanitizedModules;
  return clone as Course;
};

// Default course data
const getDefaultCourses = (): { [key: string]: Course } => ({
  'foundations': {
    id: 'foundations',
    title: 'Foundations of Inclusive Leadership',
    description: 'Build the fundamental skills needed to lead with empathy and create psychological safety for your team.',
    status: 'published',
    thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
    duration: '45 min',
    difficulty: 'Beginner',
    enrollments: 247,
    completions: 198,
    completionRate: 80,
    avgRating: 4.9,
    totalRatings: 156,
    createdBy: 'Mya Dennis',
    createdDate: '2025-01-15',
    lastUpdated: '2025-02-15',
    publishedDate: '2025-01-20',
    dueDate: '2025-04-15',
    estimatedTime: '45-60 minutes',
    prerequisites: [
      'Basic understanding of leadership principles',
      'Completion of organizational onboarding'
    ],
    learningObjectives: [
      'Understand the core principles of inclusive leadership',
      'Recognize the importance of psychological safety in teams',
      'Develop skills for creating inclusive environments',
      'Practice self-reflection and awareness techniques'
    ],
    certification: {
      available: true,
      name: 'Inclusive Leadership Foundation Certificate',
      requirements: [
        'Complete all 4 lessons',
        'Pass knowledge check with 80% or higher',
        'Submit leadership reflection worksheet'
      ],
      validFor: '1 year',
      renewalRequired: true
    },
    tags: ['Leadership', 'Empathy', 'Psychological Safety'],
    keyTakeaways: [
      'Psychological safety is the foundation of inclusive leadership',
      'Vulnerability builds trust and encourages authentic communication',
      'Self-awareness is crucial for recognizing your impact on others',
      'Creating inclusive environments requires intentional daily actions'
    ],
    type: 'Video + Worksheet',
    lessons: 4,
    rating: 4.9,
    progress: 100,
    modules: [
      {
        id: 'module-1',
        title: 'Introduction to Inclusive Leadership',
        description: 'Explore the foundations and principles of inclusive leadership',
        duration: '15 min',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            title: 'What is Inclusive Leadership?',
            type: 'video',
            duration: '8 min',
            content: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              transcript: 'Welcome to our comprehensive course on inclusive leadership...',
              notes: 'Key concepts: empathy, psychological safety, authentic leadership'
            },
            completed: true,
            order: 1
          },
          {
            id: 'lesson-1-2',
            title: 'The Business Case for Inclusion',
            type: 'interactive',
            duration: '7 min',
            content: {
              elements: [
                {
                  id: 'scenario-1',
                  type: 'scenario',
                  title: 'Meeting Dynamics Challenge',
                  order: 1,
                  data: [
                    {
                      id: 'scenario-1-start',
                      title: 'The Situation',
                      text: 'You notice that during team meetings, certain team members rarely speak up while others dominate the conversation. As an inclusive leader, how would you address this?',
                      image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
                      isStartingScenario: true,
                      choices: [
                        {
                          id: 'choice-1',
                          text: 'Directly call on quiet team members to share their thoughts',
                          feedback: 'This approach might put people on the spot and create discomfort. Consider how this might affect psychological safety.',
                          isCorrect: false,
                          nextScenarioId: 'scenario-1-direct',
                          points: 0
                        },
                        {
                          id: 'choice-2',
                          text: 'Implement structured discussion formats like round-robin or small group breakouts',
                          feedback: 'Excellent! This creates equal opportunities for participation while maintaining psychological safety.',
                          isCorrect: true,
                          nextScenarioId: 'scenario-1-structured',
                          points: 10
                        },
                        {
                          id: 'choice-3',
                          text: 'Address the issue privately with the dominant speakers',
                          feedback: 'This is a good start, but you also need to create structures that naturally encourage balanced participation.',
                          isCorrect: false,
                          nextScenarioId: 'scenario-1-private',
                          points: 5
                        }
                      ]
                    },
                    {
                      id: 'scenario-1-structured',
                      title: 'Follow-up Action',
                      text: 'Great choice! You\'ve implemented structured discussions. Now a team member approaches you after the meeting saying they still feel hesitant to share. What\'s your next step?',
                      choices: [
                        {
                          id: 'choice-4',
                          text: 'Schedule a one-on-one conversation to understand their concerns',
                          feedback: 'Perfect! Individual conversations help you understand specific barriers and build trust.',
                          isCorrect: true,
                          points: 10
                        },
                        {
                          id: 'choice-5',
                          text: 'Encourage them to speak up more in the next meeting',
                          feedback: 'This doesn\'t address the underlying concerns that make them hesitant to participate.',
                          isCorrect: false,
                          points: 0
                        }
                      ],
                      isEndingScenario: true
                    },
                    {
                      id: 'scenario-1-direct',
                      title: 'Unintended Consequences',
                      text: 'You called on quiet team members directly. You notice some of them seem uncomfortable and one person hasn\'t attended the last two meetings. How do you recover?',
                      choices: [
                        {
                          id: 'choice-6',
                          text: 'Reach out individually to apologize and understand their perspective',
                          feedback: 'Good recovery! Acknowledging the impact and seeking to understand shows inclusive leadership.',
                          isCorrect: true,
                          points: 8
                        },
                        {
                          id: 'choice-7',
                          text: 'Continue the same approach - they need to learn to speak up',
                          feedback: 'This approach ignores the impact on psychological safety and may worsen the situation.',
                          isCorrect: false,
                          points: 0
                        }
                      ],
                      isEndingScenario: true
                    },
                    {
                      id: 'scenario-1-private',
                      title: 'Partial Solution',
                      text: 'You spoke privately with the dominant speakers. The meetings are less dominated, but participation is still uneven. What additional step would be most effective?',
                      choices: [
                        {
                          id: 'choice-8',
                          text: 'Implement structured discussion formats to create equal opportunities',
                          feedback: 'Exactly! Combining individual conversations with structural changes creates lasting improvement.',
                          isCorrect: true,
                          points: 10
                        },
                        {
                          id: 'choice-9',
                          text: 'Wait and see if the situation improves naturally',
                          feedback: 'Passive approaches rarely create the inclusive environments we want to build.',
                          isCorrect: false,
                          points: 0
                        }
                      ],
                      isEndingScenario: true
                    }
                  ]
                }
              ],
              currentScenarioId: 'scenario-1-start',
              userChoices: {},
              completedElements: []
            },
            completed: true,
            order: 2
          }
        ],
        resources: [
          {
            id: 'resource-1-1',
            title: 'Leadership Self-Assessment',
            type: 'pdf',
            size: '2.3 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/leadership-assessment.pdf',
            downloadable: true
          }
        ]
      },
      {
        id: 'module-2',
        title: 'Building Psychological Safety',
        description: 'Learn how to create environments where team members feel safe to speak up',
        duration: '20 min',
        order: 2,
        lessons: [
          {
            id: 'lesson-2-1',
            title: 'Understanding Psychological Safety',
            type: 'video',
            duration: '12 min',
            content: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              transcript: 'Psychological safety is the belief that you can speak up...',
              notes: 'Key concepts about psychological safety and team dynamics'
            },
            completed: true,
            order: 1
          }
        ],
        resources: [
          {
            id: 'resource-2-1',
            title: 'Psychological Safety Checklist',
            type: 'pdf',
            size: '1.8 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/psych-safety-checklist.pdf',
            downloadable: true
          }
        ]
      }
    ]
  },
  'bias': {
    id: 'bias',
    title: 'Recognizing and Mitigating Bias',
    description: 'Learn to identify unconscious bias in decision-making and develop strategies to create more equitable processes.',
    status: 'published',
    thumbnail: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
    duration: '60 min',
    difficulty: 'Intermediate',
    enrollments: 189,
    completions: 142,
    completionRate: 75,
    avgRating: 4.8,
    totalRatings: 142,
    createdBy: 'Mya Dennis',
    createdDate: '2025-01-10',
    lastUpdated: '2025-02-10',
    publishedDate: '2025-01-15',
    dueDate: '2025-04-20',
    estimatedTime: '60-75 minutes',
    prerequisites: [
      'Completion of Foundations of Inclusive Leadership'
    ],
    learningObjectives: [
      'Identify different types of unconscious bias',
      'Understand how bias affects decision-making',
      'Develop strategies for bias mitigation',
      'Create structured decision-making processes'
    ],
    certification: {
      available: true,
      name: 'Bias Recognition and Mitigation Certificate',
      requirements: [
        'Complete all 5 lessons',
        'Pass final quiz with 85% or higher',
        'Complete bias assessment exercise'
      ],
      validFor: '1 year',
      renewalRequired: true
    },
    tags: ['Bias', 'Equity', 'Decision Making'],
    keyTakeaways: [
      'Everyone has unconscious biases that affect decision-making',
      'Structured processes help reduce the impact of bias',
      'Regular bias training and awareness are essential',
      'Accountability systems ensure consistent application of fair practices'
    ],
    type: 'Interactive + Quiz',
    lessons: 5,
    rating: 4.8,
    progress: 75,
    modules: [
      {
        id: 'module-1',
        title: 'Understanding Unconscious Bias',
        description: 'Learn about different types of bias and their impact',
        duration: '25 min',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            title: 'Types of Unconscious Bias',
            type: 'video',
            duration: '15 min',
            content: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              transcript: 'There are many types of unconscious bias...',
              notes: 'Key bias types: confirmation bias, affinity bias, halo effect',
              questions: [
                {
                  id: 'bias-q1',
                  text: 'Which of the following is an example of confirmation bias?',
                  options: [
                    'Hiring someone because they went to the same school as you',
                    'Only seeking information that supports your existing beliefs',
                    'Assuming someone is qualified based on their appearance',
                    'Making decisions based on first impressions'
                  ],
                  correctAnswerIndex: 1,
                  explanation: 'Confirmation bias is the tendency to search for, interpret, and recall information that confirms our pre-existing beliefs or hypotheses.'
                },
                {
                  id: 'bias-q2',
                  text: 'What is affinity bias?',
                  options: [
                    'The tendency to favor people who are similar to ourselves',
                    'The tendency to make quick judgments based on first impressions',
                    'The tendency to seek information that confirms our beliefs',
                    'The tendency to be influenced by recent events'
                  ],
                  correctAnswerIndex: 0,
                  explanation: 'Affinity bias is the unconscious tendency to get along with others who are like us, which can lead to favoritism in hiring and promotion decisions.'
                },
                {
                  id: 'bias-q3',
                  text: 'True or False: Everyone has unconscious biases.',
                  options: [
                    'True',
                    'False'
                  ],
                  correctAnswerIndex: 0,
                  explanation: 'Research shows that everyone has unconscious biases. The key is becoming aware of them and developing strategies to mitigate their impact.'
                }
              ]
            },
            completed: true,
            order: 1
          },
          {
            id: 'lesson-1-2',
            title: 'Bias Self-Assessment',
            type: 'interactive',
            duration: '10 min',
            content: {
              elements: [
                {
                  id: 'bias-scenario-1',
                  type: 'scenario',
                  title: 'Hiring Bias Challenge',
                  order: 1,
                  data: [
                    {
                      id: 'bias-start',
                      title: 'The Hiring Decision',
                      text: 'During a hiring process, you find yourself immediately drawn to a candidate who attended the same university as you. You feel a strong connection and sense of familiarity.',
                      image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
                      isStartingScenario: true,
                      choices: [
                        {
                          id: 'bias-choice-1',
                          text: 'Trust your instinct since shared experiences create good team fit',
                          feedback: 'This demonstrates affinity bias - favoring people similar to yourself. This can lead to less diverse and innovative teams.',
                          isCorrect: false,
                          nextScenarioId: 'bias-affinity',
                          points: 0
                        },
                        {
                          id: 'bias-choice-2',
                          text: 'Acknowledge the bias and focus evaluation on job-relevant criteria',
                          feedback: 'Excellent! Recognizing bias is the first step to fair decision-making. This approach ensures merit-based hiring.',
                          isCorrect: true,
                          nextScenarioId: 'bias-structured',
                          points: 10
                        },
                        {
                          id: 'bias-choice-3',
                          text: 'Ask a colleague to review your assessment',
                          feedback: 'Good instinct! Getting a second opinion can help counteract bias, though self-awareness is also important.',
                          isCorrect: true,
                          nextScenarioId: 'bias-colleague',
                          points: 8
                        }
                      ]
                    },
                    {
                      id: 'bias-structured',
                      title: 'Structured Evaluation',
                      text: 'You\'ve implemented a structured evaluation focusing on job-relevant criteria. All candidates are assessed using the same framework. This is an example of:',
                      choices: [
                        {
                          id: 'bias-choice-4',
                          text: 'Bias mitigation through structured processes',
                          feedback: 'Correct! Structured processes are one of the most effective ways to reduce the impact of unconscious bias.',
                          isCorrect: true,
                          points: 10
                        },
                        {
                          id: 'bias-choice-5',
                          text: 'Overthinking the hiring process',
                          feedback: 'Not quite. Structure in hiring actually improves decision quality and reduces bias.',
                          isCorrect: false,
                          points: 0
                        }
                      ],
                      isEndingScenario: true
                    }
                  ]
                },
                {
                  id: 'bias-dragdrop-1',
                  type: 'drag-drop',
                  title: 'Bias Types Classification',
                  order: 2,
                  data: {
                    id: 'bias-types-exercise',
                    title: 'Classify Types of Bias',
                    instructions: 'Drag each scenario to the correct type of bias it demonstrates.',
                    items: [
                      {
                        id: 'scenario-1',
                        text: 'Assuming a young employee lacks experience',
                        category: 'age-bias'
                      },
                      {
                        id: 'scenario-2',
                        text: 'Favoring candidates from prestigious schools',
                        category: 'affinity-bias'
                      },
                      {
                        id: 'scenario-3',
                        text: 'Believing first impressions predict performance',
                        category: 'halo-effect'
                      },
                      {
                        id: 'scenario-4',
                        text: 'Seeking information that confirms existing beliefs',
                        category: 'confirmation-bias'
                      }
                    ],
                    zones: [
                      {
                        id: 'age-bias-zone',
                        label: 'Age Bias',
                        acceptedItems: ['scenario-1'],
                        feedback: 'Correct! Age bias involves making assumptions based on someone\'s age rather than their actual capabilities.'
                      },
                      {
                        id: 'affinity-bias-zone',
                        label: 'Affinity Bias',
                        acceptedItems: ['scenario-2'],
                        feedback: 'Right! Affinity bias is favoring people who are similar to us in background, education, or experience.'
                      },
                      {
                        id: 'halo-effect-zone',
                        label: 'Halo Effect',
                        acceptedItems: ['scenario-3'],
                        feedback: 'Exactly! The halo effect is when one positive trait influences our overall impression.'
                      },
                      {
                        id: 'confirmation-bias-zone',
                        label: 'Confirmation Bias',
                        acceptedItems: ['scenario-4'],
                        feedback: 'Perfect! Confirmation bias is seeking information that supports what we already believe.'
                      }
                    ],
                    shuffleItems: true
                  }
                }
              ],
              currentScenarioId: 'bias-start',
              userChoices: {},
              completedElements: []
            },
            completed: true,
            order: 2
          }
        ],
        resources: [
          {
            id: 'resource-1-1',
            title: 'Bias Recognition Toolkit',
            type: 'pdf',
            size: '3.1 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/bias-toolkit.pdf',
            downloadable: true
          }
        ]
      }
    ]
  },
  'empathy': {
    id: 'empathy',
    title: 'Empathy in Action',
    description: 'Develop practical empathy skills through real-world scenarios and case studies from diverse organizations.',
    status: 'published',
    thumbnail: 'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=800',
    duration: '40 min',
    difficulty: 'Intermediate',
    enrollments: 156,
    completions: 124,
    completionRate: 79,
    avgRating: 4.9,
    totalRatings: 124,
    createdBy: 'Mya Dennis',
    createdDate: '2025-02-05',
    lastUpdated: '2025-02-05',
    publishedDate: '2025-02-05',
    estimatedTime: '40-50 minutes',
    prerequisites: [],
    learningObjectives: [
      'Develop active listening techniques',
      'Practice perspective-taking exercises',
      'Learn to respond to team conflicts',
      'Build emotional intelligence'
    ],
    tags: ['Empathy', 'Case Studies', 'Emotional Intelligence'],
    keyTakeaways: [
      'Active listening techniques',
      'Perspective-taking exercises',
      'Responding to team conflicts',
      'Building emotional intelligence'
    ],
    type: 'Case Study',
    lessons: 3,
    rating: 4.9,
    progress: 50,
    modules: [
      {
        id: 'module-1',
        title: 'Foundations of Empathy',
        description: 'Understanding empathy and its role in leadership',
        duration: '40 min',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            title: 'What is Empathy?',
            type: 'video',
            duration: '15 min',
            content: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
              transcript: 'Empathy is the ability to understand and share feelings...',
              notes: 'Cognitive vs emotional empathy, compassionate empathy'
            },
            completed: true,
            order: 1
          },
          {
            id: 'lesson-1-2',
            title: 'Active Listening Practice',
            type: 'interactive',
            duration: '15 min',
            content: {
              elements: [
                {
                  id: 'empathy-scenario-1',
                  type: 'scenario',
                  title: 'Upset Team Member',
                  order: 1,
                  data: [
                    {
                      id: 'empathy-start',
                      title: 'The Situation',
                      text: 'A team member approaches you visibly upset about a project decision. Their body language suggests they\'re frustrated and feeling unheard.',
                      image: 'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=800',
                      isStartingScenario: true,
                      choices: [
                        {
                          id: 'empathy-choice-1',
                          text: 'Listen fully before offering solutions',
                          feedback: 'Excellent! Active listening builds trust and understanding. This creates space for them to feel heard.',
                          isCorrect: true,
                          nextScenarioId: 'empathy-listen',
                          points: 10
                        },
                        {
                          id: 'empathy-choice-2',
                          text: 'Immediately offer advice to solve their problem',
                          feedback: 'This misses the opportunity to truly understand their perspective and may make them feel more unheard.',
                          isCorrect: false,
                          nextScenarioId: 'empathy-advice',
                          points: 0
                        },
                        {
                          id: 'empathy-choice-3',
                          text: 'Ask them to schedule a meeting to discuss it later',
                          feedback: 'While scheduling can be appropriate, their immediate emotional state suggests they need to be heard now.',
                          isCorrect: false,
                          nextScenarioId: 'empathy-delay',
                          points: 3
                        }
                      ]
                    },
                    {
                      id: 'empathy-listen',
                      title: 'Active Listening',
                      text: 'You listen carefully as they explain their frustration. They feel their input wasn\'t considered in the decision. They\'re now looking to you for validation. How do you respond?',
                      choices: [
                        {
                          id: 'empathy-choice-4',
                          text: 'Acknowledge their feelings and ask clarifying questions',
                          feedback: 'Perfect! You\'re demonstrating empathy and seeking to understand their full perspective.',
                          isCorrect: true,
                          points: 10
                        },
                        {
                          id: 'empathy-choice-5',
                          text: 'Explain why the decision was made the way it was',
                          feedback: 'While explanation may be needed later, right now they need to feel heard and validated.',
                          isCorrect: false,
                          points: 2
                        }
                      ],
                      isEndingScenario: true
                    },
                    {
                      id: 'empathy-advice',
                      title: 'Missed Opportunity',
                      text: 'You offered immediate solutions, but they seem more frustrated. They say "You\'re not listening to me!" How do you recover?',
                      choices: [
                        {
                          id: 'empathy-choice-6',
                          text: 'Stop, apologize, and ask them to help you understand',
                          feedback: 'Great recovery! Acknowledging your mistake and refocusing on understanding shows humility and empathy.',
                          isCorrect: true,
                          points: 8
                        },
                        {
                          id: 'empathy-choice-7',
                          text: 'Defend your approach and explain you were trying to help',
                          feedback: 'This defensive response will likely escalate the situation and damage trust.',
                          isCorrect: false,
                          points: 0
                        }
                      ],
                      isEndingScenario: true
                    },
                    {
                      id: 'empathy-delay',
                      title: 'Emotional Needs',
                      text: 'They reluctantly agree to schedule a meeting but seem deflated. You realize they needed immediate emotional support. What do you do?',
                      choices: [
                        {
                          id: 'empathy-choice-8',
                          text: 'Recognize their immediate need and offer to talk now',
                          feedback: 'Good adjustment! Recognizing and responding to emotional needs in the moment shows empathetic leadership.',
                          isCorrect: true,
                          points: 7
                        },
                        {
                          id: 'empathy-choice-9',
                          text: 'Stick with the scheduled meeting approach',
                          feedback: 'Missing the emotional component of leadership can damage relationships and trust.',
                          isCorrect: false,
                          points: 1
                        }
                      ],
                      isEndingScenario: true
                    }
                  ]
                },
                {
                  id: 'empathy-dragdrop-1',
                  type: 'drag-drop',
                  title: 'Empathy Skills Matching',
                  order: 2,
                  data: {
                    id: 'empathy-skills-exercise',
                    title: 'Match Empathy Skills to Situations',
                    instructions: 'Drag each empathy skill to the situation where it would be most effective.',
                    items: [
                      {
                        id: 'skill-1',
                        text: 'Active Listening',
                        category: 'communication'
                      },
                      {
                        id: 'skill-2',
                        text: 'Perspective Taking',
                        category: 'cognitive'
                      },
                      {
                        id: 'skill-3',
                        text: 'Emotional Validation',
                        category: 'emotional'
                      },
                      {
                        id: 'skill-4',
                        text: 'Reflective Questioning',
                        category: 'communication'
                      }
                    ],
                    zones: [
                      {
                        id: 'zone-1',
                        label: 'Team member is sharing a personal struggle',
                        acceptedItems: ['skill-1', 'skill-3'],
                        feedback: 'Correct! Active listening and emotional validation are key when someone is sharing personal challenges.'
                      },
                      {
                        id: 'zone-2',
                        label: 'Conflict between two team members',
                        acceptedItems: ['skill-2', 'skill-4'],
                        feedback: 'Right! Understanding both perspectives and asking reflective questions helps resolve conflicts.'
                      }
                    ],
                    shuffleItems: true
                  }
                },
                {
                  id: 'empathy-clickable-1',
                  type: 'clickable-graphic',
                  title: 'Reading Body Language',
                  order: 3,
                  data: {
                    id: 'body-language-exercise',
                    title: 'Identify Signs of Discomfort',
                    instructions: 'Click on the areas that might indicate someone is feeling uncomfortable or excluded in this meeting scenario.',
                    image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
                    regions: [
                      {
                        id: 'region-1',
                        x: 20,
                        y: 30,
                        width: 15,
                        height: 20,
                        feedback: 'Correct! Crossed arms often indicate defensiveness or discomfort.',
                        isCorrect: true,
                        points: 5
                      },
                      {
                        id: 'region-2',
                        x: 60,
                        y: 25,
                        width: 12,
                        height: 15,
                        feedback: 'Good observation! Avoiding eye contact can signal disengagement or discomfort.',
                        isCorrect: true,
                        points: 5
                      },
                      {
                        id: 'region-3',
                        x: 45,
                        y: 60,
                        width: 10,
                        height: 10,
                        feedback: 'Not quite. This person appears engaged and comfortable in the discussion.',
                        isCorrect: false,
                        points: 0
                      }
                    ],
                    allowMultipleClicks: true
                  }
                },
                {
                  id: 'empathy-quiz-1',
                  type: 'embedded-quiz',
                  title: 'Empathy Knowledge Check',
                  order: 4,
                  data: {
                    id: 'empathy-knowledge-check',
                    title: 'Quick Knowledge Check',
                    instructions: 'Test your understanding of empathy in leadership.',
                    questions: [
                      {
                        id: 'eq-1',
                        text: 'What is the difference between sympathy and empathy?',
                        type: 'multiple-choice',
                        options: [
                          'There is no difference',
                          'Sympathy is feeling sorry for someone, empathy is understanding their perspective',
                          'Empathy is feeling sorry for someone, sympathy is understanding their perspective',
                          'Both involve giving advice to help solve problems'
                        ],
                        correctAnswer: 1,
                        explanation: 'Empathy involves understanding and sharing someone\'s feelings, while sympathy is feeling sorry for their situation.',
                        points: 5
                      },
                      {
                        id: 'eq-2',
                        text: 'True or False: Empathy means you have to agree with everyone\'s perspective.',
                        type: 'true-false',
                        options: ['True', 'False'],
                        correctAnswer: 1,
                        explanation: 'Empathy is about understanding perspectives, not necessarily agreeing with them. You can empathize while maintaining your own viewpoint.',
                        points: 5
                      }
                    ],
                    passingScore: 70,
                    showResultsImmediately: true
                  }
                }
              ],
              currentScenarioId: 'scenario-1-start',
              userChoices: {},
              completedElements: []
            },
            completed: false,
            order: 2
          },
          {
            id: 'lesson-1-3',
            title: 'Empathy in Leadership Quiz',
            type: 'quiz',
            duration: '10 min',
            content: {
              questions: [
                {
                  id: 'q1',
                  text: 'What is the first step in demonstrating empathy?',
                  options: [
                    'Offering immediate solutions',
                    'Active listening without judgment',
                    'Sharing your own similar experience',
                    'Giving advice based on your expertise'
                  ],
                  correctAnswerIndex: 1,
                  explanation: 'Active listening creates the foundation for understanding others\' perspectives.'
                }
              ],
              passingScore: 80,
              allowRetakes: true,
              showCorrectAnswers: true
            },
            completed: false,
            order: 3
          }
        ],
        resources: [
          {
            id: 'resource-1-1',
            title: 'Empathy Assessment Tool',
            type: 'pdf',
            size: '1.5 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/empathy-assessment.pdf',
            downloadable: true
          }
        ]
      }
    ]
  }
});

// Initialize courses from localStorage or defaults
let courses: { [key: string]: Course } = _loadCoursesFromLocalStorage();

export type AdminLoadStatus = 'skipped' | 'success' | 'empty' | 'error' | 'unauthorized' | 'api_unreachable';
type AdminCatalogPhase = 'idle' | 'loading' | 'ready';

export interface AdminCatalogState {
  phase: AdminCatalogPhase;
  adminLoadStatus: AdminLoadStatus;
  lastUpdatedAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
}

let adminCatalogState: AdminCatalogState = {
  phase: 'idle',
  adminLoadStatus: 'skipped',
  lastUpdatedAt: null,
  lastAttemptAt: null,
  lastError: null,
};

type LearnerCatalogStatus = 'idle' | 'ok' | 'empty' | 'error';
interface LearnerCatalogState {
  status: LearnerCatalogStatus;
  lastUpdatedAt: number | null;
  lastError: string | null;
  detail: string | null;
}

let learnerCatalogState: LearnerCatalogState = {
  status: 'idle',
  lastUpdatedAt: null,
  lastError: null,
  detail: null,
};

let initPromise: Promise<void> | null = null;

const storeSubscribers = new Set<() => void>();

const shallowEqualState = (current: AdminCatalogState, next: AdminCatalogState): boolean => {
  if (current === next) {
    return true;
  }
  const keys = new Set<keyof AdminCatalogState>(['phase', 'adminLoadStatus', 'lastUpdatedAt', 'lastAttemptAt', 'lastError']);
  for (const key of keys) {
    if (current[key] !== next[key]) {
      return false;
    }
  }
  return true;
};

const notifySubscribers = () => {
  storeSubscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[courseStore] subscriber error', error);
    }
  });
};

const setAdminCatalogState = (update: Partial<AdminCatalogState> | ((state: AdminCatalogState) => AdminCatalogState)) => {
  const nextState = typeof update === 'function' ? update(adminCatalogState) : { ...adminCatalogState, ...update };
  if (shallowEqualState(adminCatalogState, nextState)) {
    return;
  }
  adminCatalogState = nextState;
  notifySubscribers();
};

const setLearnerCatalogState = (update: Partial<LearnerCatalogState>) => {
  const nextState = { ...learnerCatalogState, ...update };
  const changed =
    nextState.status !== learnerCatalogState.status ||
    nextState.lastUpdatedAt !== learnerCatalogState.lastUpdatedAt ||
    nextState.lastError !== learnerCatalogState.lastError ||
    nextState.detail !== learnerCatalogState.detail;
  if (!changed) return;
  learnerCatalogState = nextState;
  notifySubscribers();
};

const resolveOrgContext = (): { orgId: string | null; role: string | null; userId: string | null } => {
  if (typeof window === 'undefined') {
    return { orgId: null, role: null, userId: null };
  }
  try {
    const session = getUserSession();
    if (session) {
      const activeMembership = session.memberships?.find((membership) => membership?.status === 'active');
      const membershipOrgId =
        resolveOrgIdFromCarrier(
          session.activeOrgId,
          (session as Record<string, any>).organization_id,
          session.organizationId,
          activeMembership ?? null,
          ...(session.memberships || [])
        ) || null;
      const storedPreference = getActiveOrgPreference();
      return {
        orgId: resolveOrgIdFromCarrier(storedPreference) ?? membershipOrgId,
        role: session.role ?? null,
        userId: session.id ?? null,
      };
    }
  } catch (error) {
    console.warn('[courseStore] Failed to read secure session for org context:', error);
  }

  const storedPreference = getActiveOrgPreference();
  const normalizedPreference = resolveOrgIdFromCarrier(storedPreference);
  if (normalizedPreference) {
    return { orgId: normalizedPreference, role: null, userId: null };
  }

  return { orgId: null, role: null, userId: null };
};

const isAdminSurface = (): boolean => {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return false;
  }

  try {
    const pathname = window.location.pathname ? window.location.pathname.toLowerCase() : '';
    return pathname.startsWith('/admin');
  } catch (error) {
    console.warn('[courseStore] Failed to inspect route for admin surface detection:', error);
    return false;
  }
};

const hasLocalProgressForCourse = (course: Course): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const slugSource = course.slug || course.title || course.id;
  if (!slugSource) {
    return false;
  }

  try {
    const slug = slugify(slugSource);
    const storedProgress = loadStoredCourseProgress(slug);
    return hasStoredProgressHistory(storedProgress);
  } catch (error) {
    console.warn('[courseStore] Unable to inspect local progress for course', course.id, error);
    return false;
  }
};

const CATALOG_CACHE_STORAGE_KEY = 'huddle_assignment_catalog_v2';
const CATALOG_CACHE_MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

type CatalogCacheEntry = {
  timestamp: number;
  courses: { [key: string]: Course };
};

const buildCatalogCacheKey = (userId: string | null, orgId: string | null) => {
  if (!userId) return null;
  return `${userId}:${orgId ?? 'none'}`;
};

const readCatalogCache = (): Record<string, CatalogCacheEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CATALOG_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('[courseStore] Failed to read catalog cache:', error);
    return {};
  }
};

const writeCatalogCache = (payload: Record<string, CatalogCacheEntry>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CATALOG_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[courseStore] Failed to persist catalog cache:', error);
  }
};

const loadCachedCatalog = (cacheKey: string | null): { [key: string]: Course } | null => {
  if (!cacheKey) return null;
  const cache = readCatalogCache();
  const entry: CatalogCacheEntry | undefined = cache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CATALOG_CACHE_MAX_AGE_MS) {
    return null;
  }
  return entry.courses || null;
};

const saveCachedCatalog = (cacheKey: string | null, catalog: { [key: string]: Course }) => {
  if (!cacheKey || typeof window === 'undefined') return;
  try {
    const serializedCatalog = JSON.parse(JSON.stringify(catalog));
    const cache = readCatalogCache();
    cache[cacheKey] = {
      timestamp: Date.now(),
      courses: serializedCatalog,
    };
    writeCatalogCache(cache);
  } catch (error) {
    console.warn('[courseStore] Failed to serialize catalog cache:', error);
  }
};

const ensureAssignmentScopedCatalog = async (
  currentCourses: { [key: string]: Course },
  userId: string | null,
  orgId: string | null,
): Promise<{ [key: string]: Course }> => {
  if (!userId) {
    setLearnerCatalogState({
      status: 'idle',
      lastUpdatedAt: Date.now(),
      lastError: null,
      detail: null,
    });
    return currentCourses;
  }

  const cacheKey = buildCatalogCacheKey(userId, orgId);

  const hasAnyCourses = (catalog: { [key: string]: Course } | null | undefined) =>
    Boolean(catalog && Object.keys(catalog).length > 0);

  try {
    const assignments = await getAssignmentsForUser(userId);
    if (!assignments || assignments.length === 0) {
      emitCatalogDiagnostic('assignment_scope_empty', { userId });
      const cached = cacheKey ? loadCachedCatalog(cacheKey) : null;

      const fallback = (() => {
        if (DEFAULT_CATALOG_ALLOWED) {
          const defaults = getDefaultCourses();
          if (hasAnyCourses(defaults)) {
            return { source: 'default' as const, catalog: defaults };
          }
        }

        if (hasAnyCourses(currentCourses)) {
          return { source: 'published' as const, catalog: currentCourses };
        }

        if (hasAnyCourses(cached)) {
          return { source: 'cached' as const, catalog: cached as { [key: string]: Course } };
        }

        return { source: 'empty' as const, catalog: {} as { [key: string]: Course } };
      })();

      if (fallback.source !== 'empty' && cacheKey) {
        saveCachedCatalog(cacheKey, fallback.catalog);
      }

      console.info(
        `[courseStore] No assignments (200 empty) — using fallback catalog: ${fallback.source}`,
      );

      setLearnerCatalogState({
        status: fallback.source === 'empty' ? 'empty' : 'ok',
        lastUpdatedAt: Date.now(),
        lastError: null,
        detail:
          fallback.source === 'empty'
            ? 'no_assignments'
            : (`fallback_${fallback.source}` as 'fallback_default' | 'fallback_published' | 'fallback_cached'),
      });

      return fallback.catalog;
    }

    const courseMap: { [key: string]: Course } = { ...currentCourses };
    const assignmentByCourseId = new Map<string, CourseAssignment>();
    const missingCourseIds: string[] = [];

    assignments.forEach((assignment) => {
      assignmentByCourseId.set(assignment.courseId, assignment);
      if (!courseMap[assignment.courseId]) {
        missingCourseIds.push(assignment.courseId);
      }
    });

    for (const courseId of missingCourseIds) {
      try {
        const fetched = await fetchCourse(courseId, { includeDrafts: true });
        if (fetched) {
          courseMap[fetched.id] = fetched as Course;
        }
      } catch (error) {
        console.warn(`[courseStore] Failed to hydrate course ${courseId} for assignment filter`, error);
      }
    }

    const filteredEntries = Object.entries(courseMap).filter(([id]) => assignmentByCourseId.has(id));
    if (filteredEntries.length === 0) {
      const cached = loadCachedCatalog(cacheKey);
      if (cached) {
        console.info('[courseStore] Using cached catalog for empty assignment filter.');
        setLearnerCatalogState({
          status: 'empty',
          lastUpdatedAt: Date.now(),
          lastError: null,
          detail: 'cached',
        });
        return cached;
      }
      setLearnerCatalogState({
        status: 'empty',
        lastUpdatedAt: Date.now(),
        lastError: null,
        detail: 'filtered_empty',
      });
      return currentCourses;
    }

    const filtered: { [key: string]: Course } = {};
    filteredEntries.forEach(([id, course]) => {
      const assignment = assignmentByCourseId.get(id);
      if (!assignment) return;
      filtered[id] = {
        ...course,
        assignmentStatus: assignment.status,
        assignmentDueDate: assignment.dueDate ?? null,
        assignmentProgress: assignment.progress ?? 0,
      };
    });

    console.log('[courseStore] Assignment filter reduced catalog to', filteredEntries.length, 'course(s).');
    saveCachedCatalog(cacheKey, filtered);
    setLearnerCatalogState({
      status: 'ok',
      lastUpdatedAt: Date.now(),
      lastError: null,
      detail: null,
    });
    return filtered;
  } catch (error) {
    console.warn('[courseStore] Unable to scope catalog by assignments:', error);
    emitCatalogDiagnostic('assignment_scope_failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    const cached = loadCachedCatalog(cacheKey);
    if (cached) {
      console.info('[courseStore] Using cached catalog after assignment scope failure.');
      setLearnerCatalogState({
        status: 'error',
        lastUpdatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : String(error),
        detail: 'cached',
      });
      return cached;
    }
    setLearnerCatalogState({
      status: 'error',
      lastUpdatedAt: Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
      detail: null,
    });
    return {};
  }
};

const DEFAULT_CATALOG_ALLOWED =
  typeof import.meta.env?.VITE_ALLOW_DEFAULT_COURSES !== 'undefined'
    ? import.meta.env?.VITE_ALLOW_DEFAULT_COURSES === 'true'
    : import.meta.env?.MODE !== 'production';

type CatalogDiagnosticEvent =
  | 'default_catalog_loaded'
  | 'assignment_scope_empty'
  | 'assignment_scope_failed';

const emitCatalogDiagnostic = (event: CatalogDiagnosticEvent, detail: Record<string, unknown> = {}) => {
  const payload = {
    ...detail,
    event,
    timestamp: new Date().toISOString(),
  };
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('huddle:catalog-warning', { detail: payload }));
    } catch (error) {
      console.warn('[courseStore] catalog warning dispatch failed', error);
    }
  }
  const logMethod = event === 'assignment_scope_failed' ? console.error : console.warn;
  logMethod('[courseStore] catalog_diagnostic', payload);
};

// Store management functions
export const courseStore = {
  init: (): Promise<void> => {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
    let supabaseOperational = false;
    let restrictToOrg = true;
    let canUseAdminApi = false;
    let adminLoadStatus: AdminLoadStatus = 'skipped';
    let adminLoadError: string | null = null;
    const attemptStartedAt = Date.now();
    setAdminCatalogState({
      phase: 'loading',
      adminLoadStatus: 'skipped',
      lastError: null,
      lastAttemptAt: attemptStartedAt,
    });
    try {
      console.log('[courseStore.init] Starting initialization...');
      const orgContext = resolveOrgContext();
      if (!orgContext.userId) {
        console.info('[courseStore.init] No authenticated session detected; loading local defaults without hitting API.');
        courses = getDefaultCourses();
        return;
      }
      const adminSurfaceDetected = isAdminSurface();
      const treatAsAdmin = adminSurfaceDetected;
      restrictToOrg = !adminSurfaceDetected;
      const adminMode = !restrictToOrg;
      let runtimeStatus = getRuntimeStatus();
      try {
        runtimeStatus = await refreshRuntimeStatus();
      } catch (statusError) {
        console.warn('[courseStore.init] Runtime status refresh failed; using last known snapshot.', statusError);
      }
      supabaseOperational = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
      const apiReachable = runtimeStatus.apiReachable ?? runtimeStatus.apiHealthy;
      const apiAuthRequired = runtimeStatus.apiAuthRequired;
  canUseAdminApi = adminMode && apiReachable;
      console.log('[courseStore.init] Runtime status snapshot:', runtimeStatus);
      // Prefer admin list (richer shape) but gracefully fall back to published-only
      let dbCourses: Course[] = [];
      if (canUseAdminApi) {
        if (apiAuthRequired) {
          console.info('[courseStore.init] Health probe indicated auth required, but API is reachable. Proceeding with admin course load attempt.');
        }
        try {
          dbCourses = await getAllCoursesFromDatabase();
          console.log('[courseStore.init] Admin API returned courses:', dbCourses);
          adminLoadStatus = dbCourses.length === 0 ? 'empty' : 'success';
          if (adminLoadStatus === 'empty') {
            console.info('[courseStore.init] admin_courses_empty (0 results from /api/admin/courses).');
          }
        } catch (adminError) {
          const status = adminError instanceof ApiError ? adminError.status : undefined;
          if (status === 401 || status === 403) {
            adminLoadStatus = 'unauthorized';
            adminLoadError = 'unauthorized';
            console.warn('[courseStore.init] admin_courses_error (unauthorized)', { status });
          } else {
            adminLoadStatus = 'error';
            adminLoadError = adminError instanceof Error ? adminError.message : 'admin_courses_error';
            console.warn('[courseStore.init] admin_courses_error', {
              status,
              message: adminError instanceof Error ? adminError.message : String(adminError),
            });
          }
          dbCourses = [];
        }
      } else if (adminMode && !apiReachable) {
        adminLoadStatus = 'api_unreachable';
        adminLoadError = runtimeStatus.lastError || 'api_unreachable';
        console.warn('[courseStore.init] admin_courses_api_unreachable', {
          reason: runtimeStatus.lastError || 'unknown',
        });
      } else if (!adminMode) {
        console.warn('[courseStore.init] Skipping admin course load for non-admin role.');
      }

      const shouldLoadPublishedCatalog =
        restrictToOrg || (!restrictToOrg && (adminLoadStatus === 'error' || adminLoadStatus === 'api_unreachable'));

      if ((!dbCourses || dbCourses.length === 0) && shouldLoadPublishedCatalog) {
        console.log('[courseStore.init] Loading published catalog as fallback...');
        try {
          if (restrictToOrg) {
            if (orgContext.orgId) {
              dbCourses = await fetchPublishedCourses({ orgId: orgContext.orgId, assignedOnly: true });
            } else {
              console.warn('[courseStore.init] Missing organizationId; loading full published catalog for learner context.');
              dbCourses = await fetchPublishedCourses();
            }
          } else {
            dbCourses = await fetchPublishedCourses();
          }
          console.log('[courseStore.init] Published catalog returned courses:', dbCourses);
        } catch (fallbackErr) {
          console.warn('[courseStore.init] Published catalog fallback failed:', fallbackErr);
          dbCourses = [];
        }
      }

      const adminEmptySuccess = !restrictToOrg && adminLoadStatus === 'empty';
      const adminUnauthorized = !restrictToOrg && adminLoadStatus === 'unauthorized';

      if (dbCourses.length > 0) {
        // Merge fetched courses with any existing locally persisted drafts instead of overwriting entirely.
        const merged: { [key: string]: Course } = { ...courses };
        dbCourses.forEach((course: Course) => {
          const existing = merged[course.id];
          merged[course.id] = existing ? { ...existing, ...course } : course;
        });
        courses = merged;
        console.log(`[courseStore.init] Loaded ${dbCourses.length} courses from API (merged with ${Object.keys(merged).length - dbCourses.length} existing drafts)`);
      } else if (adminEmptySuccess) {
        courses = {};
        console.info('[courseStore.init] Admin catalog is empty; awaiting first course creation.');
      } else if (adminUnauthorized) {
        courses = {};
        console.warn('[courseStore.init] Admin course load unauthorized; leaving local catalog empty.');
      } else {
        if (DEFAULT_CATALOG_ALLOWED) {
          console.log('[courseStore.init] No courses returned; loading local default catalog for demo use.');
          courses = getDefaultCourses();
          emitCatalogDiagnostic('default_catalog_loaded', {
            reason: 'admin_catalog_unavailable',
            scope: restrictToOrg ? 'learner' : 'admin',
          });
          if (restrictToOrg) {
            setLearnerCatalogState({
              status: 'ok',
              lastUpdatedAt: Date.now(),
              lastError: null,
              detail: 'default_catalog',
            });
          }
        } else {
          courses = {};
          emitCatalogDiagnostic('default_catalog_loaded', {
            reason: 'admin_catalog_unavailable',
            scope: restrictToOrg ? 'learner' : 'admin',
            disabled: true,
          });
          console.warn('[courseStore.init] No courses returned and default catalog disabled.');
          if (restrictToOrg) {
            setLearnerCatalogState({
              status: 'empty',
              lastUpdatedAt: Date.now(),
              lastError: null,
              detail: 'default_disabled',
            });
          }
        }
      }

      if (restrictToOrg) {
        courses = await ensureAssignmentScopedCatalog(courses, orgContext.userId, orgContext.orgId);
      }
    } catch (error) {
      console.error('Error initializing course store:', error);
      adminLoadStatus = 'error';
      adminLoadError = error instanceof Error ? error.message : 'course_store_init_failed';
      if (DEFAULT_CATALOG_ALLOWED) {
        courses = getDefaultCourses();
        emitCatalogDiagnostic('default_catalog_loaded', {
          reason: 'init_failure',
          error: adminLoadError,
        });
        if (restrictToOrg) {
          setLearnerCatalogState({
            status: 'ok',
            lastUpdatedAt: Date.now(),
            lastError: null,
            detail: 'default_catalog',
          });
        }
      } else {
        courses = {};
        emitCatalogDiagnostic('default_catalog_loaded', {
          reason: 'init_failure',
          error: adminLoadError,
          disabled: true,
        });
        if (restrictToOrg) {
          setLearnerCatalogState({
            status: 'error',
            lastUpdatedAt: Date.now(),
            lastError: adminLoadError,
            detail: 'default_disabled',
          });
        }
      }
    } finally {
      setAdminCatalogState({
        phase: 'ready',
        adminLoadStatus,
        lastUpdatedAt: Date.now(),
        lastError: adminLoadError,
      });
    }
    })();

    initPromise.finally(() => {
      initPromise = null;
    });

    return initPromise;
  },

  getCourse: (id: string): Course | null => {
    return courses[id] || null;
  },

  resolveCourse: (identifier: string): Course | null => {
    if (!identifier) {
      return null;
    }

    const directMatch = courses[identifier];
    if (directMatch) {
      return directMatch;
    }

    const normalizedIdentifier = slugify(identifier);
    return Object.values(courses).find((entry) => {
      if (!entry) return false;

      if (entry.slug && slugify(entry.slug) === normalizedIdentifier) {
        return true;
      }

      if (entry.id && slugify(entry.id) === normalizedIdentifier) {
        return true;
      }

      if (entry.title && slugify(entry.title) === normalizedIdentifier) {
        return true;
      }

      return false;
    }) || null;
  },

  saveCourse: (course: Course, options: { skipRemoteSync?: boolean } = {}): void => {
    const normalizedModules = sanitizeModuleGraph(course.modules || []);
    const nextCourse: Course = {
      ...course,
      modules: normalizedModules,
      lastUpdated: new Date().toISOString(),
    };
    course.modules = normalizedModules;
    course.lastUpdated = nextCourse.lastUpdated;
    courses[nextCourse.id] = { ...nextCourse };
    _saveCoursesToLocalStorage(courses);
    void saveDraftSnapshot(nextCourse, {
      dirty: true,
      cause: options.skipRemoteSync ? 'local-save' : 'store-save',
    });
    
    // Only sync to Supabase if configured
    if (
      !options.skipRemoteSync &&
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      const apiPayload = createCoursePayloadForApi(nextCourse);
      syncCourseToDatabase(apiPayload)
        .then((persisted) => {
          if (!persisted) return;
    const normalized = normalizeCourse(persisted as Course);
          const targetId = normalized.id || nextCourse.id;
          const normalizedModules = normalized.modules && normalized.modules.length
            ? sanitizeModuleGraph(normalized.modules as Module[])
            : courses[nextCourse.id]?.modules ?? nextCourse.modules;
          courses[targetId] = {
            ...(courses[nextCourse.id] || nextCourse),
            ...normalized,
            modules: normalizedModules,
          };
          if (targetId !== nextCourse.id) {
            delete courses[nextCourse.id];
          }
          _saveCoursesToLocalStorage(courses);
          void markDraftSynced(targetId, courses[targetId]);
        })
        .catch(error => {
          if (error instanceof CourseValidationError) {
            console.warn(
              `Skipped remote sync for course "${course.title}" due to validation errors: ${error.issues.join(' | ')}`,
            );
            return;
          }
          console.warn(`Failed to sync course "${nextCourse.title}" to database:`, error.message || error);
        });
    }
  },

  getAllCourses: (): Course[] => {
    return Object.values(courses);
  },

  deleteCourse: (id: string, options: { skipRemote?: boolean } = {}): boolean => {
    if (courses[id]) {
      delete courses[id];
      _saveCoursesToLocalStorage(courses);
      void deleteDraftSnapshot(id);
      if (
        !options.skipRemote &&
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_ANON_KEY
      ) {
  deleteCourseFromDatabase(id).catch((error) => {
          console.warn(`Failed to delete course "${id}" from database:`, error.message || error);
        });
      }
      return true;
    }
    return false;
  },

  createCourse: (courseData: Partial<Course>): Course => {
    const generatedId =
      courseData.id ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `course-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`);
    const slug = slugify(courseData.slug || courseData.title || generatedId);
    const now = new Date().toISOString();
    const newCourse: Course = {
      id: generatedId,
      slug,
      title: courseData.title || 'New Course',
      description: courseData.description || '',
      status: 'draft',
      thumbnail: courseData.thumbnail || 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      category: courseData.category || 'General',
      difficulty: 'Beginner',
      instructorId: courseData.instructorId || 'instructor-1',
      instructorName: courseData.instructorName || 'Mya Dennis',
      instructorAvatar: courseData.instructorAvatar || '',
      estimatedDuration: courseData.estimatedDuration || 0,
      duration: '0 min',
      learningObjectives: [],
      prerequisites: [],
      tags: [],
      language: 'en',
      createdAt: now,
      updatedAt: now,
      enrollmentCount: 0,
      enrollments: 0,
      rating: 0,
      avgRating: 0,
      reviewCount: 0,
      totalRatings: 0,
      completions: 0,
      completionRate: 0,
      chapters: [],
      modules: [],
      ...courseData
    };

    const initialOrgId = resolveOrgIdFromCarrier(courseData);
    if (initialOrgId) {
      newCourse.organizationId = initialOrgId;
      stampCanonicalOrgId(newCourse as Record<string, any>, initialOrgId);
    }
    
    newCourse.modules = sanitizeModuleGraph(newCourse.modules || []);
    courses[newCourse.id] = newCourse;
    _saveCoursesToLocalStorage(courses);
    void saveDraftSnapshot(newCourse, { dirty: true, cause: 'create-course' });

    // Always attempt to persist to backend API (DEV_FALLBACK or Supabase-backed) so courses survive reloads
    const apiPayload = createCoursePayloadForApi(newCourse);
  syncCourseToDatabase(apiPayload)
      .then((persisted) => {
        if (!persisted) return;
  const normalized = normalizeCourse(persisted as Course);
        const normalizedId = normalized.id || newCourse.id;
        const normalizedModules = normalized.modules && normalized.modules.length
          ? sanitizeModuleGraph(normalized.modules as Module[])
          : courses[newCourse.id]?.modules ?? newCourse.modules;
        courses[normalizedId] = {
          ...courses[newCourse.id],
          ...normalized,
          modules: normalizedModules,
        };
        if (normalizedId !== newCourse.id) {
          delete courses[newCourse.id];
        }
        _saveCoursesToLocalStorage(courses);
        void markDraftSynced(normalizedId, courses[normalizedId]);
      })
      .catch((error) => {
        if (error instanceof CourseValidationError) {
          console.warn(
            `New course "${newCourse.title}" failed validation when syncing: ${error.issues.join(' | ')}`,
          );
          return;
        }
        console.warn(`Failed to persist course "${newCourse.title}" to database:`, error.message || error);
      });

    return newCourse;
  },

  updateCourseStats: (id: string, stats: Partial<Pick<Course, 'enrollments' | 'completions' | 'completionRate' | 'avgRating' | 'totalRatings'>>): void => {
    if (courses[id]) {
      Object.assign(courses[id], stats);
      _saveCoursesToLocalStorage(courses);
    }
  },

  getAdminCatalogState: (): AdminCatalogState => adminCatalogState,
  getLearnerCatalogState: (): LearnerCatalogState => learnerCatalogState,

  subscribe: (listener: () => void): (() => void) => {
    storeSubscribers.add(listener);
    return () => {
      storeSubscribers.delete(listener);
    };
  },
};

// Helper function to generate unique IDs
export const generateId = (prefix: string = 'item'): string => {
  if (prefix === 'module') {
    return createModuleId();
  }
  if (prefix === 'lesson') {
    return createLessonId();
  }
  return `${prefix}-${nanoid(8)}`;
};

// Helper function to calculate total course duration
export const calculateCourseDuration = (modules: Module[]): string => {
  const totalMinutes = modules.reduce((acc, module) => {
    const moduleDuration = module.lessons.reduce((lessonAcc, lesson) => {
      const minutes = parseInt(lesson.duration?.split(' ')[0] || '0') || 0;
      return lessonAcc + minutes;
    }, 0);
    return acc + moduleDuration;
  }, 0);
  
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};

// Helper function to count total lessons
export const countTotalLessons = (modules: Module[]): number => {
  return modules.reduce((acc, module) => acc + module.lessons.length, 0);
}
