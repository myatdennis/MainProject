import { request } from './http';

export interface LeadershipHealthRecord {
  organizationId: string;
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
  organization_id: string;
  // Add canonical field for frontend use
  organizationId?: string;
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

export const fetchHealth = async (organizationId?: string): Promise<LeadershipHealthRecord[]> => {
  const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  const json = await request<ApiListResponse<LeadershipHealthRecord>>(`${basePath}/health${query}`);
  // Map org_id to organizationId for frontend consistency
  return (json.data ?? []).map((rec: any) => ({ ...rec, organizationId: rec.organization_id ?? rec.orgId ?? rec.organizationId }));
};

export const fetchRecommendations = async (organizationId: string): Promise<LeadershipRecommendation[]> => {
  if (!organizationId) return [];
  const json = await request<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${organizationId}/recommendations`);
  // Map org_id to organizationId for frontend consistency
  return (json.data ?? []).map((rec: any) => ({ ...rec, organizationId: rec.organization_id ?? rec.orgId ?? rec.organizationId }));
};

export const generateRecommendations = async (
  organizationId: string,
  payload?: { limit?: number; instructions?: string },
): Promise<ApiListResponse<LeadershipRecommendation>> => {
  const json = await request<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${organizationId}/recommendations`, {
    method: 'POST',
    body: payload ?? {},
  });
  // Map org_id to organizationId for frontend consistency
  if (json.data) {
    json.data = json.data.map((rec: any) => ({ ...rec, organizationId: rec.organization_id ?? rec.orgId ?? rec.organizationId }));
  }
  return json;
};

export const updateRecommendation = async (
  recommendationId: string,
  patch: Partial<{ status: LeadershipRecommendationStatus; resolutionNotes: string }>,
): Promise<LeadershipRecommendation> => {
  const json = await request<{ data: LeadershipRecommendation }>(`${basePath}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    body: patch,
  });
  // Map org_id to organizationId for frontend consistency
  return { ...json.data, organizationId: (json.data as any).organization_id ?? (json.data as any).orgId ?? (json.data as any).organizationId };
};

export default {
  fetchHealth,
  fetchRecommendations,
  generateRecommendations,
  updateRecommendation,
};
