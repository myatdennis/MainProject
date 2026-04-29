import apiRequest from '../utils/apiClient';
import { buildScopedApiUrl } from '../lib/orgContext';
import { getUserSession } from '../lib/secureStorage';

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

export const leadershipService = {
  async fetchHealth(orgId?: string): Promise<LeadershipHealthRecord[]> {
    const url = buildScopedApiUrl(`${basePath}/health`, orgId);
    const session = getUserSession();
    const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
    if (!orgId && !isPlatformAdmin) {
      console.warn('Skipping API call — no org selected (leadershipService.fetchHealth)');
      return [];
    }

    const json = await apiRequest<ApiListResponse<LeadershipHealthRecord>>(url);
    return json.data ?? [];
  },

  async fetchRecommendations(orgId?: string | null): Promise<LeadershipRecommendation[]> {
    const session = getUserSession();
    const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
    if (!orgId && !isPlatformAdmin) {
      console.warn('Skipping API call — no org selected (leadershipService.fetchRecommendations)');
      return [];
    }

    const json = await apiRequest<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${orgId ?? ''}/recommendations`);
    return json.data ?? [];
  },

  async generateRecommendations(orgId: string, payload?: { limit?: number; instructions?: string }) {
    const session = getUserSession();
    const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
    if (!orgId && !isPlatformAdmin) {
      console.warn('Skipping API call — no org selected (leadershipService.generateRecommendations)');
      throw new Error('Organization context is required');
    }

    const json = await apiRequest<ApiListResponse<LeadershipRecommendation>>(`${basePath}/${orgId}/recommendations`, {
      method: 'POST',
      body: payload ?? {},
    });
    return json;
  },

  async updateRecommendation(recommendationId: string, patch: Partial<{ status: LeadershipRecommendationStatus; resolutionNotes: string }>) {
    if (!recommendationId) throw new Error('recommendationId required');
    const json = await apiRequest<{ data: LeadershipRecommendation }>(`${basePath}/recommendations/${recommendationId}`, {
      method: 'PATCH',
      body: patch,
    });
    return json.data;
  },
};

export default leadershipService;
