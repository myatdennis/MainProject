import apiRequest from '../utils/apiClient';

export type AssignmentPreviewItem = {
  id: string;
  title: string | null;
  dueAt?: string | null;
  status?: string | null;
};

export type InvitePreview = {
  id: string;
  orgId: string;
  orgName: string | null;
  orgSlug?: string | null;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedName?: string | null;
  inviterEmail?: string | null;
  reminderCount?: number;
  lastSentAt?: string | null;
  acceptedAt?: string | null;
  requiresAccount: boolean;
  passwordPolicy?: {
    minLength?: number;
  };
  loginUrl?: string;
  contactEmail?: string | null;
  assignmentPreview?: {
    courses?: AssignmentPreviewItem[];
    surveys?: AssignmentPreviewItem[];
  } | null;
};

export type AcceptInvitePayload = {
  fullName?: string;
  password: string;
};

export type AcceptInviteResponse = {
  status: string;
  orgId: string;
  orgName: string | null;
  email: string;
  loginUrl: string;
};

const unwrapApiData = <T,>(payload: T | { data?: T } | null | undefined): T | null => {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? null) as T | null;
  }
  return (payload ?? null) as T | null;
};

const getInvite = async (token: string) => {
  const payload = await apiRequest<InvitePreview | { data?: InvitePreview }>(`/api/invite/${token}`);
  return unwrapApiData(payload);
};

const acceptInvite = async (token: string, payload: AcceptInvitePayload) => {
  const response = await apiRequest<AcceptInviteResponse | { data?: AcceptInviteResponse }>(`/api/invite/${token}/accept`, {
    method: 'POST',
    body: payload,
  });
  return unwrapApiData(response);
};

export default {
  getInvite,
  acceptInvite,
};
