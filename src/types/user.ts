export interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
  organization_id?: string;
  organizationName?: string;
  cohort: string;
  role: string;
  enrolled: string;
  lastLogin: string;
  progress: {
    foundations: number;
    bias: number;
    empathy: number;
    conversations: number;
    planning: number;
  };
  overallProgress: number;
  status: string;
  completedModules: number;
  totalModules: number;
  feedbackSubmitted: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  organization: string;
  cohort: string;
  role: string;
}