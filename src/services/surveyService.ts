import { supabase } from '../lib/supabase';

export interface SurveyAssignment {
  id?: string;
  survey_id: string;
  organization_ids: string[];
  created_at?: string;
  updated_at?: string;
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

export const saveAssignments = async (surveyId: string, organizationIds: string[]) => {
  try {
    const payload = {
      survey_id: surveyId,
      organization_ids: organizationIds,
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

// Mock analytics; later replace with real aggregation queries
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
