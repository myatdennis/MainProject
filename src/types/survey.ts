// Survey Platform Types

export interface SurveyQuestion {
  id: string;
  type: 'multiple-choice' | 'likert-scale' | 'ranking' | 'open-ended' | 'matrix' | 'demographics';
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

export interface Survey {
  id: string;
  title: string;
  description: string;
  type: 'climate-assessment' | 'inclusion-index' | 'equity-lens' | 'custom';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  launchedAt?: string;
  closedAt?: string;
  
  sections: SurveySection[];
  branding: SurveyBranding;
  settings: SurveySettings;
  
  // Assignment & Distribution
  assignedTo: {
    organizationIds: string[];
    userIds: string[];
    cohortIds: string[];
    departments?: string[];
  };
  
  // Analytics
  totalInvites: number;
  totalResponses: number;
  completionRate: number;
  avgCompletionTime: number; // in minutes
  
  // Reflection & Follow-up
  reflectionPrompts: string[];
  followUpSurveys?: string[]; // IDs of related surveys
  
  // Huddle Co. Features
  generateHuddleReport: boolean;
  actionStepsEnabled: boolean;
  benchmarkingEnabled: boolean;
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