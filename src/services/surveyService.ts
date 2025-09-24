import { supabase } from '../lib/supabase';
import type { Survey } from '../types/survey';

export interface SurveyAssignment {
  id?: string;
  survey_id: string;
  organization_ids: string[];
  user_ids?: string[];
  department_ids?: string[];
  cohort_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SurveyDistribution {
  id: string;
  survey_id: string;
  assignment_id: string;
  recipient_type: 'organization' | 'user' | 'department' | 'cohort';
  recipient_id: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'completed';
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
  completed_at?: string;
  reminder_count: number;
  last_reminder_sent?: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyCompletionStatus {
  survey_id: string;
  total_invites: number;
  total_responses: number;
  completion_rate: number;
  by_organization: { [orgId: string]: { invited: number; completed: number; rate: number } };
  by_department: { [deptId: string]: { invited: number; completed: number; rate: number } };
  by_user_type: { [userType: string]: { invited: number; completed: number; rate: number } };
}

export const getAssignments = async (surveyId: string): Promise<SurveyAssignment | null> => {
  try {
    const { data, error } = await supabase.from('survey_assignments').select('*').eq('survey_id', surveyId).limit(1).single();
    if (error) {
      console.warn('getAssignments supabase error:', error.message || error);
      return null;
    }
    return data as SurveyAssignment;
  } catch (err) {
    console.warn('getAssignments exception:', err);
    return null;
  }
};

export const saveAssignments = async (
  surveyId: string, 
  assignments: {
    organizationIds?: string[];
    userIds?: string[];
    departmentIds?: string[];
    cohortIds?: string[];
  }
) => {
  try {
    const payload = {
      survey_id: surveyId,
      organization_ids: assignments.organizationIds || [],
      user_ids: assignments.userIds || [],
      department_ids: assignments.departmentIds || [],
      cohort_ids: assignments.cohortIds || [],
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('survey_assignments').upsert(payload).select();
    if (error) {
      console.warn('saveAssignments supabase error:', error.message || error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('saveAssignments exception:', err);
    return null;
  }
};

// Distribution tracking functions
export const createDistribution = async (distribution: Omit<SurveyDistribution, 'id' | 'created_at' | 'updated_at'>) => {
  try {
    const { data, error } = await supabase.from('survey_distributions').insert({
      ...distribution,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select();
    
    if (error) {
      console.warn('createDistribution supabase error:', error.message || error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('createDistribution exception:', err);
    return null;
  }
};

export const updateDistributionStatus = async (distributionId: string, status: SurveyDistribution['status'], timestamp?: string) => {
  try {
    const updates: any = { 
      status,
      updated_at: new Date().toISOString() 
    };
    
    // Update specific timestamp based on status
    switch (status) {
      case 'sent':
        updates.sent_at = timestamp || new Date().toISOString();
        break;
      case 'opened':
        updates.opened_at = timestamp || new Date().toISOString();
        break;
      case 'clicked':
        updates.clicked_at = timestamp || new Date().toISOString();
        break;
      case 'completed':
        updates.completed_at = timestamp || new Date().toISOString();
        break;
    }
    
    const { data, error } = await supabase
      .from('survey_distributions')
      .update(updates)
      .eq('id', distributionId)
      .select();
      
    if (error) {
      console.warn('updateDistributionStatus supabase error:', error.message || error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('updateDistributionStatus exception:', err);
    return null;
  }
};

export const getDistributionTracking = async (surveyId: string) => {
  try {
    const { data, error } = await supabase
      .from('survey_distributions')
      .select('*')
      .eq('survey_id', surveyId);
      
    if (error) {
      console.warn('getDistributionTracking supabase error:', error.message || error);
      return [];
    }
    return data as SurveyDistribution[];
  } catch (err) {
    console.warn('getDistributionTracking exception:', err);
    return [];
  }
};

// Completion rate monitoring
export const getCompletionStatus = async (surveyId: string): Promise<SurveyCompletionStatus | null> => {
  try {
    // For now, return mock data. In production, this would aggregate real data
    return {
      survey_id: surveyId,
      total_invites: 150,
      total_responses: 87,
      completion_rate: 58,
      by_organization: {
        '1': { invited: 50, completed: 32, rate: 64 },
        '2': { invited: 45, completed: 28, rate: 62 },
        '3': { invited: 55, completed: 27, rate: 49 }
      },
      by_department: {
        'engineering': { invited: 40, completed: 28, rate: 70 },
        'marketing': { invited: 35, completed: 22, rate: 63 },
        'hr': { invited: 25, completed: 15, rate: 60 },
        'sales': { invited: 50, completed: 22, rate: 44 }
      },
      by_user_type: {
        'manager': { invited: 30, completed: 24, rate: 80 },
        'individual_contributor': { invited: 90, completed: 48, rate: 53 },
        'executive': { invited: 10, completed: 9, rate: 90 },
        'intern': { invited: 20, completed: 6, rate: 30 }
      }
    };
  } catch (err) {
    console.warn('getCompletionStatus exception:', err);
    return null;
  }
};

// Automated reminder system
export interface ReminderTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger_days: number[];
  escalation_rules?: {
    max_reminders: number;
    escalate_to?: string[];
    escalation_subject?: string;
    escalation_body?: string;
  };
}

export const sendReminder = async (distributionId: string, reminderTemplate: ReminderTemplate) => {
  try {
    // Update reminder count in distribution
    const { data: distribution, error: fetchError } = await supabase
      .from('survey_distributions')
      .select('reminder_count')
      .eq('id', distributionId)
      .single();
      
    if (fetchError) {
      console.warn('sendReminder fetch error:', fetchError.message || fetchError);
      return null;
    }

    const newReminderCount = (distribution.reminder_count || 0) + 1;
    
    const { data, error } = await supabase
      .from('survey_distributions')
      .update({
        reminder_count: newReminderCount,
        last_reminder_sent: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', distributionId)
      .select();
      
    if (error) {
      console.warn('sendReminder supabase error:', error.message || error);
      return null;
    }
    
    // In production, this would trigger actual email sending
    console.log(`Reminder sent for distribution ${distributionId}, count: ${newReminderCount}`);
    return data;
  } catch (err) {
    console.warn('sendReminder exception:', err);
    return null;
  }
};

export const scheduleReminders = async (surveyId: string, reminderSchedule: number[]) => {
  try {
    // Get all pending distributions for this survey
    const distributions = await getDistributionTracking(surveyId);
    const pendingDistributions = distributions.filter(d => 
      d.status === 'sent' || d.status === 'opened'
    );
    
    const now = new Date();
    const scheduledReminders = [];
    
    for (const distribution of pendingDistributions) {
      const sentDate = new Date(distribution.sent_at || distribution.created_at);
      const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if any reminder schedule matches
      if (reminderSchedule.includes(daysSinceSent) && 
          (distribution.reminder_count || 0) < reminderSchedule.length) {
        scheduledReminders.push(distribution.id);
      }
    }
    
    return scheduledReminders;
  } catch (err) {
    console.warn('scheduleReminders exception:', err);
    return [];
  }
};

export const getAnalytics = async (surveyId: string) => {
  // If supabase is configured, you would query response tables and aggregate.
  // For now, return a mocked analytics object.
  return {
    surveyId,
    title: 'Mock Survey Analytics',
    totalResponses: 180,
    completionRate: 78,
    avgCompletionTime: 13,
    questionSummaries: [
      { questionId: 'belonging-1', avgScore: 3.8 },
      { questionId: 'safety-1', avgScore: 3.6 }
    ],
    insights: [
      'Belonging scores above average in Engineering',
      'New hires report lower psychological safety'
    ]
  };
};

// Local persistence helpers for development when Supabase is not configured
export const saveSurvey = async (survey: Survey) => {
  try {
    const key = 'local_surveys';
    const raw = localStorage.getItem(key);
    const items: Survey[] = raw ? JSON.parse(raw) : [];
    const idx = items.findIndex(s => s.id === survey.id);
    if (idx >= 0) items[idx] = survey;
    else items.push(survey);
    localStorage.setItem(key, JSON.stringify(items));
    return survey;
  } catch (err) {
    console.warn('saveSurvey error:', err);
    return null;
  }
};

export const getSurveyById = async (id: string) => {
  try {
    const key = 'local_surveys';
    const raw = localStorage.getItem(key);
    const items: Survey[] = raw ? JSON.parse(raw) : [];
    return items.find(s => s.id === id) || null;
  } catch (err) {
    console.warn('getSurveyById error:', err);
    return null;
  }
};
