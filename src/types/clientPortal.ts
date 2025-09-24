// Client Portal Types

export interface ClientNotification {
  id: string;
  type: 'survey' | 'course' | 'file';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
}

export interface AssignedSurvey {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'not-started' | 'in-progress' | 'completed';
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  progress?: number;
  totalQuestions?: number;
  answeredQuestions?: number;
}

export interface AssignedCourse {
  id: string;
  title: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  duration: string;
  thumbnail?: string;
}

export interface AssignedFile {
  id: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  url: string;
  assignedAt: string;
  downloaded: boolean;
  downloadedAt?: string;
}

export interface ClientDashboardData {
  notifications: ClientNotification[];
  surveys: AssignedSurvey[];
  courses: AssignedCourse[];
  files: AssignedFile[];
  stats: {
    totalSurveys: number;
    completedSurveys: number;
    totalCourses: number;
    completedCourses: number;
    totalFiles: number;
    downloadedFiles: number;
  };
}

export interface SurveyResponse {
  questionId: string;
  answer: any;
  answeredAt: string;
}

export interface ClientSurveySession {
  surveyId: string;
  userId: string;
  organizationId: string;
  responses: { [questionId: string]: SurveyResponse };
  status: 'not-started' | 'in-progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  lastSavedAt?: string;
  currentSectionIndex?: number;
  currentQuestionIndex?: number;
}