import apiRequest from '../utils/apiClient';
import type { Org } from './orgService';
import { mapOrgRecord } from './orgService';

export interface OrgProfileDetails {
  orgId: string;
  mission?: string | null;
  vision?: string | null;
  coreValues?: any[];
  deiPriorities?: any[];
  toneGuidelines?: string | null;
  accessibilityCommitments?: string | null;
  preferredLanguages?: string[];
  audienceSegments?: any[];
  aiContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastAiRefreshAt?: string | null;
}

export interface OrgBranding {
  orgId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  typography?: Record<string, unknown>;
  media?: any[];
}

export interface OrgContact {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role?: string | null;
  type?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OrgProfileBundle {
  organization: Org;
  profile: OrgProfileDetails;
  branding: OrgBranding;
  contacts: OrgContact[];
}

export interface OrgProfileContext {
  org: {
    id: string;
    name: string;
    type?: string | null;
    status?: string | null;
    totalLearners: number;
    activeLearners: number;
    completionRate: number;
    cohorts: string[];
    location?: {
      city?: string | null;
      state?: string | null;
      country?: string | null;
    } | null;
  };
  context: {
    mission?: string | null;
    vision?: string | null;
    coreValues?: string[];
    deiPriorities?: string[];
    toneGuidelines?: string | null;
    accessibilityCommitments?: string | null;
    preferredLanguages?: string[];
    audienceSegments?: string[];
    summary?: string;
    aiContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    lastAiRefreshAt?: string | null;
    updatedAt?: string | null;
    source?: string;
  };
  branding: OrgBranding;
  contacts: OrgContact[];
  prompts: {
    surveyQuestion: string;
    coachingTip: string;
    copyGuidelines: string;
  };
}

export interface OrgProfileFilter {
  search?: string;
  status?: string;
}

export interface OrgProfileUpdatePayload {
  profile?: Partial<OrgProfileDetails>;
  branding?: Partial<OrgBranding>;
}

export interface OrgContactInput {
  name: string;
  email: string;
  role?: string;
  type?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
}

const readField = (record: any, snakeKey: string) => {
  if (!record) return undefined;
  const camelKey = snakeKey.replace(/_([a-z])/g, (_, c) => (c ? c.toUpperCase() : ''));
  return record[snakeKey] ?? record[camelKey];
};

const mapProfileDetails = (record: any, orgId: string): OrgProfileDetails => ({
  orgId,
  mission: readField(record, 'mission') ?? null,
  vision: readField(record, 'vision') ?? null,
  coreValues: readField(record, 'core_values') ?? [],
  deiPriorities: readField(record, 'dei_priorities') ?? [],
  toneGuidelines: readField(record, 'tone_guidelines') ?? null,
  accessibilityCommitments: readField(record, 'accessibility_commitments') ?? null,
  preferredLanguages: readField(record, 'preferred_languages') ?? [],
  audienceSegments: readField(record, 'audience_segments') ?? [],
  aiContext: readField(record, 'ai_context') ?? {},
  metadata: readField(record, 'metadata') ?? {},
  lastAiRefreshAt: readField(record, 'last_ai_refresh_at') ?? null,
});

const mapBranding = (record: any, orgId: string): OrgBranding => ({
  orgId,
  logoUrl: readField(record, 'logo_url') ?? null,
  primaryColor: readField(record, 'primary_color') ?? null,
  secondaryColor: readField(record, 'secondary_color') ?? null,
  accentColor: readField(record, 'accent_color') ?? null,
  typography: readField(record, 'typography') ?? {},
  media: readField(record, 'media') ?? [],
});

const mapContact = (record: any): OrgContact => ({
  id: record.id,
  orgId: record.org_id ?? record.orgId,
  name: record.name,
  email: record.email,
  role: record.role ?? null,
  type: record.type ?? null,
  phone: record.phone ?? null,
  isPrimary: Boolean(record.is_primary ?? record.isPrimary),
  notes: record.notes ?? null,
  createdAt: record.created_at ?? record.createdAt ?? null,
  updatedAt: record.updated_at ?? record.updatedAt ?? null,
});

const mapBundle = (payload: any): OrgProfileBundle => {
  const organization = mapOrgRecord(payload.organization);
  const profile = mapProfileDetails(payload.profile, organization.id);
  const branding = mapBranding(payload.branding, organization.id);
  const contacts = Array.isArray(payload.contacts) ? payload.contacts.map(mapContact) : [];

  return {
    organization,
    profile,
    branding,
    contacts,
  };
};

const mapContextPayload = (payload: any): OrgProfileContext => ({
  org: {
    id: payload.org?.id,
    name: payload.org?.name,
    type: payload.org?.type ?? null,
    status: payload.org?.status ?? null,
    totalLearners: Number(payload.org?.totalLearners ?? payload.org?.total_learners ?? 0),
    activeLearners: Number(payload.org?.activeLearners ?? payload.org?.active_learners ?? 0),
    completionRate: Number(payload.org?.completionRate ?? payload.org?.completion_rate ?? 0),
    cohorts: Array.isArray(payload.org?.cohorts) ? payload.org.cohorts : [],
    location: payload.org?.location ?? null,
  },
  context: payload.context ?? {},
  branding: mapBranding(payload.branding ?? {}, payload.org?.id ?? ''),
  contacts: Array.isArray(payload.contacts) ? payload.contacts.map(mapContact) : [],
  prompts: {
    surveyQuestion: payload.prompts?.surveyQuestion ?? '',
    coachingTip: payload.prompts?.coachingTip ?? '',
    copyGuidelines: payload.prompts?.copyGuidelines ?? '',
  },
});

export const listOrgProfiles = async (filter?: OrgProfileFilter): Promise<OrgProfileBundle[]> => {
  const params = new URLSearchParams();
  if (filter?.search) params.set('search', filter.search);
  if (filter?.status) params.set('status', filter.status);
  const query = params.toString();
  const json = await apiRequest<{ data: any[] }>(`/api/admin/org-profiles${query ? `?${query}` : ''}`);
  return (json.data ?? []).map(mapBundle);
};

export const getOrgProfile = async (orgId: string): Promise<OrgProfileBundle> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/org-profiles/${orgId}`);
  return mapBundle(json.data);
};

export const upsertOrgProfile = async (orgId: string, payload: OrgProfileUpdatePayload): Promise<OrgProfileBundle> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/org-profiles/${orgId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapBundle(json.data);
};

export const removeOrgProfile = async (orgId: string): Promise<void> => {
  await apiRequest(`/api/admin/org-profiles/${orgId}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true,
  });
};

export const createOrgContact = async (orgId: string, input: OrgContactInput): Promise<OrgContact> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/org-profiles/${orgId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapContact(json.data);
};

export const updateOrgContact = async (
  orgId: string,
  contactId: string,
  input: Partial<OrgContactInput>,
): Promise<OrgContact> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/org-profiles/${orgId}/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return mapContact(json.data);
};

export const deleteOrgContact = async (orgId: string, contactId: string): Promise<void> => {
  await apiRequest(`/api/admin/org-profiles/${orgId}/contacts/${contactId}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true,
  });
};

export const getOrgProfileContext = async (orgId: string): Promise<OrgProfileContext> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/org-profiles/${orgId}/context`);
  return mapContextPayload(json.data);
};

export default {
  listOrgProfiles,
  getOrgProfile,
  upsertOrgProfile,
  removeOrgProfile,
  createOrgContact,
  updateOrgContact,
  deleteOrgContact,
  getOrgProfileContext,
};
