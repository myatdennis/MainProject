// Client Portal Service - handles client dashboard data and survey assignments
import { supabase } from '../lib/supabase';
import type { 
  ClientDashboardData, 
  AssignedSurvey, 
  AssignedCourse, 
  AssignedFile, 
  ClientNotification,
  ClientSurveySession,
  SurveyResponse 
} from '../types/clientPortal';
import type { Survey } from '../types/survey';

// Mock current user - in real app this would come from auth context
const getCurrentUser = () => ({
  id: 'user-001',
  organizationId: 'org-001',
  email: 'client@example.com',
  name: 'Client User'
});

// Get all client dashboard data
export const getClientDashboardData = async (): Promise<ClientDashboardData> => {
  const user = getCurrentUser();
  
  try {
    // Try to get data from Supabase if configured
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      // In a real app, you would query assignments table
      // For now, return mock data mixed with any real survey assignments
    }
  } catch (error) {
    console.warn('Supabase not configured, using local mock data');
  }

  return getMockClientDashboardData(user.organizationId);
};

// Get assigned surveys for current user
export const getAssignedSurveys = async (): Promise<AssignedSurvey[]> => {
  const user = getCurrentUser();
  
  try {
    // Try to get real survey assignments from Supabase
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const { data: assignments, error } = await supabase
        .from('survey_assignments')
        .select(`
          *,
          survey:surveys(*)
        `)
        .contains('organization_ids', [user.organizationId]);

      if (error) {
        console.warn('Error fetching survey assignments:', error);
      } else if (assignments) {
        return assignments.map((assignment: any) => ({
          id: assignment.survey.id,
          title: assignment.survey.title,
          description: assignment.survey.description,
          type: assignment.survey.type,
          status: 'not-started' as const,
          assignedAt: assignment.created_at,
          dueDate: assignment.due_date,
          totalQuestions: assignment.survey.sections?.reduce((acc: number, section: any) => 
            acc + (section.questions?.length || 0), 0) || 0
        }));
      }
    }
  } catch (error) {
    console.warn('Error fetching surveys:', error);
  }

  return getMockAssignedSurveys();
};

// Save survey response
export const saveSurveyResponse = async (surveyId: string, responses: { [questionId: string]: SurveyResponse }): Promise<void> => {
  const user = getCurrentUser();
  
  try {
    // Try to save to Supabase if configured
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const { error } = await supabase
        .from('survey_responses')
        .upsert({
          survey_id: surveyId,
          user_id: user.id,
          organization_id: user.organizationId,
          responses: responses,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn('Error saving survey response:', error);
      } else {
        console.log('Survey response saved to database');
        return;
      }
    }
  } catch (error) {
    console.warn('Supabase error saving survey response:', error);
  }

  // Fallback to localStorage
  const key = `client_survey_response_${surveyId}_${user.id}`;
  localStorage.setItem(key, JSON.stringify({
    surveyId,
    userId: user.id,
    organizationId: user.organizationId,
    responses,
    updatedAt: new Date().toISOString()
  }));
};

