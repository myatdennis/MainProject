import {
  CourseValidationError,
  deleteCourseFromDatabase,
  getAllCoursesFromDatabase,
  syncCourseToDatabase,
} from '../dal/adminCourses';
import { fetchPublishedCourses, fetchCourse } from '../dal/clientCourses';
import { Course, Module } from '../types/courseTypes';
import { slugify, normalizeCourse } from '../utils/courseNormalization';
import { getActiveOrgPreference } from '../lib/secureStorage';
import { getAssignmentsForUser } from '../utils/assignmentStorage';
import type { CourseAssignment } from '../types/assignment';
import { refreshRuntimeStatus, getRuntimeStatus } from '../state/runtimeStatus';
import { loadStoredCourseProgress } from '../utils/courseProgress';
import { hasStoredProgressHistory } from '../utils/courseAvailability';
import { saveDraftSnapshot, markDraftSynced, deleteDraftSnapshot } from '../dal/courseDrafts';
import { ApiError } from '../utils/apiClient';
import { cloneWithCanonicalOrgId, resolveOrgIdFromCarrier, stampCanonicalOrgId } from '../utils/orgFieldUtils';
import { nanoid } from 'nanoid';
import { canonicalizeLessonContent } from '../utils/lessonContent';
import { SlugConflictError } from '../utils/slugConflict';
import isUuid from '../utils/isUuid';
import { isAdminSurface } from '../utils/surface';
import { resolveOrgContextFromBridge, isOrgResolverRegistered } from './courseStoreOrgBridge';
import {
  evictStaleCatalogKeys,
  buildCatalogCacheKey,
  loadCachedCatalog,
  saveCachedCatalog,
  clearCatalogCacheEntry,
  clearAllCatalogCache,
  clearCatalogCacheForOrg,
  isTestOrE2ECourse,
} from '../utils/catalogPersistence';

// Run stale key eviction immediately at module load — before any cache reads.
evictStaleCatalogKeys();

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

const randomUuid = (): string => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return nanoid(32);
};

export const createModuleId = (): string => randomUuid();
export const createLessonId = (): string => randomUuid();

const normalizeIdentifier = (
  value: string | null | undefined,
  generator: () => string,
  existingClientTemp?: string | null,
  options: { forceNewId?: boolean } = {},
) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!options.forceNewId && trimmed && isUuid(trimmed)) {
    return { id: trimmed, clientTempId: existingClientTemp ?? null, replaced: false, original: trimmed };
  }
  const generated = generator();
  return {
    id: generated,
    clientTempId: existingClientTemp ?? (trimmed || null),
    replaced: true,
    original: trimmed || null,
  };
};

export const sanitizeModuleGraph = (modules: Module[] = [], options: { forceNewIds?: boolean } = {}): Module[] => {
  const moduleIdMap = new Map<string, string>();

  return modules.map((module, moduleIndex) => {
    const { id: moduleId, clientTempId, original, replaced } = normalizeIdentifier(
      module.id,
      createModuleId,
      (module as any)?.client_temp_id ?? null,
      { forceNewId: options.forceNewIds },
    );
    if (replaced && original) {
      moduleIdMap.set(original, moduleId);
    }
    moduleIdMap.set(moduleId, moduleId);

    const normalizedLessons = (module.lessons || []).map((lesson, lessonIndex) => {
      const {
        id: lessonId,
        clientTempId: lessonTempId,
        original: lessonOriginalId,
        replaced: lessonReplaced,
      } = normalizeIdentifier(lesson.id, createLessonId, (lesson as any)?.client_temp_id ?? null, {
        forceNewId: options.forceNewIds,
      });
      if (lessonReplaced && lessonOriginalId) {
        moduleIdMap.set(lessonOriginalId, lessonId);
      }
      const requestedModuleRef =
        typeof lesson.module_id === 'string'
          ? lesson.module_id.trim()
          : typeof (lesson as any).moduleId === 'string'
          ? (lesson as any).moduleId.trim()
          : '';
      const resolvedModuleId =
        moduleIdMap.get(requestedModuleRef) ?? moduleIdMap.get(moduleId) ?? moduleId;

      return {
        ...lesson,
        id: lessonId,
        client_temp_id: lessonTempId ?? null,
        module_id: resolvedModuleId,
        moduleId: resolvedModuleId,
        order: lesson.order ?? lessonIndex + 1,
        content: canonicalizeLessonContent(lesson.content),
      };
    });

    return {
      ...module,
      id: moduleId,
      client_temp_id: clientTempId ?? null,
      order: module.order ?? moduleIndex + 1,
      lessons: normalizedLessons,
    };
  });
};

const hasLoadedStructure = (candidate?: Course | null): boolean => {
  if (!candidate?.modules || candidate.modules.length === 0) return false;
  return candidate.modules.some((module) => Array.isArray(module.lessons) && module.lessons.length > 0);
};

// @ts-expect-error retained for future diagnostics (unused in production logging)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deriveModuleCount = (candidate?: Course | null): number | null => {
  if (!candidate) return null;
  if (typeof candidate.moduleCount === 'number') return candidate.moduleCount;
  if (Array.isArray(candidate.modules)) return candidate.modules.length;
  return null;
};

// @ts-expect-error retained for future diagnostics (unused in production logging)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deriveLessonCount = (candidate?: Course | null): number | null => {
  if (!candidate) return null;
  if (typeof candidate.lessonCount === 'number') return candidate.lessonCount;
  if (!candidate.modules) return null;
  return candidate.modules.reduce((total, module) => total + ((module.lessons || []).length), 0);
};

const createCoursePayloadForApi = (course: Course): Course => {
  const { clone } = cloneWithCanonicalOrgId(course, { removeAliases: true });
  const sanitizedModules = sanitizeModuleGraph((clone as Course).modules || []);
  (clone as Course).modules = sanitizedModules;
  const resolvedVersion =
    typeof course.version === 'number' && Number.isFinite(course.version)
      ? course.version
      : typeof (clone as Course).version === 'number' && Number.isFinite((clone as Course).version)
      ? (clone as Course).version
      : 1;
  (clone as Course).version = resolvedVersion;
  return clone as Course;
};

