import type { CourseAssignmentStatus } from './assignment';

// Core types for the Course Management System

export interface Course {
  // Core identification
  id: string;
  slug?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  title: string;
  description: string;
  
  // Visual and categorization
  thumbnail: string;
  category?: string; // optional for backward compatibility
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  
  // Instructor information
  instructorId?: string; // optional for backward compatibility
  instructorName?: string; // optional for backward compatibility
  instructorAvatar?: string; // optional for backward compatibility
  
  // Duration and time estimates
  estimatedDuration?: number; // in minutes - optional for backward compatibility
  duration: string; // formatted string like "2h 30m"
  
  // Learning content
  learningObjectives?: string[]; // optional for backward compatibility
  prerequisites?: string[]; // optional for backward compatibility
  tags?: string[]; // optional for backward compatibility
  language?: string; // optional for backward compatibility
  
  // Publishing and status
  createdAt?: string; // optional for backward compatibility
  updatedAt?: string; // optional for backward compatibility
  publishedAt?: string;
  status: 'draft' | 'published' | 'archived';
  
  // Analytics and engagement
  enrollmentCount?: number; // optional for backward compatibility
  enrollments?: number; // alias for backwards compatibility
  rating?: number; // optional for backward compatibility
  avgRating?: number; // alias for backwards compatibility
  reviewCount?: number; // optional for backward compatibility
  totalRatings?: number; // alias for backwards compatibility
  completions?: number; // optional for backward compatibility
  completionRate?: number; // optional for backward compatibility
  
  // Content structure (supporting both formats)
  chapters?: Chapter[]; // optional for backward compatibility
  modules?: Module[]; // for courseStore compatibility
  
  // Additional features
  certificate?: CertificateTemplate;
  certification?: { // for courseStore compatibility
    available: boolean;
    name: string;
    requirements: string[];
    validFor: string;
    renewalRequired: boolean;
  };
  accessibilityFeatures?: AccessibilityOptions;
  metadata?: CourseMetadata;
  
  // Legacy/compatibility fields
  createdBy?: string;
  createdDate?: string;
  lastUpdated?: string;
  publishedDate?: string;
  dueDate?: string;
  estimatedTime?: string;
  keyTakeaways?: string[];
  type?: string;
  lessons?: number;
  progress?: number;
  isPublished?: boolean; // for backwards compatibility
  assignmentStatus?: CourseAssignmentStatus;
  assignmentDueDate?: string | null;
  assignmentProgress?: number;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  order: number;
  lessons: Lesson[];
  resources?: Resource[];
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  lessons: Lesson[];
  isLocked?: boolean;
  unlockConditions?: UnlockCondition[];
}

export interface Lesson {
  id: string;
  chapterId?: string; // optional for backward compatibility
  title: string;
  description?: string; // optional for backward compatibility
  type: 'video' | 'text' | 'quiz' | 'interactive' | 'document' | 'scenario';
  order?: number; // optional for backward compatibility
  estimatedDuration?: number; // optional for backward compatibility
  duration?: string; // formatted duration string for backwards compatibility
  content: LessonContent;
  // Raw JSON content (legacy and import compatibility). Use `migrateLessonContent` to canonicalize.
  content_json?: any;
  completionRule?: Record<string, any>;
  isRequired?: boolean; // optional for backward compatibility
  passingScore?: number; // for quizzes
  maxAttempts?: number;
  resources?: Resource[]; // optional for backward compatibility
  completed?: boolean; // for tracking completion status
}

export interface LessonContent {
  // Video content
  videoUrl?: string;
  videoProvider?: 'youtube' | 'vimeo' | 'wistia' | 'native';
  videoSourceType?: 'internal' | 'youtube' | 'vimeo' | 'external'; // for courseStore compatibility
  video?: LessonVideo | null;
  externalVideoId?: string; // for courseStore compatibility
  videoFile?: File; // for courseStore compatibility
  videoDuration?: number;
  videoThumbnail?: string;
  fileName?: string; // for courseStore compatibility
  fileSize?: string; // for courseStore compatibility
  videoAsset?: LessonVideoAsset | null;
  