// Get saved survey session
export const getSurveySession = async (surveyId: string): Promise<ClientSurveySession | null> => {
  const user = getCurrentUser();
  
  // Try localStorage first for development
  const key = `client_survey_session_${surveyId}_${user.id}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }

  return null;
};

// Save survey session
export const saveSurveySession = async (session: ClientSurveySession): Promise<void> => {
  const key = `client_survey_session_${session.surveyId}_${session.userId}`;
  localStorage.setItem(key, JSON.stringify(session));
};

// Mark survey as completed
export const markSurveyCompleted = async (surveyId: string): Promise<void> => {
  const user = getCurrentUser();
  
  try {
    // Try to update Supabase if configured
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const { error } = await supabase
        .from('survey_responses')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('survey_id', surveyId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Error marking survey completed:', error);
      } else {
        console.log('Survey marked as completed in database');
        return;
      }
    }
  } catch (error) {
    console.warn('Supabase error marking survey completed:', error);
  }

  // Fallback to localStorage
  const key = `client_survey_completed_${surveyId}_${user.id}`;
  localStorage.setItem(key, JSON.stringify({
    surveyId,
    userId: user.id,
    completedAt: new Date().toISOString()
  }));
};

// Mock data for development
const getMockClientDashboardData = (organizationId: string): ClientDashboardData => {
  const surveys = getMockAssignedSurveys();
  const courses = getMockAssignedCourses();
  const files = getMockAssignedFiles();
  
  return {
    notifications: [
      {
        id: 'notif-001',
        type: 'survey',
        title: 'New Survey Assigned',
        message: 'Q1 2025 Climate Assessment has been assigned to you',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        read: false,
        actionUrl: '/client/surveys/climate-assessment-q1-2025'
      },
      {
        id: 'notif-002',
        type: 'file',
        title: 'New Resource Shared',
        message: 'Leadership Assessment Template has been shared with your organization',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
        actionUrl: '/client/files'
      },
      {
        id: 'notif-003',
        type: 'course',
        title: 'Course Assignment',
        message: 'Inclusive Leadership Foundations course has been assigned',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        read: true,
        actionUrl: '/client/courses/foundations'
      }
    ],
    surveys,
    courses,
    files,
    stats: {
      totalSurveys: surveys.length,
      completedSurveys: surveys.filter(s => s.status === 'completed').length,
      totalCourses: courses.length,
      completedCourses: courses.filter(c => c.status === 'completed').length,
      totalFiles: files.length,
      downloadedFiles: files.filter(f => f.downloaded).length
    }
  };
};

const getMockAssignedSurveys = (): AssignedSurvey[] => [
  {
    id: 'climate-assessment-q1-2025',
    title: 'Q1 2025 Climate Assessment',
    description: 'Quarterly organizational climate and culture assessment',
    type: 'climate-assessment',
    status: 'not-started',
    assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    totalQuestions: 25
  },
  {
    id: 'inclusion-index-2024',
    title: 'Annual Inclusion Index',
    description: 'Comprehensive inclusion measurement with benchmarking',
    type: 'inclusion-index',
    status: 'in-progress',
    assignedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 60,
    totalQuestions: 40,
    answeredQuestions: 24
  },
  {
    id: 'leadership-assessment-q4',
    title: 'Leadership Effectiveness Assessment',
    description: 'Quarterly assessment of leadership behaviors and effectiveness',
    type: 'custom',
    status: 'completed',
    assignedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 100,
    totalQuestions: 30,
    answeredQuestions: 30
  }
];

const getMockAssignedCourses = (): AssignedCourse[] => [
  {
    id: 'foundations',
    title: 'Foundations of Inclusive Leadership',
    description: 'Build the fundamental skills needed to lead with empathy and create psychological safety for your team.',
    status: 'in-progress',
    progress: 75,
    assignedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    duration: '45 min',
    thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: 'bias-mitigation',
    title: 'Recognizing and Mitigating Bias',
    description: 'Learn to identify and address unconscious bias in decision-making and team dynamics.',
    status: 'not-started',
    progress: 0,
    assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    duration: '60 min',
    thumbnail: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=400'
  }
];

const getMockAssignedFiles = (): AssignedFile[] => [
  {
    id: 'file-001',
    name: 'Leadership Assessment Template',
    description: 'Template for conducting leadership assessments within your organization',
    type: 'PDF',
    category: 'Templates',
    url: '#',
    assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    downloaded: false
  },
  {
    id: 'file-002',
    name: 'Inclusive Hiring Checklist',
    description: 'Comprehensive checklist to ensure inclusive hiring practices',
    type: 'PDF',
    category: 'Checklists',
    url: '#',
    assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    downloaded: true,
    downloadedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'file-003',
    name: 'DEI Strategy Workbook',
    description: 'Step-by-step workbook for developing your organization\'s DEI strategy',
    type: 'PDF',
    category: 'Workbooks',
    url: '#',
    assignedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    downloaded: true,
    downloadedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export default {
  getClientDashboardData,
  getAssignedSurveys,
  saveSurveyResponse,
  getSurveySession,
  saveSurveySession,
  markSurveyCompleted
};