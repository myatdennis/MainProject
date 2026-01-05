export type Org = {
  id: string;
  name: string;
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
  orgId: string;
  userId: string;
  role: string;
  invitedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

import apiRequest from '../utils/apiClient';

const fromRecord = <T = any>(record: any, key: string): T | undefined => {
  if (!record) return undefined;
  const camelKey = key.replace(/_([a-z])/g, (_, c) => (c ? c.toUpperCase() : ''));
  return record[key] ?? record[camelKey];
};

const seedOrgs = (): Org[] => ([
  {
    id: '1',
    name: 'Pacific Coast University',
    type: 'University',
    contactPerson: 'Dr. Sarah Chen',
    contactEmail: 'sarah.chen@pacificcoast.edu',
    enrollmentDate: '2025-01-15',
    status: 'active',
    totalLearners: 45,
    activeLearners: 42,
    completionRate: 94,
    cohorts: ['Spring 2025 Leadership', 'Faculty Development 2025'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 98, bias: 91, empathy: 87, conversations: 82, planning: 76 },
    notes: 'Excellent engagement. Requested additional modules for faculty.'
  },
  {
    id: '2',
    name: 'Mountain View High School',
    type: 'K-12 Education',
    contactPerson: 'Marcus Rodriguez',
    contactEmail: 'mrodriguez@mvhs.edu',
    enrollmentDate: '2025-01-20',
    status: 'active',
    totalLearners: 23,
    activeLearners: 20,
    completionRate: 87,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Standard',
    lastActivity: '2025-03-10',
    modules: { foundations: 95, bias: 89, empathy: 85, conversations: 78, planning: 65 },
    notes: 'Focus on athletic department leadership development.'
  },
  {
    id: '3',
    name: 'Community Impact Network',
    type: 'Nonprofit',
    contactPerson: 'Jennifer Walsh',
    contactEmail: 'jwalsh@communityimpact.org',
    enrollmentDate: '2025-01-10',
    status: 'inactive',
    totalLearners: 28,
    activeLearners: 15,
    completionRate: 61,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Standard',
    lastActivity: '2025-02-28',
    modules: { foundations: 85, bias: 68, empathy: 54, conversations: 42, planning: 28 },
    notes: 'Low engagement recently. Follow up needed.'
  },
  {
    id: '4',
    name: 'Regional Fire Department',
    type: 'Government',
    contactPerson: 'Captain David Thompson',
    contactEmail: 'dthompson@regionalfire.gov',
    enrollmentDate: '2024-12-01',
    status: 'active',
    totalLearners: 67,
    activeLearners: 63,
    completionRate: 89,
    cohorts: ['Winter 2025 Leadership', 'Command Staff Development'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 92, bias: 88, empathy: 91, conversations: 85, planning: 79 },
    notes: 'Strong leadership commitment. Excellent results.'
  },
  {
    id: '5',
    name: 'TechForward Solutions',
    type: 'Corporate',
    contactPerson: 'Lisa Park',
    contactEmail: 'lpark@techforward.com',
    enrollmentDate: '2025-02-01',
    status: 'active',
    totalLearners: 34,
    activeLearners: 32,
    completionRate: 96,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 100, bias: 97, empathy: 94, conversations: 91, planning: 88 },
    notes: 'Outstanding engagement. Interested in advanced modules.'
  }
]);

export const mapOrgRecord = (record: any): Org => {
  const features = fromRecord(record, 'features') as Org['features'] | undefined;
  const settings = fromRecord(record, 'settings') as Org['settings'] | undefined;

  return {
  id: record.id,
  name: record.name,
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
  orgId: record.org_id ?? record.orgId,
  userId: record.user_id ?? record.userId,
  role: record.role ?? 'member',
  invitedBy: record.invited_by ?? null,
  createdAt: record.created_at ?? new Date().toISOString(),
  updatedAt: record.updated_at ?? new Date().toISOString()
});

export const listOrgs = async (): Promise<Org[]> => {
  const json = await apiRequest<{ data: any[] }>('/api/admin/organizations');
  if ((json.data?.length ?? 0) === 0) {
    for (const org of seedOrgs()) {
      await createOrg(org);
    }
    const refreshed = await apiRequest<{ data: any[] }>('/api/admin/organizations');
    return (refreshed.data || []).map(mapOrgRecord);
  }
  return (json.data || []).map(mapOrgRecord);
};

export const getOrg = async (id: string): Promise<Org | null> => {
  const json = await apiRequest<{ data: any[] }>('/api/admin/organizations');
  const record = (json.data || []).find(org => org.id === id);
  return record ? mapOrgRecord(record) : null;
};

export const createOrg = async (payload: Partial<Org>): Promise<Org> => {
  const json = await apiRequest<{ data: any }>('/api/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return mapOrgRecord(json.data);
};

export const updateOrg = async (id: string, patch: Partial<Org>): Promise<Org> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
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

export const listOrgMembers = async (orgId: string): Promise<OrgMember[]> => {
  const json = await apiRequest<{ data: any[] }>(`/api/admin/organizations/${orgId}/members`);
  return (json.data ?? []).map(mapMemberRecord);
};

export const addOrgMember = async (
  orgId: string,
  payload: { userId: string; role?: string }
): Promise<OrgMember> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${orgId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return mapMemberRecord(json.data);
};

export const removeOrgMember = async (orgId: string, membershipId: string): Promise<void> => {
  await apiRequest(`/api/admin/organizations/${orgId}/members/${membershipId}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true
  });
};

export default {
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
