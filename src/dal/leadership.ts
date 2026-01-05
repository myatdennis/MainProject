import { request } from './http';

export interface LeadershipHealthRecord {
  orgId: string;
  name: string;
  activeLearners: number;
  completionRate: number;
  avgProgress: number;
  avgSurveyRating: number;
  surveyResponses: number;
  overdueAssignments: number;
  worstDropoff: number;
}

export type LeadershipRecommendationStatus = 'open' | 'planned' | 'in_progress' | 'blocked' | 'resolved' | 'dismissed';
export type LeadershipRecommendationPriority = 'low' | 'medium' | 'high';

export interface LeadershipRecommendation {
  id: string;
  org_id: string;
  title: string;
  summary: string;
  category: string;
  priority: LeadershipRecommendationPriority;
  impact?: string | null;
  status: LeadershipRecommendationStatus;
  confidence?: number | null;
  tags?: string[];
  data_points?: Record<string, any>;
  generated_by?: 'ai' | 'heuristic';
  ai_model?: string | null;
  ai_version?: string | null;
  generated_at?: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ApiListResponse<T> {
  data: T[];
  count?: number;
  message?: string;
  mode?: string;
}

const basePath = '/api/admin/analytics/leadership';

export const fetchHealth = async (orgId?: string): Promise<LeadershipHealthRecord[]> => {
  const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
  const json = await request<ApiListResponse<LeadershipHealthRecord>>(`${basePath}/health${query}`);
  return json.data ?? [];
};

export const fetchRecommendations = async (orgId: string): Promise<LeadershipRecommendation[]> => {
  if (!orgId) return [];
  const json = await request<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${orgId}/recommendations`);
  return json.data ?? [];
};

export const generateRecommendations = async (
  orgId: string,
  payload?: { limit?: number; instructions?: string },
): Promise<ApiListResponse<LeadershipRecommendation>> => {
  const json = await request<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${orgId}/recommendations`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
  return json;
};

export const updateRecommendation = async (
  recommendationId: string,
  patch: Partial<{ status: LeadershipRecommendationStatus; resolutionNotes: string }>,
): Promise<LeadershipRecommendation> => {
  const json = await request<{ data: LeadershipRecommendation }>(`${basePath}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return json.data;
};

export default {
  fetchHealth,
  fetchRecommendations,
  generateRecommendations,
  updateRecommendation,
};