// Default course data
const getDefaultCourses = (): { [key: string]: Course } => {
  const defaults: { [key: string]: Course } = {
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
  };

  Object.values(defaults).forEach((course) => {
    if (typeof course.version !== 'number' || Number.isNaN(course.version)) {
      course.version = 1;
    }
  });

  return defaults;
};

// Initialize courses from localStorage or defaults
let courses: { [key: string]: Course } = _loadCoursesFromLocalStorage();
let editingCourseId: string | null = null;

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
// Track the org context that was used for the last successful init so we can
// detect org switches and flush the stale localStorage catalog cache.
let lastInitOrgId: string | null = null;

/**
 * Maximum ms to wait for the org resolver bridge to return a snapshot before
 * treating the situation as a hard error. Prevents course loads from stalling
 * indefinitely when the auth provider unmounts or fails to re-register.
 */
export const BRIDGE_RESOLUTION_TIMEOUT_MS = 8_000;
/** Timestamp (Date.now()) when the bridge first entered 'loading' state. */
let bridgeLoadingStartedAt: number | null = null;

/**
 * BroadcastChannel used to coordinate org-switch cache invalidation across
 * browser tabs. When one tab switches org (via forceInit with a newOrgId),
 * it broadcasts the new org so other tabs can reset their initPromise and
 * re-initialize with the correct org context on their next catalog access.
 * Intentionally not assigned — the channel is kept alive by the IIFE closure.
 */
void ((): void => {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel('huddle:catalog-sync');
    ch.addEventListener('message', (evt) => {
      if (evt.data?.type === 'org_switch') {
        // Another tab switched org — invalidate this tab's in-flight promise so
        // the next init() call re-fetches under the new org context.
        initPromise = null;
        lastInitOrgId = evt.data.newOrgId ?? null;
      }
    });
  } catch {
    // BroadcastChannel not supported in this environment — silently skip.
  }
})();

const storeSubscribers = new Set<() => void>();

/** Returns a strictly-increasing timestamp so that consecutive setAdminCatalogState
 *  calls in the same millisecond never produce an identical lastUpdatedAt and are
 *  therefore never suppressed by shallowEqualState. */
let _lastMonotonicTs = 0;
const monotonicNow = (): number => {
  const now = Date.now();
  _lastMonotonicTs = now > _lastMonotonicTs ? now : _lastMonotonicTs + 1;
  return _lastMonotonicTs;
};

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
  if (import.meta.env.DEV) {
    const courseList = Object.values(courses);
    console.debug('[STORE UPDATE] courseStore notifying', storeSubscribers.size, 'subscribers');
    console.debug('[COURSE COUNT]', courseList.length, 'courses in store');
    console.debug('[SUBSCRIBER NOTIFY]', {
      ts: Date.now(),
      subscribers: storeSubscribers.size,
      courseCount: courseList.length,
      ids: courseList.slice(0, 5).map((c) => c.id),
      phase: adminCatalogState.phase,
      status: adminCatalogState.adminLoadStatus,
    });
  }
  storeSubscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[courseStore] subscriber error', error);
    }
  });
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

