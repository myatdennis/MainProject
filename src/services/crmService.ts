import apiRequest, { safeApiRequest } from '../utils/apiClient';

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
  if (import.meta.env.DEV) {
    console.info('[crmService] request_dispatch', {
      route: '/api/admin/crm/summary',
    });
  }
  const response = await safeApiRequest<{ data: CrmSummary }>('/api/admin/crm/summary');
  if (import.meta.env.DEV) {
    console.info('[crmService] response_received', {
      route: '/api/admin/crm/summary',
      envelopeKeys: Object.keys(response ?? {}),
      disabled: Boolean(response?.data?.disabled),
    });
  }
  return response?.data ?? null;
};

export const getCrmActivity = async () => {
  const response = await safeApiRequest<{ data: CrmActivity }>('/api/admin/crm/activity');
  return response?.data ?? null;
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