  // Text content
  textContent?: string;
  content?: string; // alias for main text content (courseStore compatibility)
  notes?: string; // For additional course notes
  reflectionPrompt?: string; // for courseStore compatibility
  allowReflection?: boolean; // for courseStore compatibility
  requireReflection?: boolean; // for courseStore compatibility
  
  // Quiz content
  questions?: QuizQuestion[];

  // Interactive content
  interactiveUrl?: string;
  interactiveType?: 'h5p' | 'articulate' | 'custom';
  elements?: any[]; // For interactive elements
  exerciseType?: string; // for courseStore compatibility
  scenarioText?: string; // for courseStore compatibility
  options?: Array<{ // for courseStore compatibility
    text: string;
    feedback: string;
    isCorrect: boolean;
  }>;
  instructions?: string; // for courseStore compatibility
  
  // Scenario content
  currentScenarioId?: string; // For tracking scenario state
  userChoices?: Record<string, any>; // For storing user choices in scenarios
  completedElements?: string[]; // For tracking completed elements
  
  // Quiz settings
  passingScore?: number; // For quiz lessons
  allowRetakes?: boolean; // For quiz retake settings
  showCorrectAnswers?: boolean; // For quiz answer display settings
  
  // Download content
  title?: string; // for courseStore compatibility
  description?: string; // for courseStore compatibility
  fileUrl?: string; // for courseStore compatibility
  downloadFile?: File; // for courseStore compatibility
  documentAsset?: LessonVideoAsset | null;
  
  // Document content
  documentUrl?: string;
  documentType?: 'pdf' | 'slide' | 'document';
  documentId?: string;
  
  // Accessibility
  transcript?: string;
  captions?: Caption[];
  audioDescription?: string;
}

export interface QuizQuestion {
  id: string;
  type?: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay' | 'drag-drop'; // optional for backward compatibility
  question?: string; // optional for backward compatibility
  text?: string; // alias for backwards compatibility
  prompt?: string;
  options?: (string | QuizOption)[];
  correctAnswer?: string | string[]; // optional for backward compatibility
  correctAnswerIndex?: number; // alias for backwards compatibility
  correctOptionIds?: string[];
  explanation?: string;
  points?: number; // optional for backward compatibility
  feedback?: {
    correct: string;
    incorrect: string;
  };
}

export interface QuizOption {
  id: string;
  text: string;
  correct?: boolean;
  isCorrect?: boolean;
  feedback?: string;
}

export interface LessonVideo {
  type: 'youtube' | 'vimeo' | 'loom' | 'native' | 'external';
  url: string;
  embedUrl?: string;
  provider?: string;
  sourceType?: LessonContent['videoSourceType'];
  thumbnailUrl?: string;
  durationSeconds?: number;
  title?: string;
}

export interface LessonVideoAsset {
  assetId?: string;
  storagePath: string;
  bucket: string;
  bytes: number;
  mimeType: string;
  checksum?: string | null;
  uploadedAt?: string;
  uploadedBy?: string | null;
  source?: 'api' | 'supabase' | 'local';
  status?: 'uploaded' | 'pending' | 'failed';
  resumableToken?: string | null;
  signedUrl?: string | null;
  urlExpiresAt?: string | null;
}

export interface Caption {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'ppt' | 'zip' | 'link' | 'document' | 'slide' | 'template';
  url?: string;
  downloadUrl?: string;
  file?: File;
  size?: string;
  downloadable: boolean;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  template: string; // HTML template
  variables: string[]; // Variables to replace in template
  design: CertificateDesign;
}

export interface CertificateDesign {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  logo?: string;
  signature?: string;
}

export interface AccessibilityOptions {
  hasClosedCaptions: boolean;
  hasTranscripts: boolean;
  hasAudioDescription: boolean;
  hasSignLanguage: boolean;
  colorContrastCompliant: boolean;
  keyboardNavigable: boolean;
  screenReaderCompatible: boolean;
}

export interface CourseMetadata {
  seoTitle?: string;
  seoDescription?: string;
  socialShareImage?: string;
  customFields?: { [key: string]: any };
}

export interface UnlockCondition {
  type: 'lesson-complete' | 'quiz-passed' | 'time-elapsed' | 'prerequisite-course';
  targetId: string;
  value?: number;
}

