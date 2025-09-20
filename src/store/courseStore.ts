import { CourseService } from '../services/courseService';

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

export interface LessonContent {
  // Video content
  videoUrl?: string;
  videoSourceType?: 'internal' | 'youtube' | 'vimeo' | 'external';
  externalVideoId?: string;
  videoFile?: File;
  transcript?: string;
  notes?: string;
  fileName?: string;
  fileSize?: string;
  
  // Interactive content
  elements?: InteractiveElement[]; // New enhanced interactive structure
  currentScenarioId?: string; // For tracking current position in branching scenarios
  userChoices?: { [scenarioId: string]: string }; // Track user's path through scenarios
  completedElements?: string[]; // Track which interactive elements are completed
  
  // Legacy interactive content (for backward compatibility)
  exerciseType?: string;
  scenarioText?: string;
  options?: Array<{
    text: string;
    feedback: string;
    isCorrect: boolean;
  }>;
  instructions?: string;
  
  // Quiz content
  questions?: Array<{
    id: string;
    text: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
  }>;
  passingScore?: number;
  allowRetakes?: boolean;
  showCorrectAnswers?: boolean;
  
  // Download content
  title?: string;
  description?: string;
  fileUrl?: string;
  downloadFile?: File;
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'interactive' | 'quiz' | 'download' | 'text';
  duration: string;
  content: LessonContent;
  completed: boolean;
  order: number;
}

export interface Resource {
  id: string;
  title: string;
  type: string;
  size: string;
  downloadUrl: string;
  file?: File;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  order: number;
  lessons: Lesson[];
  resources: Resource[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  thumbnail: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  enrollments: number;
  completions: number;
  completionRate: number;
  avgRating: number;
  totalRatings: number;
  createdBy: string;
  createdDate: string;
  lastUpdated: string;
  publishedDate?: string;
  dueDate?: string;
  estimatedTime: string;
  prerequisites: string[];
  learningObjectives: string[];
  certification?: {
    available: boolean;
    name: string;
    requirements: string[];
    validFor: string;
    renewalRequired: boolean;
  };
  tags: string[];
  modules: Module[];
  keyTakeaways: string[];
  type: string;
  lessons: number;
  rating: number;
  progress: number;
}

// Load courses from localStorage or use defaults
const _loadCoursesFromLocalStorage = (): { [key: string]: Course } => {
  try {
    const savedCourses = localStorage.getItem('huddle_courses');
    if (savedCourses) {
      return JSON.parse(savedCourses);
    }
  } catch (error) {
    console.error('Error loading courses from localStorage:', error);
  }
  
  // Return default courses if nothing in localStorage
  return getDefaultCourses();
};

// Save courses to localStorage
const _saveCoursesToLocalStorage = (courses: { [key: string]: Course }): void => {
  try {
    localStorage.setItem('huddle_courses', JSON.stringify(courses));
  } catch (error) {
    console.error('Error saving courses to localStorage:', error);
  }
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
            type: 'PDF',
            size: '2.3 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/leadership-assessment.pdf'
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
            type: 'PDF',
            size: '1.8 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/psych-safety-checklist.pdf'
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
              notes: 'Key bias types: confirmation bias, affinity bias, halo effect'
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
            type: 'PDF',
            size: '3.1 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/bias-toolkit.pdf'
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
            type: 'PDF',
            size: '1.5 MB',
            downloadUrl: 'https://storage.thehuddleco.com/resources/empathy-assessment.pdf'
          }
        ]
      }
    ]
  }
});

// Initialize courses from localStorage or defaults
let courses: { [key: string]: Course } = _loadCoursesFromLocalStorage();

// Store management functions
export const courseStore = {
  init: async (): Promise<void> => {
    try {
      // Try to load courses from database first
      const dbCourses = await CourseService.getAllCoursesFromDatabase();
      
      if (dbCourses.length > 0) {
        // Load courses from database (including drafts)
        console.log(`Loading ${dbCourses.length} courses from database...`);
        courses = {};
        dbCourses.forEach(course => {
          courses[course.id] = course;
        });
        _saveCoursesToLocalStorage(courses);
        console.log('Courses loaded from database successfully');
      } else {
        // No courses in database, sync default courses
        console.log('No courses found in database, syncing default courses...');
        const defaultCourses = getDefaultCourses();
        courses = defaultCourses;
        
        for (const course of Object.values(defaultCourses)) {
          await CourseService.syncCourseToDatabase(course);
          console.log(`Synced course: ${course.title}`);
        }
        
        _saveCoursesToLocalStorage(courses);
        console.log('Default courses synced to database successfully');
      }
    } catch (error) {
      console.error('Error initializing course store:', error);
      // Fall back to local storage or defaults if database fails
      const localCourses = _loadCoursesFromLocalStorage();
      if (Object.keys(localCourses).length === 0) {
        courses = getDefaultCourses();
        _saveCoursesToLocalStorage(courses);
      } else {
        courses = localCourses;
      }
    }
  },

  getCourse: (id: string): Course | null => {
    return courses[id] || null;
  },

  saveCourse: (course: Course): void => {
    course.lastUpdated = new Date().toISOString();
    courses[course.id] = { ...course };
    _saveCoursesToLocalStorage(courses);
    
    // Always sync to Supabase in background (including drafts and published courses)
    CourseService.syncCourseToDatabase(course).catch(error => {
      console.warn(`Failed to sync course "${course.title}" to database:`, error.message || error);
    });
  },

  getAllCourses: (): Course[] => {
    return Object.values(courses);
  },

  deleteCourse: (id: string): boolean => {
    if (courses[id]) {
      delete courses[id];
      _saveCoursesToLocalStorage(courses);
      return true;
    }
    return false;
  },

  createCourse: (courseData: Partial<Course>): Course => {
    const id = courseData.id || `course-${Date.now()}`;
    const newCourse: Course = {
      id,
      title: courseData.title || 'New Course',
      description: courseData.description || '',
      status: 'draft',
      thumbnail: courseData.thumbnail || 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '0 min',
      difficulty: 'Beginner',
      enrollments: 0,
      completions: 0,
      completionRate: 0,
      avgRating: 0,
      totalRatings: 0,
      createdBy: 'Mya Dennis',
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      estimatedTime: '0 minutes',
      prerequisites: [],
      learningObjectives: [],
      tags: [],
      keyTakeaways: [],
      type: 'Mixed',
      lessons: 0,
      rating: 0,
      progress: 0,
      modules: [],
      ...courseData
    };
    
    courses[id] = newCourse;
    _saveCoursesToLocalStorage(courses);
    return newCourse;
  },

  updateCourseStats: (id: string, stats: Partial<Pick<Course, 'enrollments' | 'completions' | 'completionRate' | 'avgRating' | 'totalRatings'>>): void => {
    if (courses[id]) {
      Object.assign(courses[id], stats);
      _saveCoursesToLocalStorage(courses);
    }
  }
};

// Helper function to generate unique IDs
export const generateId = (prefix: string = 'item'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to calculate total course duration
export const calculateCourseDuration = (modules: Module[]): string => {
  const totalMinutes = modules.reduce((acc, module) => {
    const moduleDuration = module.lessons.reduce((lessonAcc, lesson) => {
      const minutes = parseInt(lesson.duration.split(' ')[0]) || 0;
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