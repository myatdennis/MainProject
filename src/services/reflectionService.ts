import apiRequest from '../utils/apiClient';
import type { ReflectionResponseData } from '../utils/reflectionFlow';
import { buildOrgHeaders } from '../utils/orgHeaders';

export type LearnerReflection = {
  id: string;
  organizationId: string;
  courseId: string;
  moduleId?: string | null;
  lessonId: string;
  userId: string;
  responseText: string;
  responseData?: ReflectionResponseData | null;
  status?: 'draft' | 'submitted' | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminReflectionRow = LearnerReflection & {
  learnerEmail?: string | null;
  learnerName?: string | null;
  lessonTitle?: string | null;
  moduleTitle?: string | null;
};

export const reflectionService = {
  async fetchLearnerReflection(courseId: string, lessonId: string): Promise<LearnerReflection | null> {
    const params = new URLSearchParams({ courseId });
    const response = await apiRequest<{ data?: LearnerReflection | null }>(
      `/api/learner/lessons/${encodeURIComponent(lessonId)}/reflection?${params.toString()}`,
      { headers: buildOrgHeaders() },
    );
    return response?.data ?? null;
  },

  async saveLearnerReflection(payload: {
    courseId: string;
    lessonId: string;
    responseText: string;
    responseData?: ReflectionResponseData;
    status?: 'draft' | 'submitted';
  }): Promise<LearnerReflection | null> {
    const response = await apiRequest<{ data?: LearnerReflection | null }>(
      `/api/learner/lessons/${encodeURIComponent(payload.lessonId)}/reflection`,
      {
      method: 'POST',
      body: payload,
      headers: buildOrgHeaders(),
    });
    return response?.data ?? null;
  },

  async fetchAdminReflections(params: {
    orgId: string;
    courseId: string;
    lessonId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: AdminReflectionRow[]; total: number }> {
    const query = new URLSearchParams({
      orgId: params.orgId,
      courseId: params.courseId,
      lessonId: params.lessonId,
      limit: String(params.limit ?? 20),
      offset: String(params.offset ?? 0),
    });

    const response = await apiRequest<{ data?: { rows?: AdminReflectionRow[]; total?: number } }>(
      `/api/admin/lessons/${encodeURIComponent(params.lessonId)}/reflections?${query.toString()}`,
    );

    return {
      rows: response?.data?.rows ?? [],
      total: response?.data?.total ?? 0,
    };
  },

  async fetchAdminCourseReflections(params: {
    orgId: string;
    courseId: string;
    lessonId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: AdminReflectionRow[]; total: number }> {
    const query = new URLSearchParams({
      orgId: params.orgId,
      ...(params.lessonId ? { lessonId: params.lessonId } : {}),
      ...(params.search ? { search: params.search } : {}),
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    });

    const response = await apiRequest<{ data?: { rows?: AdminReflectionRow[]; total?: number } }>(
      `/api/admin/courses/${encodeURIComponent(params.courseId)}/reflections?${query.toString()}`,
    );

    return {
      rows: response?.data?.rows ?? [],
      total: response?.data?.total ?? 0,
    };
  },
};
