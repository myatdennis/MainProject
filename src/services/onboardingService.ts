import apiRequest from '../utils/apiClient';

export interface OwnerInput {
  userId?: string;
  email?: string;
  role?: string;
}

export type BackupAdminInput = OwnerInput;

export interface InviteInput {
  email: string;
  role?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
}

export interface OnboardingOrgPayload {
  name: string;
  type?: string;
  contactPerson: string;
  contactEmail: string;
  subscription?: string;
  timezone?: string;
  owner: OwnerInput;
  backupAdmin?: BackupAdminInput;
  invites?: InviteInput[];
  tags?: string[];
  settings?: Record<string, any>;
  features?: Record<string, any>;
}

export interface OnboardingOrgResponse {
  data: any;
  invites: Array<{ email: string; id?: string; role?: string; error?: string; duplicate?: boolean }>;
  progress?: any;
}

export const createOnboardingOrg = async (payload: OnboardingOrgPayload): Promise<OnboardingOrgResponse> => {
  return apiRequest<OnboardingOrgResponse>('/api/admin/onboarding/orgs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listOnboardingInvites = async (orgId: string) => {
  return apiRequest<{ data: any[] }>(`/api/admin/onboarding/${orgId}/invites`);
};

export const createOnboardingInvite = async (orgId: string, payload: InviteInput & { sendEmail?: boolean }) => {
  return apiRequest<{ data: any; duplicate?: boolean }>(`/api/admin/onboarding/${orgId}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const bulkOnboardingInvites = async (orgId: string, invites: InviteInput[]) => {
  return apiRequest<{ results: Array<Record<string, any>> }>(`/api/admin/onboarding/${orgId}/invites/bulk`, {
    method: 'POST',
    body: JSON.stringify({ invites }),
  });
};

export const resendOnboardingInvite = async (orgId: string, inviteId: string) => {
  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId}/invites/${inviteId}/resend`, {
    method: 'POST',
  });
};

export const revokeOnboardingInvite = async (orgId: string, inviteId: string) => {
  return apiRequest(`/api/admin/onboarding/${orgId}/invites/${inviteId}`, {
    method: 'DELETE',
    expectedStatus: [200, 202, 204],
    rawResponse: true,
  });
};

export const getOnboardingProgress = async (orgId: string) => {
  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId}/progress`);
};

export const updateOnboardingStep = async (orgId: string, step: string, status: 'pending' | 'in_progress' | 'completed' | 'blocked') => {
  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId}/steps/${step}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};