// Learning Progress and Analytics Types
export interface LearnerProgress {
  id: string;
  learnerId: string;
  courseId: string;
  overallProgress: number;
  completedAt?: string;
  certificateId?: string;
  timeSpent: number;
  lastAccessedAt: string;
  enrolledAt: string;
  chapterProgress: ChapterProgress[];
  lessonProgress: LessonProgress[];
  bookmarks: Bookmark[];
  notes: Note[];
}

export interface ChapterProgress {
  chapterId: string;
  progress: number;
  completedAt?: string;
  timeSpent: number;
  lessonProgress: LessonProgress[];
}

export interface LessonProgress {
  lessonId: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'skipped';
  progress: number; // percentage
  progressPercent?: number; // for backwards compatibility
  isCompleted?: boolean; // for backwards compatibility
  startedAt?: string;
  completedAt?: string;
  timeSpent: number;
  lastAccessedAt?: string;
  lastPosition?: number; // for video/audio position
  attempts?: QuizAttempt[];
  score?: number;
}

export interface QuizAttempt {
  id: string;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  score: number;
  passed: boolean;
  answers: { [questionId: string]: any };
  timeSpent: number;
}

export interface Bookmark {
  id: string;
  lessonId: string;
  position: number; // timestamp for videos
  note?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  lessonId: string;
  position?: number; // timestamp for videos
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
  courseId: string;
  learnerId: string;
  templateId: string;
  issuedAt: string;
  certificateUrl: string;
  verificationCode: string;
  metadata: { [key: string]: any };
}

export interface LearningAnalytics {
  engagementScore: number;
  completionRate: number;
  averageSessionDuration: number;
  totalSessions: number;
  strugglingAreas: string[]; // lesson IDs where learner had difficulty
  strongAreas: string[]; // lesson IDs where learner excelled
  learningVelocity: number; // lessons per day
  deviceUsage: { [device: string]: number };
  timeOfDayPreferences: { [hour: string]: number };
}

// AI and Recommendations
export interface CourseRecommendation {
  courseId: string;
  score: number;
  reason: 'similar-content' | 'skill-gap' | 'career-path' | 'peer-recommendation' | 'trending';
  explanation: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  courses: string[]; // course IDs in order
  estimatedDuration: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
}

export interface SkillAssessment {
  skillId: string;
  skillName: string;
  currentLevel: number; // 0-100
  targetLevel: number;
  gapAnalysis: string[];
  recommendedCourses: string[];
}

// Admin Analytics
export interface CourseAnalytics {
  courseId: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completionRate: number;
  averageRating: number;
  averageCompletionTime: number;
  dropoffPoints: DropoffPoint[];
  engagementMetrics: EngagementMetrics;
  revenueMetrics?: RevenueMetrics;
}

export interface DropoffPoint {
  lessonId: string;
  lessonTitle: string;
  dropoffRate: number;
  commonExitTime: number; // for video lessons
}

export interface EngagementMetrics {
  averageSessionDuration: number;
  videosWatched: number;
  quizzesCompleted: number;
  notesCreated: number;
  bookmarksCreated: number;
  discussionPosts: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  averageRevenuePerUser: number;
  conversionRate: number;
}

// UI Component Props Types
export interface CoursePlayerProps {
  course: Course;
  progress: LearnerProgress;
  onProgressUpdate: (progress: Partial<LearnerProgress>) => void;
  onBookmark: (bookmark: Bookmark) => void;
  onNote: (note: Note) => void;
}

export interface CourseBuilderProps {
  course?: Course;
  onSave: (course: Course) => Promise<void>;
  onPublish: (courseId: string) => Promise<void>;
}

export interface VideoPlayerProps {
  videoUrl: string;
  transcript?: string;
  captions?: Caption[];
  onTimeUpdate: (currentTime: number) => void;
  onComplete: () => void;
  startTime?: number;
  autoPlay?: boolean;
}

export interface QuizComponentProps {
  questions: QuizQuestion[];
  onComplete: (attempt: QuizAttempt) => void;
  maxAttempts?: number;
  currentAttempt?: number;
  timeLimit?: number;
}

export interface ProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  animated?: boolean;
  color?: string;
  height?: number;
}

// Alias types for backward compatibility with existing interfaces
export type UserNote = Note;
export type UserBookmark = Bookmark;
