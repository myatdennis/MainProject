import apiRequest from '../utils/apiClient';
import { buildOrgHeaders } from '../utils/orgHeaders';

export type OrgGrowthMetrics = {
  org_id: string;
  avg_learning_streak: number;
  avg_reflection_streak: number;
  completion_rate: number; // 0..1
  engagement_score: number; // ~0..3
  updated_at?: string;
};

export type GrowthInsightPayload = {
  message: string;
  strengths: string[];
  opportunities: string[];
};

export type GrowthAchievement = {
  achievement_type: string;
  achieved_at: string;
  metadata?: Record<string, unknown>;
};

export type GrowthProfileRow = {
  user_id: string;
  org_id?: string | null;
  level: number;
  growth_xp: number;
  lesson_completion_count: number;
  course_completion_count: number;
  scenario_completion_count: number;
  reflection_submission_count: number;
  learning_streak_count: number;
  reflection_streak_count: number;
  learning_grace_days_remaining: number;
  reflection_grace_days_remaining: number;
  last_learning_date?: string | null;
  last_reflection_date?: string | null;
  last_active_date?: string | null;
  scenario_score_samples?: number;
  avg_empathy?: number;
  avg_inclusion?: number;
  avg_effectiveness?: number;
};

export type GrowthProfileResponse = {
  profile: GrowthProfileRow;
  level: number;
  progressToNextLevel: number; // 0..1
  streaks: {
    learning: number;
    reflection: number;
    learningGraceDaysRemaining: number;
    reflectionGraceDaysRemaining: number;
  };
  achievements: GrowthAchievement[];
  insights: GrowthInsightPayload;
};

export async function fetchGrowthProfile(): Promise<GrowthProfileResponse | null> {
  try {
    const res = await apiRequest<{ data: GrowthProfileResponse }>('/api/client/growth', {
      credentials: 'include',
      headers: buildOrgHeaders(),
    });
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchOrgGrowthMetrics(): Promise<OrgGrowthMetrics | null> {
  const res = await apiRequest<{ data: OrgGrowthMetrics }>('/api/client/growth/org', {
    credentials: 'include',
    headers: buildOrgHeaders(),
  });
  return res?.data ?? null;
}
