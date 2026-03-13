import apiRequest from '../utils/apiClient';

export type CrmSummary = {
  organizations: {
    total: number;
    active: number;
    onboarding: number;
    newThisMonth: number;
  };
  users: {
    total: number;
    active: number;
    invited: number;
    recentActive: number;
  };
  assignments: {
    coursesLast30d: number;
    surveysLast30d: number;
    overdue: number;
  };
  communication: {
    messagesLast30d: number;
    notificationsLast30d: number;
    unreadNotifications: number;
  };
  invites: {
    pending: number;
    accepted: number;
    expired: number;
  };
  disabled?: boolean;
};

export type CrmActivity = {
  organizations: Array<{
    id: string;
    name: string;
    status?: string | null;
    createdAt?: string | null;
    contactEmail?: string | null;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role?: string | null;
    status?: string | null;
    lastLoginAt?: string | null;
    createdAt?: string | null;
  }>;
  messages: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  disabled?: boolean;
};

export type BroadcastAudience = 'custom' | 'all_active_orgs' | 'all_active_users';

export type BroadcastPayload = {
  title: string;
  message: string;
  channel?: 'in_app' | 'email' | 'both';
  priority?: 'low' | 'normal' | 'high';
  audience?: BroadcastAudience;
  organizationIds?: string[];
  userIds?: string[];
  allOrganizations?: boolean;
  allUsers?: boolean;
  metadata?: Record<string, unknown>;
};

export const getCrmSummary = async () => {
  const response = await apiRequest<{ data: CrmSummary }>('/api/admin/crm/summary');
  return response.data;
};

export const getCrmActivity = async () => {
  const response = await apiRequest<{ data: CrmActivity }>('/api/admin/crm/activity');
  return response.data;
};

export const sendBroadcastNotification = async (payload: BroadcastPayload) => {
  return apiRequest<{ data: unknown }>(`/api/admin/notifications/broadcast`, {
    method: 'POST',
    body: payload,
  });
};

export default {
  getCrmSummary,
  getCrmActivity,
  sendBroadcastNotification,
};
