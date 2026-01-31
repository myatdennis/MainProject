import apiRequest from '../utils/apiClient';

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

const getInvite = async (token: string) => {
  return apiRequest<{ data: InvitePreview }>(`/api/invite/${token}`);
};

const acceptInvite = async (token: string, payload: AcceptInvitePayload) => {
  return apiRequest<{ data: AcceptInviteResponse }>(`/api/invite/${token}/accept`, {
    method: 'POST',
    body: payload,
  });
};

export default {
  getInvite,
  acceptInvite,
};
