export type Org = {
  id: string;
  name: string;
  slug?: string;
  type: string;
  description?: string;
  logo?: string;
  
  // Contact Information
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  
  // Address Information
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Subscription & Billing
  subscription: string;
  billingEmail?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'annually';
  customPricing?: number;
  
  // Capacity & Limits
  maxLearners?: number;
  maxCourses?: number;
  maxStorage?: number; // in GB
  
  // Features & Permissions
  features?: {
    analytics: boolean;
    certificates: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    sso: boolean;
    mobileApp: boolean;
    reporting: boolean;
    integrations: boolean;
  };
  
  // Settings
  settings?: {
    autoEnrollment: boolean;
    emailNotifications: boolean;
    progressTracking: boolean;
    allowDownloads: boolean;
    requireCompletion: boolean;
    dataRetention: number; // in months
  };
  
  // Status & Metadata
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  enrollmentDate?: string;
  contractStart?: string;
  contractEnd?: string;
  createdAt?: string;
  updatedAt?: string;
  timezone?: string;
  onboardingStatus?: string;
  
  // Usage Statistics
  totalLearners: number;
  activeLearners: number;
  completionRate: number;
  cohorts: string[];
  lastActivity?: string;
  modules: Record<string, number>;
  
  // Additional Data
  notes?: string;
  tags?: string[];
};

export type OrgMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  invitedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

import apiRequest, { ApiError } from '../utils/apiClient';
import { resolveApiUrl } from '../config/apiBase';

const fromRecord = <T = any>(record: any, key: string): T | undefined => {
  if (!record) return undefined;
  const camelKey = key.replace(/_([a-z])/g, (_, c) => (c ? c.toUpperCase() : ''));
  return record[key] ?? record[camelKey];
};

export const mapOrgRecord = (record: any): Org => {
  const features = fromRecord(record, 'features') as Org['features'] | undefined;
  const settings = fromRecord(record, 'settings') as Org['settings'] | undefined;

  return {
  id: record.id,
  name: record.name,
  slug: fromRecord(record, 'slug') ?? undefined,
  type: record.type,
  description: fromRecord(record, 'description') ?? undefined,
  logo: fromRecord(record, 'logo') ?? undefined,
  contactPerson: fromRecord(record, 'contact_person') ?? '',
  contactEmail: fromRecord(record, 'contact_email') ?? '',
  contactPhone: fromRecord(record, 'contact_phone') ?? undefined,
  website: fromRecord(record, 'website') ?? undefined,
  address: fromRecord(record, 'address') ?? undefined,
  city: fromRecord(record, 'city') ?? undefined,
  state: fromRecord(record, 'state') ?? undefined,
  country: fromRecord(record, 'country') ?? undefined,
  postalCode: fromRecord(record, 'postal_code') ?? undefined,
  subscription: fromRecord(record, 'subscription') ?? 'standard',
  billingEmail: fromRecord(record, 'billing_email') ?? undefined,
  billingCycle: fromRecord(record, 'billing_cycle') ?? undefined,
  customPricing: fromRecord(record, 'custom_pricing') ?? undefined,
  maxLearners: fromRecord(record, 'max_learners') ?? undefined,
  maxCourses: fromRecord(record, 'max_courses') ?? undefined,
  maxStorage: fromRecord(record, 'max_storage') ?? undefined,
  features: features ?? undefined,
  settings: settings ?? undefined,
  status: fromRecord(record, 'status') ?? 'active',
  enrollmentDate: fromRecord(record, 'enrollment_date') ?? undefined,
  contractStart: fromRecord(record, 'contract_start') ?? undefined,
  contractEnd: fromRecord(record, 'contract_end') ?? undefined,
  createdAt: fromRecord(record, 'created_at') ?? undefined,
  updatedAt: fromRecord(record, 'updated_at') ?? undefined,
  timezone: fromRecord(record, 'timezone') ?? undefined,
  onboardingStatus: fromRecord(record, 'onboarding_status') ?? undefined,
  totalLearners: fromRecord(record, 'total_learners') ?? 0,
  activeLearners: fromRecord(record, 'active_learners') ?? 0,
  completionRate: Number(fromRecord(record, 'completion_rate') ?? 0),
  cohorts: fromRecord(record, 'cohorts') ?? [],
  lastActivity: fromRecord(record, 'last_activity') ?? undefined,
  modules: fromRecord(record, 'modules') ?? {},
  notes: fromRecord(record, 'notes') ?? undefined,
  tags: fromRecord(record, 'tags') ?? []
};
};

const mapMemberRecord = (record: any): OrgMember => ({
  id: record.id,
  organizationId: record.organization_id ?? record.orgId ?? record.organizationId,
  userId: record.user_id ?? record.userId,
  role: record.role ?? 'member',
  invitedBy: record.invited_by ?? null,
  createdAt: record.created_at ?? new Date().toISOString(),
  updatedAt: record.updated_at ?? new Date().toISOString()
});

