import apiRequest from '../utils/apiClient';

export type LearnerReflection = {
  id: string;
  organizationId: string;
  courseId: string;
  lessonId: string;
  userId: string;
  responseText: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminReflectionRow = LearnerReflection & {
  learnerEmail?: string | null;
  learnerName?: string | null;
};

export const reflectionService = {
  async fetchLearnerReflection(courseId: string, lessonId: string): Promise<LearnerReflection | null> {
    const params = new URLSearchParams({ courseId, lessonId });
    const response = await apiRequest<{ data?: LearnerReflection | null }>(`/api/learner/reflections?${params.toString()}`);
    return response?.data ?? null;
  },

  async saveLearnerReflection(payload: {
    courseId: string;
    lessonId: string;
    responseText: string;
  }): Promise<LearnerReflection | null> {
    const response = await apiRequest<{ data?: LearnerReflection | null }>('/api/learner/reflections', {
      method: 'POST',
      body: payload,
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
      `/api/admin/reflections?${query.toString()}`,
    );

    return {
      rows: response?.data?.rows ?? [],
      total: response?.data?.total ?? 0,
    };
  },
};
