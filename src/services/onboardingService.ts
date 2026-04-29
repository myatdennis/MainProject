import apiRequest from '../utils/apiClient';
import buildSessionAuditHeaders from '../utils/sessionAuditHeaders';
import { getUserSession } from '../lib/secureStorage';

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
    body: payload,
  });
};

export const listOnboardingInvites = async (orgId: string | null) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (listOnboardingInvites)');
    return { data: [] } as any;
  }

  return apiRequest<{ data: any[] }>(`/api/admin/onboarding/${orgId ?? ''}/invites`);
};

export const createOnboardingInvite = async (orgId: string | null, payload: InviteInput & { sendEmail?: boolean }) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (createOnboardingInvite)');
    throw new Error('Organization context is required');
  }

  return apiRequest<{ data: any; duplicate?: boolean }>(`/api/admin/onboarding/${orgId ?? ''}/invites`, {
    method: 'POST',
    body: payload,
  });
};

export const bulkOnboardingInvites = async (orgId: string | null, invites: InviteInput[]) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (bulkOnboardingInvites)');
    return { results: [] } as any;
  }

  return apiRequest<{ results: Array<Record<string, any>> }>(`/api/admin/onboarding/${orgId ?? ''}/invites/bulk`, {
    method: 'POST',
    body: { invites },
  });
};

export const resendOnboardingInvite = async (orgId: string | null, inviteId: string) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (resendOnboardingInvite)');
    return { data: null } as any;
  }

  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId ?? ''}/invites/${inviteId}/resend`, {
    method: 'POST',
  });
};

export const revokeOnboardingInvite = async (orgId: string | null, inviteId: string) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (revokeOnboardingInvite)');
    return { data: null } as any;
  }

  return apiRequest(`/api/admin/onboarding/${orgId ?? ''}/invites/${inviteId}`, {
    method: 'DELETE',
    expectedStatus: [200, 202, 204],
    rawResponse: true,
  });
};

export const getOnboardingProgress = async (orgId: string | null) => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (getOnboardingProgress)');
    return { data: null } as any;
  }

  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId ?? ''}/progress`, {
    headers: buildSessionAuditHeaders(),
  });
};

export const updateOnboardingStep = async (orgId: string | null, step: string, status: 'pending' | 'in_progress' | 'completed' | 'blocked') => {
  const session = getUserSession();
  const isPlatformAdmin = Boolean(session && (session.isPlatformAdmin || String(session.platformRole || '').toLowerCase() === 'platform_admin'));
  if (!orgId && !isPlatformAdmin) {
    console.warn('Skipping API call — no org selected (updateOnboardingStep)');
    throw new Error('Organization context is required');
  }

  return apiRequest<{ data: any }>(`/api/admin/onboarding/${orgId ?? ''}/steps/${step}`, {
    method: 'PATCH',
    body: { status },
  });
};