export type OrgListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string[];
  subscription?: string[];
  includeProgress?: boolean;
};

export type OrgListResponse = {
  data: Org[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  progress?: Record<string, any>;
};

const buildOrgQuery = (params?: OrgListParams) => {
  if (!params) return '';
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search.trim());
  if (params.status?.length) query.set('status', params.status.join(','));
  if (params.subscription?.length) query.set('subscription', params.subscription.join(','));
  if (params.includeProgress) query.set('includeProgress', 'true');
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const listOrgPage = async (params?: OrgListParams): Promise<OrgListResponse> => {
  const query = buildOrgQuery(params);
  if (import.meta.env.DEV) {
    console.info('[orgService] GET /api/admin/organizations →', resolveApiUrl(`/api/admin/organizations${query}`));
  }
  const json = await apiRequest<{ data: any[]; pagination?: any; progress?: Record<string, any> }>(
    `/api/admin/organizations${query}`
  );
  return {
    data: (json.data || []).map(mapOrgRecord),
    pagination: {
      page: json.pagination?.page ?? params?.page ?? 1,
      pageSize: json.pagination?.pageSize ?? params?.pageSize ?? (json.data?.length ?? 0),
      total: json.pagination?.total ?? json.data?.length ?? 0,
      hasMore: Boolean(json.pagination?.hasMore),
    },
    progress: json.progress ?? {},
  };
};

export const listOrgs = async (params?: OrgListParams): Promise<Org[]> => {
  const response = await listOrgPage(params);
  return response.data;
};

export const getOrg = async (id: string): Promise<Org | null> => {
  try {
    const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${id}`);
    return mapOrgRecord(json.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createOrg = async (payload: Partial<Org>): Promise<Org> => {
  const json = await apiRequest<{ data: any }>('/api/admin/organizations', {
    method: 'POST',
    body: payload
  });
  return mapOrgRecord(json.data);
};

export const updateOrg = async (id: string, patch: Partial<Org>): Promise<Org> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${id}`, {
    method: 'PUT',
    body: patch
  });
  return mapOrgRecord(json.data);
};

export const deleteOrg = async (id: string): Promise<void> => {
  await apiRequest(`/api/admin/organizations/${id}`, { method: 'DELETE' });
};

export const bulkUpdateOrgs = async (updates: Array<{ id: string; data: Partial<Org> }>): Promise<Org[]> => {
  const results: Org[] = [];
  for (const update of updates) {
    const org = await updateOrg(update.id, update.data);
    results.push(org);
  }
  return results;
};

export const getOrgStats = async (id: string): Promise<any> => {
  const org = await getOrg(id);
  if (!org) return null;

  return {
    overview: {
      totalUsers: org.totalLearners,
      activeUsers: org.activeLearners,
      completionRate: org.completionRate,
      avgSessionTime: Math.floor(Math.random() * 30) + 15
    },
    engagement: {
      dailyActiveUsers: Math.floor(org.activeLearners * 0.6),
      weeklyActiveUsers: Math.floor(org.activeLearners * 0.8),
      monthlyActiveUsers: org.activeLearners
    },
    performance: {
      coursesCompleted: Object.values(org.modules).reduce((sum, val) => sum + Math.floor(val * 0.8), 0),
      certificatesIssued: Math.floor(org.totalLearners * (org.completionRate / 100)),
      avgScores: Object.fromEntries(
        Object.keys(org.modules).map(key => [key, Math.floor(Math.random() * 30) + 70])
      )
    },
    trends: {
      userGrowth: Array.from({ length: 12 }, (_, i) => ({
        month: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        users: Math.floor(Math.random() * 10) + org.totalLearners * 0.8
      })),
      completionTrends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        completions: Math.floor(Math.random() * 5) + 2
      }))
    }
  };
};

export const listOrgMembers = async (organizationId: string): Promise<OrgMember[]> => {
  const json = await apiRequest<{ data: any[] }>(`/api/admin/organizations/${organizationId}/members`);
  return (json.data ?? []).map(mapMemberRecord);
};

export const addOrgMember = async (
  organizationId: string,
  payload: { userId: string; role?: string }
): Promise<OrgMember> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${organizationId}/members`, {
    method: 'POST',
    body: payload,
  });

  return mapMemberRecord(json.data);
};

export const removeOrgMember = async (organizationId: string, membershipId: string): Promise<void> => {
  await apiRequest(`/api/admin/organizations/${organizationId}/members/${membershipId}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true
  });
};

export default {
  listOrgPage,
  listOrgs,
  getOrg,
  updateOrg,
  createOrg,
  deleteOrg,
  bulkUpdateOrgs,
  getOrgStats,
  listOrgMembers,
  addOrgMember,
  removeOrgMember
};