const setAdminCatalogState = (update: Partial<AdminCatalogState> | ((state: AdminCatalogState) => AdminCatalogState)) => {
  const nextState = typeof update === 'function' ? update(adminCatalogState) : { ...adminCatalogState, ...update };
  if (shallowEqualState(adminCatalogState, nextState)) {
    return;
  }
  if (import.meta.env.DEV) {
    console.debug('[CATALOG STATE SET]', {
      ts: Date.now(),
      from: { phase: adminCatalogState.phase, status: adminCatalogState.adminLoadStatus },
      to: { phase: nextState.phase, status: nextState.adminLoadStatus },
      lastError: nextState.lastError ?? null,
      courseCount: Object.keys(courses).length,
    });
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

type ResolvedOrgContext = {
  orgId: string | null;
  activeOrgId: string | null;
  role: string | null;
  userId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  membershipStatus: 'idle' | 'loading' | 'ready' | 'degraded' | 'error';
};

const resolveOrgContext = (): ResolvedOrgContext => {
  const storedPreference = resolveOrgIdFromCarrier(getActiveOrgPreference());
  const resolverSnapshot = resolveOrgContextFromBridge();
  if (resolverSnapshot) {
    bridgeLoadingStartedAt = null;
    const membershipStatus = resolverSnapshot.membershipStatus ?? 'idle';
    const status = resolverSnapshot.status ?? 'loading';
    const resolvedOrgId = resolverSnapshot.activeOrgId ?? resolverSnapshot.orgId ?? storedPreference ?? null;
    if (status !== 'ready') {
      return {
        orgId: null,
        activeOrgId: null,
        role: resolverSnapshot.role ?? null,
        userId: resolverSnapshot.userId ?? null,
        status,
        membershipStatus,
      };
    }
    return {
      orgId: resolvedOrgId,
      activeOrgId: resolvedOrgId,
      role: resolverSnapshot.role ?? null,
      userId: resolverSnapshot.userId ?? null,
      status: 'ready',
      membershipStatus,
    };
  }
  if (!isOrgResolverRegistered()) {
    bridgeLoadingStartedAt = null;
    return { orgId: null, activeOrgId: null, role: null, userId: null, status: 'loading', membershipStatus: 'idle' };
  }
  if (bridgeLoadingStartedAt === null) {
    bridgeLoadingStartedAt = Date.now();
  }
  if (Date.now() - bridgeLoadingStartedAt > BRIDGE_RESOLUTION_TIMEOUT_MS) {
    bridgeLoadingStartedAt = null;
    if (import.meta.env?.DEV) {
      console.warn('[courseStore] bridge_timeout: org resolver registered but returned no snapshot after 8s');
    }
    return { orgId: null, activeOrgId: null, role: null, userId: null, status: 'error', membershipStatus: 'error' };
  }
  return { orgId: null, activeOrgId: null, role: null, userId: null, status: 'loading', membershipStatus: 'loading' };
};

const ORG_CONTEXT_WAIT_DELAYS_MS = [100, 200, 400, 800, 1200, 2000, 3000] as const;

const waitForOrgContextResolution = async (
  initial: ResolvedOrgContext,
  reason: string,
): Promise<ResolvedOrgContext> => {
  let context = initial;
  if (context.status !== 'loading') {
    return context;
  }
  let attempt = 0;
  const startedAt = Date.now();
  while (context.status === 'loading') {
    const delayMs = ORG_CONTEXT_WAIT_DELAYS_MS[Math.min(attempt, ORG_CONTEXT_WAIT_DELAYS_MS.length - 1)];
    if (import.meta.env?.DEV) {
      console.debug('[courseStore.init] awaiting_org_context', {
        reason,
        attempt,
        delayMs,
        membershipStatus: context.membershipStatus,
      });
    }
    await sleep(delayMs);
    attempt += 1;
    context = resolveOrgContext();
    if (context.status === 'error') {
      break;
    }
  }
  if (import.meta.env?.DEV) {
    console.debug('[courseStore.init] org_context_resolved', {
      reason,
      status: context.status,
      membershipStatus: context.membershipStatus,
      elapsedMs: Date.now() - startedAt,
    });
  }
  return context;
};

const waitForRoleResolution = async (
  initial: ResolvedOrgContext,
  reason: string,
): Promise<ResolvedOrgContext> => {
  let context = initial;
  if (context.role || context.status === 'error') {
    return context;
  }
  let attempt = 0;
  while (!context.role && context.status !== 'error') {
    await sleep(ORG_CONTEXT_WAIT_DELAYS_MS[Math.min(attempt, ORG_CONTEXT_WAIT_DELAYS_MS.length - 1)]);
    attempt += 1;
    const next = resolveOrgContext();
    context =
      next.status === 'loading'
        ? await waitForOrgContextResolution(next, `${reason}:org_loading`)
        : next;
    if (import.meta.env?.DEV && !context.role && attempt % 4 === 0) {
      console.debug('[courseStore.init] waiting_for_role_context', {
        reason,
        attempt,
        membershipStatus: context.membershipStatus,
      });
    }
  }
  return context;
};

// Reserved for future use: checks whether a learner has any local progress stored for a given course.
// @ts-ignore unused — retained for planned assignment-scope filtering feature
const _hasLocalProgressForCourse = (course: Course): boolean => {
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


// ─── Catalog cache helpers ────────────────────────────────────────────────────
// All cache logic (key versioning, test-data filtering, read/write, eviction)
// is now delegated to catalogPersistence.ts, imported at the top of this file.
// The inline implementations below have been removed.

const ensureAssignmentScopedCatalog = async (
  currentCourses: { [key: string]: Course },
  userId: string | null,
  orgId: string | null,
  { skipDiagnostics }: { skipDiagnostics?: boolean } = {},
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
      if (!skipDiagnostics) {
        emitCatalogDiagnostic('assignment_scope_empty', { userId, orgId, phase: 'post_fetch' });
      }
      clearCatalogCacheEntry(cacheKey);

      let fallback = (() => {
        if (DEFAULT_CATALOG_ALLOWED) {
          const defaults = getDefaultCourses();
          if (hasAnyCourses(defaults)) {
            return { source: 'default' as const, catalog: defaults };
          }
        }

        if (hasAnyCourses(currentCourses)) {
          return { source: 'published' as const, catalog: currentCourses };
        }

        return { source: 'empty' as const, catalog: {} as { [key: string]: Course } };
      })();
      if (orgId && fallback.source === 'default') {
        fallback = { source: 'empty' as const, catalog: {} as { [key: string]: Course } };
      }

      if (fallback.source !== 'empty' && cacheKey) {
        saveCachedCatalog(cacheKey, fallback.catalog);
      }

      console.info(
        `[courseStore] No assignments (200 empty) — using fallback catalog: ${fallback.source}`,
      );

      const detail = (() => {
        if (fallback.source === 'empty') return orgId ? 'no_assignments' : 'no_assignments_global';
        if (fallback.source === 'default') return 'fallback_default' as const;
        if (fallback.source === 'published') return 'fallback_published' as const;
        return 'fallback_default' as const;
      })();

      setLearnerCatalogState({
        status: fallback.source === 'empty' ? 'empty' : 'ok',
        lastUpdatedAt: Date.now(),
        lastError: null,
        detail,
      });

      return fallback.catalog;
    }

    const courseMap: { [key: string]: Course } = { ...currentCourses };
    const assignmentByCourseId = new Map<string, CourseAssignment>();
    const missingCourseIds: string[] = [];

    assignments.forEach((assignment) => {
      const cId = assignment.courseId;
      if (!cId) return;
      assignmentByCourseId.set(cId, assignment);
      if (!courseMap[cId]) {
        missingCourseIds.push(cId);
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
      // Server returned assignments but none of their course IDs are in the local
      // course map.  Do NOT promote the stale localStorage cache as the result —
      // that was the root cause of inconsistent catalogs.  Instead, return empty
      // so the UI shows "no content" and the user can trigger a manual refresh.
      if (import.meta.env.DEV) {
        const cached = loadCachedCatalog(cacheKey);
        if (cached) {
          console.info(
            '[courseStore] cache available but NOT used as primary source (server data takes priority)',
            { cacheEntries: Object.keys(cached).length },
          );
        }
      }
      setLearnerCatalogState({
        status: 'empty',
        lastUpdatedAt: Date.now(),
        lastError: null,
        detail: 'filtered_empty',
      });
      // Assignments exist but none of the assigned course IDs are in the local course map.
      // Return an empty catalog rather than leaking the full admin catalog to the learner.
      return {};
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

    if (import.meta.env.DEV) {
      console.log('[courseStore] Assignment filter reduced catalog to', filteredEntries.length, 'course(s).');
    }
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
    // Cache is only a fallback when the server request itself failed (network error,
    // timeout, etc.).  Mark UI as degraded so the user knows they may be seeing
    // stale data.
    const cached = loadCachedCatalog(cacheKey);
    if (cached) {
      // CACHE USED: this log ONLY fires in degraded mode (server threw).
      // If you see this log and the server is healthy, the catch above fired
      // unexpectedly — check the error above for root cause.
      if (import.meta.env.DEV) {
        console.warn('[CACHE USED] degraded mode — serving cached catalog', {
          cacheKey,
          courseCount: Object.keys(cached).length,
        });
      } else {
        console.info('[courseStore] Using cached catalog after assignment scope failure (degraded mode).');
      }
      setLearnerCatalogState({
        status: 'error',
        lastUpdatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : String(error),
        detail: 'degraded_cached',
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

// Production safety-net: if someone accidentally sets VITE_ALLOW_DEFAULT_COURSES=true
// in a production build, emit a loud console error so it's visible in logs / Sentry.
// Demo courses are meant only for dev/staging environments; exposing them in production
// leaks placeholder content to real paying users.
if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_DEFAULT_COURSES === 'true') {
  console.error(
    '[courseStore] DANGER: VITE_ALLOW_DEFAULT_COURSES=true is set in a production build. ' +
    'Demo/default courses WILL be shown to real users. Remove this flag from your production environment immediately.',
  );
}

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

const FALLBACK_RUNTIME_STATUS = {
  supabaseConfigured: true,
  supabaseHealthy: true,
  apiReachable: true,
  apiHealthy: true,
  apiAuthRequired: false,
  lastError: null as string | null,
};

// Store management functions
export const courseStore = {
  setEditingCourseId: (id: string | null): void => {
    editingCourseId = id ?? null;
  },
  init: (options?: { reason?: string | null }): Promise<void> => {
    const initReason = options?.reason ?? 'auto';
    if (initPromise) {
      // Re-use the in-flight promise — never start a second concurrent init.
      return initPromise;
    }

    // Ready-guard: skip a full re-fetch if the catalog already succeeded,
    // UNLESS the active org has changed since the last successful load.
    if (
      adminCatalogState.phase === 'ready' &&
      adminCatalogState.adminLoadStatus === 'success'
    ) {
      // Check whether the org context has shifted since the last successful init.
      const currentOrgContext = resolveOrgContext();
      const currentOrgId = currentOrgContext.orgId ?? null;
      if (currentOrgId === lastInitOrgId) {
        // Same org — catalog is current, skip.
        return Promise.resolve();
      }
      // Org changed — fall through and do a full re-fetch.
      if (import.meta.env?.DEV) {
        console.info('[courseStore.init] org_change_detected — re-fetching catalog', {
          from: lastInitOrgId,
          to: currentOrgId,
        });
      }
    }

  initPromise = (async () => {
    let restrictToOrg = true;
    let canUseAdminApi = false;
    let adminLoadStatus: AdminLoadStatus = 'skipped';
    let adminLoadError: string | null = null;
    let resolvedOrgIdForInit: string | null = null;
    const attemptStartedAt = monotonicNow();
    if (import.meta.env.DEV) {
      console.debug('[INIT START]', {
        ts: attemptStartedAt,
        pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
        existingCourseCount: Object.keys(courses).length,
        phase: adminCatalogState.phase,
        status: adminCatalogState.adminLoadStatus,
      });
    }
    setAdminCatalogState({
      phase: 'loading',
      adminLoadStatus: 'skipped',
      lastError: null,
      lastAttemptAt: attemptStartedAt,
    });
    try {
      if (import.meta.env?.DEV) {
        console.info('[courseStore.init] Starting initialization...', { reason: initReason });
      }
      let orgContext = resolveOrgContext();
      if (orgContext.status === 'loading') {
        orgContext = await waitForOrgContextResolution(orgContext, initReason);
      }
      if (orgContext.status === 'error') {
        adminLoadStatus = 'error';
        adminLoadError = 'org_context_unavailable';
        console.warn('[courseStore.init] org_context_error', {
          membershipStatus: orgContext.membershipStatus,
          status: orgContext.status,
        });
        return;
      }
      // Record the org being resolved so forceInit can detect org switches.
      resolvedOrgIdForInit = orgContext.orgId ?? null;
      if (!orgContext.userId) {
        console.info('[courseStore.init] No authenticated session detected; loading local defaults without hitting API.');
        courses = getDefaultCourses();
        return;
      }
      const adminSurfaceDetected = isAdminSurface();
      if (adminSurfaceDetected && !orgContext.role) {
        orgContext = await waitForRoleResolution(orgContext, initReason);
        if (!orgContext.role) {
          adminLoadStatus = 'error';
          adminLoadError = 'role_context_unavailable';
          console.warn('[courseStore.init] Role context unavailable after waiting; aborting admin catalog init.');
          return;
        }
      }
      const roleResolved = typeof orgContext.role === 'string' && orgContext.role.length > 0;
      const hasAdminRole = roleResolved && (orgContext.role ?? '').toLowerCase().includes('admin');
      const treatAsAdmin = adminSurfaceDetected || hasAdminRole;
      restrictToOrg = !treatAsAdmin;
      const adminMode = treatAsAdmin;
      // Org scoping is determined directly from the resolved context — no deferred bootstrap needed.
      let runtimeStatus = getRuntimeStatus() ?? FALLBACK_RUNTIME_STATUS;
      try {
        const refreshedStatus = await refreshRuntimeStatus();
        if (refreshedStatus) {
          runtimeStatus = refreshedStatus;
        }
      } catch (statusError) {
        console.warn('[courseStore.init] Runtime status refresh failed; using last known snapshot.', statusError);
      }
      runtimeStatus = runtimeStatus ?? FALLBACK_RUNTIME_STATUS;
      // supabaseOperational is checked implicitly through apiReachable/supabaseHealthy downstream
      void (runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy);
      const apiReachable = runtimeStatus.apiReachable ?? runtimeStatus.apiHealthy;
      const apiAuthRequired = runtimeStatus.apiAuthRequired;
      // HEALTH PROBE DECOUPLED FROM ADMIN API GATE:
      // The /api/health probe is purely informational for UI status indicators.
      // A transient health failure (net::ERR_NETWORK_CHANGED, timeout, network
      // switch) must NOT abort the admin catalog fetch — the actual
      // /api/admin/courses call will fail with a real error if the API is truly
      // unreachable.  Gating on health probe results caused the store to wipe
      // valid courses and set adminLoadStatus='api_unreachable' whenever the
      // health check raced with a network change, even when the API itself was
      // perfectly healthy.
      //
      // For admin surfaces: always attempt the API call.
      // For learner surfaces: respect the health probe (network gating).
      canUseAdminApi = adminMode && (adminSurfaceDetected ? true : apiReachable);
      if (import.meta.env?.DEV) {
        console.info('[courseStore.init] runtime_status_snapshot', { apiReachable, apiAuthRequired, adminMode, canUseAdminApi });
      }
      if (import.meta.env.DEV) {
        console.debug('[HEALTH RESULT]', {
          ts: Date.now(),
          apiReachable,
          apiAuthRequired,
          adminMode,
          adminSurfaceDetected,
          canUseAdminApi,
          lastError: runtimeStatus.lastError ?? null,
        });
      }
      // Prefer admin list (richer shape) but gracefully fall back to published-only
      let dbCourses: Course[] = [];
      // Capture the current catalog BEFORE any fetch so the merge logic below
      // can reference prior course state (for edit-lock guards and module
      // structure preservation) even though the merge output starts from {}.
      // Also used by the snapshot-restore on fetch failure.
      const catalogSnapshot = { ...courses };

      if (canUseAdminApi) {
        if (apiAuthRequired && import.meta.env?.DEV) {
          console.info('[courseStore.init] Health probe indicated auth required, but API is reachable. Proceeding with admin course load attempt.');
        }
        // NOTE: we no longer flush `courses = {}` here before the API call.
        // The pre-fetch flush created a subscriber-visible empty window between
        // the flush and the resolved fetch, causing blank-page flashes on every
        // re-init (navigation, org switch, etc.).  Instead the merge below builds
        // its output from a fresh `{}` using catalogSnapshot as the "prior state"
        // reference, achieving the same single-source guarantee without the flash.
        try {
          console.debug('[COURSE FETCH]', {
            source: 'getAllCoursesFromDatabase',
            url: '/api/admin/courses',
            params: { includeStructure: true, includeLessons: true },
          });
          if (import.meta.env.DEV) {
            console.debug('[FETCH START]', {
              ts: Date.now(),
              pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
              endpoint: '/api/admin/courses?includeStructure=true&includeLessons=true',
            });
          }
          dbCourses = await getAllCoursesFromDatabase();
          if (import.meta.env.DEV) {
            console.debug('[RAW API RESPONSE]', {
              ts: Date.now(),
              count: dbCourses.length,
              ids: dbCourses.slice(0, 5).map((c) => c.id),
              titles: dbCourses.slice(0, 5).map((c) => c.title),
              withModules: dbCourses.filter((c) => Array.isArray(c.modules) && c.modules.length > 0).length,
              withLessons: dbCourses.filter((c) => (c.modules ?? []).some((m) => Array.isArray(m.lessons) && m.lessons.length > 0)).length,
            });
          }
          console.debug('[COURSE STORE INPUT]', dbCourses);
          // The server list endpoint now pre-filters to complete courses only.
          // This client-side check is a belt-and-suspenders guard: if a course
          // somehow arrives without modules it is rejected here with a clear log.
          // Under normal operation this filter should be a no-op.
          const beforeFilter = dbCourses.length;
          dbCourses = dbCourses.filter((c) => {
            const hasModules = Array.isArray(c.modules) && c.modules.length > 0;
            if (!hasModules) {
              console.warn('[COURSE GRAPH REJECTED] no_modules — server should have excluded this row', {
                courseId: c.id, title: c.title, status: c.status, source: 'server',
              });
              return false;
            }
            if (typeof c.version === 'number' && c.version <= 0) {
              console.warn('[COURSE GRAPH REJECTED] invalid_version', { courseId: c.id, version: c.version, source: 'server' });
              return false;
            }
            const hasLessons = (c.modules ?? []).some(
              (m) => Array.isArray(m.lessons) && m.lessons.length > 0,
            );
            if (!hasLessons) {
              console.warn('[COURSE GRAPH REJECTED] no_lessons_in_any_module — server should have excluded this row', {
                courseId: c.id, title: c.title, source: 'server',
              });
              return false;
            }
            if (import.meta.env.DEV) {
              const mods = c.modules ?? [];
              console.debug('[COURSE GRAPH VALID]', c.id, c.title, {
                modules: mods.length,
                lessons: mods.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0),
              });
            }
            return true;
          });
          if (import.meta.env?.DEV) {
            const rejected = beforeFilter - dbCourses.length;
            if (rejected > 0) {
              console.warn('[courseStore.init] courses_rejected_missing_structure', {
                rejected, remaining: dbCourses.length, source: 'server',
                note: 'server-side filtering should prevent this — check /api/admin/courses handler',
              });
            }
            console.info('[courseStore.init] admin_courses_loaded', { count: dbCourses.length });
          }
          // Production safety: strip any E2E / test courses from the server
          // response before they can enter the store.  In production the server
          // should not return these, but this is a belt-and-suspenders guard.
          // Applied in ALL environments (not just PROD) since demo-data.json
          // can accumulate Integration Test entries during E2E runs.
          const beforeTestFilter = dbCourses.length;
          dbCourses = dbCourses.filter((c) => {
            if (isTestOrE2ECourse(c)) {
              console.warn('[courseStore.init] server_course_rejected_test_data', { courseId: c.id, title: c.title, source: 'server' });
              return false;
            }
            return true;
          });
          if (beforeTestFilter !== dbCourses.length) {
            console.warn('[courseStore.init] test_courses_stripped_from_server_response', {
              before: beforeTestFilter,
              after: dbCourses.length,
              source: 'server',
            });
          }
          adminLoadStatus = dbCourses.length === 0 ? 'empty' : 'success';
          if (adminLoadStatus === 'empty') {
            console.info('[courseStore.init] admin_courses_empty (0 results from /api/admin/courses).');
          }
          if (import.meta.env.DEV) {
            console.debug('[MAPPED COURSES]', {
              ts: Date.now(),
              count: dbCourses.length,
              ids: dbCourses.slice(0, 5).map((c) => c.id),
              titles: dbCourses.slice(0, 5).map((c) => c.title),
              withModules: dbCourses.filter((c) => Array.isArray(c.modules) && c.modules.length > 0).length,
              withLessons: dbCourses.filter((c) => (c.modules ?? []).some((m) => Array.isArray(m.lessons) && m.lessons.length > 0)).length,
              adminLoadStatus,
            });
          }
        } catch (adminError) {
          const status = adminError instanceof ApiError ? adminError.status : undefined;
          const isBlockedByGuard = adminError instanceof Error && adminError.message?.includes('non-admin route');
          const isNetworkError = adminError instanceof Error && (
            adminError.message?.includes('ERR_NETWORK') ||
            adminError.message?.includes('network') ||
            adminError.message?.includes('Failed to fetch') ||
            adminError.message?.includes('NetworkError') ||
            status === undefined // fetch threw, not an HTTP error
          );
          adminLoadStatus = 'error';
          adminLoadError =
            status === 401 || status === 403
              ? 'admin_courses_auth_error'
              : adminError instanceof Error
              ? adminError.message
              : 'admin_courses_error';
          if (isBlockedByGuard) {
            // This should never happen after the skipAdminGateCheck fix in courseService.ts,
            // but if it does, log it clearly so it's distinguishable from a real 403.
            console.error('[courseStore.init] admin_fetch_blocked_by_surface_guard — this is a bug; admin surface was confirmed but the API guard still rejected the call', {
              status,
              message: adminLoadError,
              pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
            });
          } else {
            console.warn('[courseStore.init] admin_courses_error', {
              status,
              message: adminLoadError,
              source: 'admin_fetch',
              isNetworkError,
            });
          }
          dbCourses = [];
          // CATALOG PRESERVATION: if the API call failed due to a transient
          // network error (not an auth error, not a 4xx/5xx), restore the
          // previous catalog snapshot so the UI keeps showing valid courses
          // rather than an empty page.  Auth errors must wipe the catalog
          // (user may have lost access).  Real API errors (5xx) should also
          // wipe — stale data is worse than an error state for permissions.
          if (isNetworkError && Object.keys(catalogSnapshot).length > 0) {
            courses = catalogSnapshot;
            adminLoadStatus = 'success'; // treat as success — we kept the catalog
            console.warn('[courseStore.init] admin_fetch_network_error_catalog_preserved', {
              restoredCount: Object.keys(catalogSnapshot).length,
              error: adminLoadError,
            });
          }
        }
      } else if (adminMode && !apiReachable) {
        // Health probe says unreachable, but this is a non-admin-surface admin user.
        // Still attempt the fetch — the actual HTTP call will fail with a real error
        // if the API is truly down, rather than silently setting api_unreachable based
        // on a potentially stale/transient health check result.
        console.warn('[courseStore.init] admin_mode_health_degraded — attempting API call anyway', {
          reason: runtimeStatus.lastError || 'unknown',
          adminSurfaceDetected,
          note: 'api_unreachable is only set if the actual fetch fails',
        });
        // Snapshot BEFORE flush so we can restore on failure — same pattern as
        // the canUseAdminApi branch above.  Without this, a failed degraded-mode
        // fetch left courses={} permanently, wiping a valid previously-loaded catalog.
        const degradedCatalogSnapshot = { ...courses };
        try {
          console.debug('[COURSE RESET]', { caller: 'courseStore.init/degraded-pre-fetch-flush', beforeCount: Object.keys(courses).length });
          dbCourses = await getAllCoursesFromDatabase();
          adminLoadStatus = dbCourses.length === 0 ? 'empty' : 'success';
        } catch (healthDegradedFetchErr) {
          adminLoadStatus = 'api_unreachable';
          adminLoadError = healthDegradedFetchErr instanceof Error
            ? healthDegradedFetchErr.message
            : runtimeStatus.lastError || 'api_unreachable';
          console.warn('[courseStore.init] admin_courses_api_unreachable (fetch confirmed)', {
            reason: adminLoadError,
          });
          // Restore snapshot so the UI keeps showing the last-known-good catalog
          // instead of an empty page after a transient network failure.
          if (Object.keys(degradedCatalogSnapshot).length > 0) {
            courses = degradedCatalogSnapshot;
            adminLoadStatus = 'success';
            console.warn('[courseStore.init] admin_degraded_catalog_preserved', {
              restoredCount: Object.keys(degradedCatalogSnapshot).length,
              error: adminLoadError,
            });
          }
        }
      } else if (!adminMode) {
        console.warn('[courseStore.init] Skipping admin course load for non-admin role.');
      }

      const shouldLoadPublishedCatalog =
        restrictToOrg || (!restrictToOrg && (adminLoadStatus === 'error' || adminLoadStatus === 'api_unreachable'));
      const publishedFallbackAllowed = !adminSurfaceDetected;

      if ((!dbCourses || dbCourses.length === 0) && shouldLoadPublishedCatalog) {
        if (!publishedFallbackAllowed) {
          console.info('[courseStore.init] admin_surface_detected_blocking_fallback', {
            adminSurfaceDetected,
            role: orgContext.role ?? null,
            status: orgContext.status,
          });
          console.info('[courseStore.init] published_fallback_skipped_admin_surface', {
            adminSurfaceDetected,
            reason: 'admin_surface',
          });
          return;
        }
        const learnerContextReadyForFallback = restrictToOrg
          ? orgContext.status === 'ready' && !!orgContext.orgId
          : orgContext.status === 'ready';
        if (!learnerContextReadyForFallback) {
          console.info('[courseStore.init] Waiting for org context before published fallback.');
          orgContext = await waitForOrgContextResolution(orgContext, 'published_fallback');
          if (orgContext.status !== 'ready') {
            adminLoadStatus = 'error';
            adminLoadError = 'published_fallback_context_unavailable';
            console.warn('[courseStore.init] Unable to resolve org context for published fallback.', {
              status: orgContext.status,
              membershipStatus: orgContext.membershipStatus,
            });
            return;
          }
        }

        if (import.meta.env?.DEV) {
          console.info('[courseStore.init] Loading published catalog as fallback...');
        }
        try {
          if (restrictToOrg) {
            if (orgContext.orgId) {
              dbCourses = await fetchPublishedCourses({ orgId: orgContext.orgId });
            } else {
              console.warn(
                '[courseStore.init] Missing organizationId; loading full published catalog for learner context.',
              );
              dbCourses = await fetchPublishedCourses();
            }
          } else {
            dbCourses = await fetchPublishedCourses();
          }
          if (import.meta.env?.DEV) {
            console.info('[courseStore.init] published_catalog_loaded', { count: dbCourses.length });
          }
        } catch (fallbackErr) {
          console.warn('[courseStore.init] Published catalog fallback failed:', fallbackErr);
          dbCourses = [];
        }
      }

      const adminEmptySuccess = !restrictToOrg && adminLoadStatus === 'empty';
      const adminUnauthorized = !restrictToOrg && adminLoadStatus === 'error' && (adminLoadError === 'admin_courses_auth_error');

      if (dbCourses.length > 0) {
        // SINGLE SOURCE GUARANTEE: build the merged output from a fresh empty
        // object so no stale entries from a prior init (deleted courses etc.) can
        // survive.  Use catalogSnapshot as the "prior state" reference so the
        // edit-lock guard and structure-preservation logic still have access to
        // the last-known-good course data without requiring a pre-fetch flush.
        const merged: { [key: string]: Course } = {};
        dbCourses.forEach((apiCourse: Course) => {
          const courseWithVersion =
            typeof apiCourse.version === 'number' && Number.isFinite(apiCourse.version)
              ? apiCourse
              : { ...apiCourse, version: 1 };
          // Use catalogSnapshot (pre-fetch state) as the "prior entry" reference so
          // the edit-lock guard and structure-preservation logic work correctly even
          // though merged starts from {}.
          const existing = catalogSnapshot[courseWithVersion.id];
          if (editingCourseId && courseWithVersion.id === editingCourseId && existing) {
            return;
          }
          const incomingStructureLoaded = hasLoadedStructure(courseWithVersion);
          const existingStructureLoaded = hasLoadedStructure(existing ?? null);
          const normalizedIncomingModules = sanitizeModuleGraph(courseWithVersion.modules || []);

          // Deep-validation immutability guard:
          // Before accepting the incoming module graph, verify it actually contains
          // lesson content.  If the existing course has lessons and the incoming
          // version does not (e.g. a list-endpoint summary that omits modules),
          // keep the existing graph and emit a DEV warning.
          const incomingHasLessons = normalizedIncomingModules.some(
            (m) => Array.isArray(m.lessons) && m.lessons.length > 0,
          );
          const existingHasLessons =
            Array.isArray(existing?.modules) &&
            existing!.modules.some((m) => Array.isArray(m.lessons) && m.lessons.length > 0);

          // Structure-preservation guard: if the stored course already has a
          // fully-loaded module graph and the incoming data is a summary (no
          // structure), keep the existing modules to avoid wiping lesson content
          // that was fetched in a prior detail request.
          //
          // CRITICAL: this guard must NEVER fire when the incoming course is the
          // authoritative full-structure admin catalog response.  If the incoming
          // data has lessons (incomingHasLessons) the incoming version always wins —
          // regardless of what the existing entry looks like.  This prevents a stale
          // zero-module cache entry from blocking a valid full-structure update.
          const shouldPreserveExistingModules =
            incomingHasLessons
              ? false  // incoming is authoritative — never preserve stale existing data
              : (existingStructureLoaded && !incomingStructureLoaded) ||
                (existingHasLessons && !incomingHasLessons);

          if (shouldPreserveExistingModules && import.meta.env?.DEV) {
            console.info(
              '[courseStore] course_graph_downgrade_blocked',
              {
                courseId: courseWithVersion.id,
                reason: !incomingHasLessons
                  ? 'incoming_has_no_lessons'
                  : 'incoming_is_summary_existing_is_full',
                existingModules: existing?.modules?.length ?? 0,
                incomingModules: normalizedIncomingModules.length,
              },
            );
          }

          const resolvedModules = shouldPreserveExistingModules
            ? (existing?.modules ?? normalizedIncomingModules)
            : incomingStructureLoaded
            ? normalizedIncomingModules
            : existing?.modules ?? normalizedIncomingModules;
          const resolvedModuleCount = incomingStructureLoaded
            ? courseWithVersion.moduleCount ?? normalizedIncomingModules.length
            : existing?.moduleCount ?? courseWithVersion.moduleCount ?? null;
          const resolvedLessonCount = incomingStructureLoaded
            ? courseWithVersion.lessonCount ??
              normalizedIncomingModules.reduce(
                (total, module) => total + ((module.lessons || []).length),
                0,
              )
            : existing?.lessonCount ?? courseWithVersion.lessonCount ?? null;

          const mergedCourse = existing
            ? {
                ...existing,
                ...courseWithVersion,
                version:
                  typeof courseWithVersion.version === 'number'
                    ? courseWithVersion.version
                    : existing.version,
              }
            : { ...courseWithVersion };

          mergedCourse.modules = resolvedModules;
          // When we preserved the existing full structure, keep structureLoaded true
          // and source 'full' so downstream consumers don't re-fetch needlessly.
          mergedCourse.structureLoaded = shouldPreserveExistingModules
            ? true
            : incomingStructureLoaded || existingStructureLoaded;
          mergedCourse.structureSource = (shouldPreserveExistingModules || incomingStructureLoaded)
            ? 'full'
            : existing?.structureSource ?? courseWithVersion.structureSource ?? (mergedCourse.structureLoaded ? 'full' : 'summary');
          if (resolvedModuleCount !== null && typeof resolvedModuleCount !== 'undefined') {
            mergedCourse.moduleCount = resolvedModuleCount;
          }
          if (resolvedLessonCount !== null && typeof resolvedLessonCount !== 'undefined') {
            // Only overwrite with 0 if structure was actually loaded (avoids wiping a known-good count
            // with the placeholder 0 the list endpoint returns when modules haven't been fetched yet).
            if (resolvedLessonCount > 0 || incomingStructureLoaded) {
              mergedCourse.lessonCount = resolvedLessonCount;
              mergedCourse.lessons = resolvedLessonCount;
            }
          }
          merged[courseWithVersion.id] = mergedCourse;
        });
        console.debug('[COURSE OVERWRITE]', {
          caller: 'courseStore.init/merge',
          beforeCount: Object.keys(courses).length,
          afterCount: Object.keys(merged).length,
          ids: Object.keys(merged),
        });
        courses = merged;
        // Belt-and-suspenders: notify directly after writing courses so
        // subscribers always receive the update even if the finally-block
        // setAdminCatalogState is suppressed by shallowEqualState.
        notifySubscribers();
        console.debug('[COURSE STORE WRITE]', {
          source: 'init/merge',
          count: Object.keys(merged).length,
          ids: Object.keys(merged),
          allHaveModules: Object.values(merged).every(
            (c) => Array.isArray(c.modules) && c.modules.length > 0,
          ),
        });
        if (import.meta.env?.DEV) {
          console.info(`[courseStore.init] catalog_merged`, { loaded: dbCourses.length, totalInStore: Object.keys(merged).length });
        }
      } else if (adminEmptySuccess) {
        console.debug('[COURSE RESET]', { caller: 'courseStore.init/adminEmptySuccess', beforeCount: Object.keys(courses).length });
        courses = {};
        console.info('[courseStore.init] Admin catalog is empty; awaiting first course creation.');
      } else if (adminUnauthorized) {
        console.debug('[COURSE RESET]', { caller: 'courseStore.init/adminUnauthorized', beforeCount: Object.keys(courses).length });
        courses = {};
        console.warn('[courseStore.init] Admin course load unauthorized; leaving local catalog empty.');
      } else {
        if (DEFAULT_CATALOG_ALLOWED) {
          if (import.meta.env?.DEV) {
            console.info('[courseStore.init] No courses returned; loading local default catalog for demo use.');
          }
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
          console.debug('[COURSE RESET]', { caller: 'courseStore.init/default_catalog_disabled', beforeCount: Object.keys(courses).length });
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
        courses = await ensureAssignmentScopedCatalog(courses, orgContext.userId, orgContext.orgId, {
          skipDiagnostics: orgContext.status !== 'ready',
        });
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
        console.debug('[COURSE RESET]', { caller: 'courseStore.init/catch/default_catalog_disabled', beforeCount: Object.keys(courses).length });
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
        lastUpdatedAt: monotonicNow(),
        lastError: adminLoadError,
      });
      // Persist the resolved org so forceInit can detect org switches on the next call.
      if (resolvedOrgIdForInit !== null) {
        lastInitOrgId = resolvedOrgIdForInit;
      }
    }
    })();

    initPromise.finally(() => {
      initPromise = null;
    });

    return initPromise;
  },

  // Force a fresh catalog fetch, bypassing the ready-guard.
  // Use this for explicit user-triggered retries when the catalog is in error.
  forceInit: (options?: { newOrgId?: string | null; flushCache?: boolean }): Promise<void> => {
    // If caller signals an org switch, flush the stale catalog cache for the old org
    // so the fresh init doesn't serve a 30-minute-old snapshot from a different workspace.
    const incomingOrgId = options?.newOrgId ?? null;
    const shouldFlushAllCaches = options?.flushCache === true;

    try {
      if (shouldFlushAllCaches) {
        clearAllCatalogCache();
      } else if (incomingOrgId !== undefined && incomingOrgId !== lastInitOrgId) {
        clearCatalogCacheForOrg(lastInitOrgId, incomingOrgId);
      }
    } catch (cacheErr) {
      console.warn('[courseStore.forceInit] Failed to flush catalog cache', cacheErr);
    }

    // Clear any in-flight promise so a fresh run can start.
    initPromise = null;
    // Notify other tabs about the org switch so they can reset their initPromise
    // and avoid serving a stale catalog from the previous org.
    if (incomingOrgId !== null && incomingOrgId !== lastInitOrgId) {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('huddle:catalog-sync');
          ch.postMessage({ type: 'org_switch', newOrgId: incomingOrgId });
          ch.close();
        }
      } catch {
        // Non-fatal — cross-tab coordination is best-effort.
      }
    }
    // Signal courseDataLoader (and any other in-memory caches) to flush their
    // cached results so the next course-detail load fetches fresh data.
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('huddle:catalog-flush'));
      }
    } catch { /* non-fatal */ }
    // Reset phase to idle so the init logic runs from scratch.
    setAdminCatalogState((prev) => ({
      ...prev,
      phase: 'idle',
      adminLoadStatus: prev.adminLoadStatus === 'success' ? 'success' : prev.adminLoadStatus,
    }));
    return courseStore.init({ reason: 'force_init' });
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
    const derivedLessonCount = normalizedModules.reduce(
      (total, module) => total + ((module.lessons || []).length),
      0,
    );
    const resolvedVersion =
      typeof course.version === 'number' && Number.isFinite(course.version) ? course.version : 1;
    const modulesLoaded = hasLoadedStructure({ ...course, modules: normalizedModules });
    const nextCourse: Course = {
      ...course,
      version: resolvedVersion,
      modules: normalizedModules,
      moduleCount: normalizedModules.length,
      lessonCount: derivedLessonCount,
      lessons: derivedLessonCount,
      structureLoaded: modulesLoaded,
      structureSource: modulesLoaded ? 'full' : course.structureSource ?? 'summary',
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
      // Capture the local timestamp at the moment this sync was initiated.
      // The .then() callback will only apply the server response if no newer
      // local save has occurred in the meantime, preventing the async
      // round-trip from overwriting edits made while the request was in flight.
      const syncInitiatedAt: string = nextCourse.lastUpdated ?? new Date().toISOString();
      const apiPayload = createCoursePayloadForApi(nextCourse);
      syncCourseToDatabase(apiPayload)
        .then((persisted) => {
          if (!persisted) return;
          const normalized = normalizeCourse(persisted as Course);
          const targetId = normalized.id || nextCourse.id;
          // Bail out if a newer local save has already written to this slot —
          // the server response would contain stale data relative to what the
          // user most recently edited.
          const currentLastUpdated = courses[targetId]?.lastUpdated ?? courses[nextCourse.id]?.lastUpdated;
          if (currentLastUpdated && currentLastUpdated > syncInitiatedAt) {
            if (import.meta.env.DEV) {
              console.debug('[courseStore] Skipping stale server response for course', targetId, '(local edit is newer)');
            }
            return;
          }
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
          notifySubscribers();
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
      version: typeof courseData.version === 'number' && Number.isFinite(courseData.version) ? courseData.version : 1,
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
    
    newCourse.modules = sanitizeModuleGraph(newCourse.modules || [], { forceNewIds: true });
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
        notifySubscribers();
      })
      .catch((error) => {
        if (error instanceof SlugConflictError) {
          console.warn(
            `Slug conflict when persisting course "${newCourse.title}". Suggested slug applied.`,
            { suggestion: error.suggestion },
          );
          courses[newCourse.id].slug = error.suggestion;
          _saveCoursesToLocalStorage(courses);
          return;
        }
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
export const generateId = (_prefix: string = 'item'): string => randomUuid();

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
