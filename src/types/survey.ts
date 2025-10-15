// Enhanced Survey Platform Types - Qualtrics-style

export type QuestionType = 
  | 'single-select'
  | 'multi-select' 
  | 'matrix-likert'
  | 'ranking'
  | 'nps'
  | 'slider'
  | 'open-ended'
  | 'file-upload'
  | 'demographics'
  | 'other-specify'
  | 'multiple-choice' 
  | 'likert-scale' 
  | 'matrix';

export type LogicType = 'skip' | 'display' | 'piping' | 'randomization' | 'quota';
export type SurveyStatus = 'draft' | 'published' | 'archived';
export type ResponseStatus = 'not-started' | 'in-progress' | 'completed';
export type AnonymityMode = 'anonymous' | 'confidential' | 'identified';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  order: number;
  
  // Multiple Choice & Demographics
  options?: string[];
  allowMultiple?: boolean;
  allowOther?: boolean;
  
  // Likert Scale
  scale?: {
    min: number;
    max: number;
    minLabel: string;
    maxLabel: string;
    midLabel?: string;
  };
  
  // Ranking
  rankingItems?: string[];
  maxRankings?: number;
  
  // Matrix
  matrixRows?: string[];
  matrixColumns?: string[];
  matrixType?: 'single' | 'multiple' | 'rating';
  
  // Conditional Logic
  conditionalLogic?: {
    showIf: {
      questionId: string;
      operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
      value: string | number;
    }[];
    logic: 'and' | 'or';
  };
  
  // Validation
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    customMessage?: string;
  };
}

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: SurveyQuestion[];
}

export interface SurveyBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  headerImage?: string;
  fontFamily: {
    heading: string;
    body: string;
    highlight: string;
  };
  customCss?: string;
}

export interface SurveySettings {
  allowAnonymous: boolean;
  allowSaveAndContinue: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  requireCompletion: boolean;
  timeLimit?: number; // in minutes
  accessControl: {
    requireLogin: boolean;
    allowedDomains?: string[];
    password?: string;
  };
  notifications: {
    sendReminders: boolean;
    reminderSchedule: number[]; // days after initial invite
    completionNotification: boolean;
  };
}

// Survey Block for organizing questions
export interface SurveyBlock {
  id: string;
  title: string;
  description?: string;
  order?: number;
  questions: SurveyQuestion[];
}

// Survey and Question Types
export interface Survey {
  id: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  version?: number;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  blocks: SurveyBlock[];
  sections: SurveySection[];
  settings: {
    anonymityMode: AnonymityMode;
    anonymityThreshold: number;
    allowMultipleResponses: boolean;
    showProgressBar: boolean;
    consentRequired: boolean;
    allowAnonymous: boolean;
    allowSaveAndContinue: boolean;
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
  };
  defaultLanguage: string;
  supportedLanguages: string[];
  completionSettings: {
    thankYouMessage: string;
    showResources: boolean;
    recommendedCourses: string[];
  };
  assignedTo?: {
    organizationIds?: string[];
    userIds?: string[];
    departmentIds?: string[];
    cohortIds?: string[];
  };
  reflectionPrompts?: string[];
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentId?: string; // null for anonymous
  organizationId: string;
  department?: string;
  demographics?: { [key: string]: any };
  
  responses: { [questionId: string]: any };
  reflections?: { [promptId: string]: string };
  
  status: 'in-progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  lastSavedAt: string;
  completionTime?: number; // in minutes
  
  // Metadata
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'climate' | 'inclusion' | 'equity' | 'belonging' | 'leadership';
  sections: Omit<SurveySection, 'id'>[];
  defaultSettings: Partial<SurveySettings>;
  tags: string[];
  previewImage?: string;
}

export interface SurveyAnalytics {
  surveyId: string;
  totalResponses: number;
  completionRate: number;
  avgCompletionTime: number;
  
  // Response Breakdown
  responsesByDemographic: { [key: string]: { [value: string]: number } };
  responsesByDepartment: { [department: string]: number };
  responsesByDate: { [date: string]: number };
  
  // Question Analytics
  questionAnalytics: {
    [questionId: string]: {
      responseCount: number;
      skipRate: number;
      avgResponseTime: number;
      responses: { [value: string]: number };
      sentiment?: 'positive' | 'neutral' | 'negative';
      sentimentScore?: number;
    };
  };
  
  // Insights
  keyInsights: string[];
  recommendations: string[];
  riskAreas: string[];
  strengths: string[];
  
  // Benchmarking
  benchmarkData?: {
    industryAverage: number;
    organizationHistory: { date: string; score: number }[];
    peerComparison: { organization: string; score: number; anonymous: boolean }[];
  };
}

export interface HuddleReport {
  id: string;
  surveyId: string;
  organizationId: string;
  generatedAt: string;
  
  executiveSummary: string;
  keyFindings: string[];
  strengthAreas: string[];
  improvementAreas: string[];
  
  discussionQuestions: string[];
  actionSteps: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    owner: string;
    timeline: string;
    resources: string[];
  }[];
  
  nextSteps: string[];
  followUpRecommendations: string[];
}

// Survey Assignment for distribution
export interface SurveyAssignment {
  id: string;
  surveyId: string;
  surveyTitle: string;
  assignedTo: string[];
  assignedOrganizations: string[];
  assignedDepartments: string[];
  startDate?: Date;
  endDate?: Date;
  reminderSchedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'bi-weekly';
    daysBeforeDeadline: number[];
  };
  accessControl: {
    requireLogin: boolean;
    allowAnonymous: boolean;
    oneTimeAccess: boolean;
  };
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  responses: {
    total: number;
    completed: number;
    inProgress: number;
  };
}