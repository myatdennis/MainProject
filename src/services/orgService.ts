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
  totalUsers?: number;
  activeUsers?: number;
  completionRate: number;
  cohorts: string[];
  lastActivity?: string;
  modules: Record<string, number>;
  
  // Additional Data
  notes?: string;
  tags?: string[];
  ownerEmail?: string;
  owner?: {
    email?: string;
    name?: string;
  };
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

export type OrgContact = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type OrgProfileMetrics = {
  totalUsers: number;
  activeUsers: number;
  coursesAssigned: number;
  surveysAssigned: number;
  courseCompletionRate: number;
  surveyCompletionRate: number;
};

export type OrgAssignmentTopItem = {
  id: string;
  title: string | null;
  status: string | null;
  dueAt: string | null;
  updatedAt: string | null;
};

export type OrgAssignmentBucket = {
  assignmentCount: number;
  learnerAssignments: number;
  orgAssignments: number;
  dueSoonCount: number;
  completedCount: number;
  latestAssignedAt: string | null;
  topAssignments: OrgAssignmentTopItem[];
};

export type OrgAssignmentSummary = {
  courses: OrgAssignmentBucket;
  surveys: OrgAssignmentBucket;
  generatedAt?: string | null;
};

export type OrgProfileUser = {
  id?: string | null;
  membershipId: string | null;
  orgId: string | null;
  userId: string | null;
  role: string | null;
  status: string | null;
  invitedBy: string | null;
  acceptedAt: string | null;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  email: string | null;
  name: string | null;
  title: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type OrgProfileInvite = {
  id: string;
  organizationId: string | null;
  email: string | null;
  role: string | null;
  status: string;
  invitedBy: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  lastSentAt: string | null;
  reminderCount?: number | null;
  note: string | null;
  token?: string | null;
};

export type OrgProfileMessage = {
  id: string;
  organizationId: string | null;
  recipientType: string | null;
  recipientId: string | null;
  subject: string | null;
  body: string | null;
  channel: string | null;
  sentBy: string | null;
  sentAt: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
};

export type OrgProfileDetails = {
  organization: Org;
  profile?: Record<string, unknown> | null;
  branding?: Record<string, unknown> | null;
  contacts: OrgContact[];
  admins: OrgProfileUser[];
  users: OrgProfileUser[];
  metrics: OrgProfileMetrics;
  assignments?: OrgAssignmentSummary | null;
  invites: OrgProfileInvite[];
  messages: OrgProfileMessage[];
  lastContacted: string | null;
};

import apiRequest, { ApiError } from '../utils/apiClient';
import { resolveApiUrl } from '../config/apiBase';
import { appendAdminOrgIdQuery, requireExplicitAdminOrgId } from '../utils/adminOrgScope';

// Reduce TTL to make admin lists refresh quickly when backend state changes.
// Short TTL avoids long stale windows while still deduping rapid repeated requests.
const ORG_LIST_CACHE_TTL_MS = 5 * 1000;
type OrgListCacheEntry = { timestamp: number; data: Org[] };
const orgListCache = new Map<string, OrgListCacheEntry>();
type OrgPageCacheEntry = { timestamp: number; data: OrgListResponse };
const orgPageCache = new Map<string, OrgPageCacheEntry>();
const orgProfileCache = new Map<string, { timestamp: number; data: OrgProfileDetails | null }>();
const orgPageInflight = new Map<string, Promise<OrgListResponse>>();
const orgProfileInflight = new Map<string, Promise<OrgProfileDetails | null>>();
const buildOrgListCacheKey = (params?: OrgListParams) => JSON.stringify(params ?? {});

export const invalidateOrgListCache = (predicate?: (key: string) => boolean) => {
  if (!predicate) {
    orgListCache.clear();
    orgPageCache.clear();
    orgProfileCache.clear();
    notifyOrgListInvalidated();
    return;
  }
  for (const key of Array.from(orgListCache.keys())) {
    if (predicate(key)) {
      orgListCache.delete(key);
    }
  }
  for (const key of Array.from(orgPageCache.keys())) {
    if (predicate(key)) {
      orgPageCache.delete(key);
    }
  }
  // Notify listeners when partial invalidation happens as well
  notifyOrgListInvalidated();
};

// Event emitter: allow UI surfaces to subscribe to list invalidation so they can
// proactively refresh instead of waiting for TTL expiry or a manual refresh.
const orgListInvalidationListeners = new Set<() => void>();

export const onOrgListInvalidated = (cb: () => void) => {
  orgListInvalidationListeners.add(cb);
  return () => orgListInvalidationListeners.delete(cb);
};

// Notify listeners when cache is invalidated via this helper.
const notifyOrgListInvalidated = () => {
  for (const cb of Array.from(orgListInvalidationListeners)) {
    try {
      cb();
    } catch (e) {
      // swallow listener errors
      console.warn('[orgService] orgListInvalidation listener error', e);
    }
  }
};

const fromRecord = <T = any>(record: any, key: string): T | undefined => {
  if (!record) return undefined;
  const camelKey = key.replace(/_([a-z])/g, (_, c) => (c ? c.toUpperCase() : ''));
  return record[key] ?? record[camelKey];
};

export const mapOrgRecord = (record: any): Org => {
  const features = fromRecord(record, 'features') as Org['features'] | undefined;
  const settings = fromRecord(record, 'settings') as Org['settings'] | undefined;
  const totalUsers = Number(
    fromRecord(record, 'total_users') ??
      fromRecord(record, 'totalUsers') ??
      fromRecord(record, 'total_learners') ??
      fromRecord(record, 'totalLearners') ??
      record?.metrics?.totalUsers ??
      record?.metrics?.total_users ??
      0,
  );
  const activeUsers = Number(
    fromRecord(record, 'active_users') ??
      fromRecord(record, 'activeUsers') ??
      fromRecord(record, 'active_learners') ??
      fromRecord(record, 'activeLearners') ??
      record?.metrics?.activeUsers ??
      record?.metrics?.active_users ??
      0,
  );

  return {
    id: record.id ?? record.organization_id ?? record.org_id ?? '',
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
  totalLearners: Number.isFinite(totalUsers) ? totalUsers : 0,
  activeLearners: Number.isFinite(activeUsers) ? activeUsers : 0,
  totalUsers: Number.isFinite(totalUsers) ? totalUsers : 0,
  activeUsers: Number.isFinite(activeUsers) ? activeUsers : 0,
    completionRate: Number(fromRecord(record, 'completion_rate') ?? 0),
    cohorts: fromRecord(record, 'cohorts') ?? [],
    lastActivity: fromRecord(record, 'last_activity') ?? undefined,
    modules: fromRecord(record, 'modules') ?? {},
    notes: fromRecord(record, 'notes') ?? undefined,
    tags: fromRecord(record, 'tags') ?? [],
    ownerEmail: fromRecord(record, 'owner_email') ?? undefined,
    owner: record.owner ?? undefined,
  };
};

const mapOrgContactRecord = (record: any): OrgContact => ({
  id: record.id ?? record.contactId ?? String(record?.orgId ?? ''),
  name: record.name ?? record.contactName ?? null,
  email: record.email ?? record.contactEmail ?? null,
  role: record.role ?? record.type ?? null,
  phone: record.phone ?? record.contactPhone ?? null,
  isPrimary: Boolean(record.isPrimary ?? record.is_primary ?? false),
});

const mapOrgProfileUserRecord = (record: any): OrgProfileUser => ({
  id: record.membershipId ?? record.id ?? null,
  membershipId: record.membershipId ?? record.id ?? null,
  orgId: record.orgId ?? record.org_id ?? null,
  userId: record.userId ?? record.user_id ?? null,
  role: record.role ?? null,
  status: record.status ?? null,
  invitedBy: record.invitedBy ?? record.invited_by ?? null,
  acceptedAt: record.acceptedAt ?? record.accepted_at ?? null,
  lastSeenAt: record.lastSeenAt ?? record.last_seen_at ?? null,
  // Avoid schema-specific fields like last_login_at; prefer updated_at if available.
  lastLoginAt: record.lastLoginAt ?? record.updatedAt ?? null,
  email: record.email ?? null,
  name: record.name ?? null,
  title: record.title ?? null,
  createdAt: record.createdAt ?? record.created_at ?? null,
  updatedAt: record.updatedAt ?? record.updated_at ?? null,
});

const mapOrgInviteRecord = (record: any): OrgProfileInvite => ({
  id: record.id ?? '',
  organizationId: record.organizationId ?? record.organization_id ?? record.org_id ?? null,
  email: record.email ?? null,
  role: record.role ?? null,
  status: record.status ?? 'pending',
  token: record.token ?? null,
  invitedBy: record.invitedBy ?? record.invited_by ?? null,
  invitedAt: record.invitedAt ?? record.invited_at ?? record.created_at ?? null,
  acceptedAt: record.acceptedAt ?? record.accepted_at ?? null,
  expiresAt: record.expiresAt ?? record.expires_at ?? null,
  lastSentAt: record.lastSentAt ?? record.last_sent_at ?? null,
  reminderCount: record.reminderCount ?? record.reminder_count ?? null,
  note: record.note ?? null,
});

const mapOrgMessageRecord = (record: any): OrgProfileMessage => ({
  id: record.id ?? '',
  organizationId: record.organizationId ?? record.organization_id ?? record.org_id ?? null,
  recipientType: record.recipientType ?? record.recipient_type ?? null,
  recipientId: record.recipientId ?? record.recipient_id ?? null,
  subject: record.subject ?? null,
  body: record.body ?? null,
  channel: record.channel ?? null,
  sentBy: record.sentBy ?? record.sent_by ?? null,
  sentAt: record.sentAt ?? record.sent_at ?? record.created_at ?? null,
  status: record.status ?? null,
  metadata: (record.metadata as Record<string, unknown>) ?? null,
});

const mapOrgMetricsRecord = (record: any): OrgProfileMetrics => ({
  totalUsers: Number(record?.totalUsers ?? record?.total_users ?? 0),
  activeUsers: Number(record?.activeUsers ?? record?.active_users ?? 0),
  coursesAssigned: Number(record?.coursesAssigned ?? record?.courses_assigned ?? 0),
  surveysAssigned: Number(record?.surveysAssigned ?? record?.surveys_assigned ?? 0),
  courseCompletionRate: Number(record?.courseCompletionRate ?? record?.course_completion_rate ?? 0),
  surveyCompletionRate: Number(record?.surveyCompletionRate ?? record?.survey_completion_rate ?? 0),
});

const mapAssignmentTopItems = (items?: any[]): OrgAssignmentTopItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const id = item?.id;
      if (!id) return null;
      return {
        id: String(id),
        title: item?.title ?? null,
        status: item?.status ?? null,
        dueAt: item?.dueAt ?? item?.due_at ?? null,
        updatedAt: item?.updatedAt ?? item?.updated_at ?? null,
      };
    })
    .filter((item): item is OrgAssignmentTopItem => Boolean(item));
};

const mapAssignmentBucketRecord = (record?: any): OrgAssignmentBucket => ({
  assignmentCount: Number(record?.assignmentCount ?? record?.assignment_count ?? 0),
  learnerAssignments: Number(record?.learnerAssignments ?? record?.learner_assignments ?? 0),
  orgAssignments: Number(record?.orgAssignments ?? record?.org_assignments ?? 0),
  dueSoonCount: Number(record?.dueSoonCount ?? record?.due_soon_count ?? 0),
  completedCount: Number(record?.completedCount ?? record?.completed_count ?? 0),
  latestAssignedAt: record?.latestAssignedAt ?? record?.latest_assigned_at ?? null,
  topAssignments: mapAssignmentTopItems(record?.topAssignments),
});

const mapAssignmentSummaryRecord = (record?: any): OrgAssignmentSummary => ({
  courses: mapAssignmentBucketRecord(record?.courses),
  surveys: mapAssignmentBucketRecord(record?.surveys),
  generatedAt: record?.generatedAt ?? record?.generated_at ?? null,
});

const mapOrgProfileResponse = (payload: any): OrgProfileDetails => {
  const organizationRecord = payload?.organization ?? payload;
  return {
    organization: mapOrgRecord(organizationRecord),
    profile: payload?.profile ?? null,
    branding: payload?.branding ?? null,
    contacts: Array.isArray(payload?.contacts) ? payload.contacts.map(mapOrgContactRecord) : [],
    admins: Array.isArray(payload?.admins) ? payload.admins.map(mapOrgProfileUserRecord) : [],
    users: Array.isArray(payload?.users) ? payload.users.map(mapOrgProfileUserRecord) : [],
    metrics: mapOrgMetricsRecord(payload?.metrics ?? {}),
    assignments: payload?.assignments ? mapAssignmentSummaryRecord(payload.assignments) : undefined,
    invites: Array.isArray(payload?.invites) ? payload.invites.map(mapOrgInviteRecord) : [],
    messages: Array.isArray(payload?.messages) ? payload.messages.map(mapOrgMessageRecord) : [],
    lastContacted: payload?.lastContacted ?? null,
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

export const listOrgPage = async (
  params?: OrgListParams,
  options?: { forceRefresh?: boolean; preferredOrgId?: string | null },
): Promise<OrgListResponse> => {
  const cacheKey = buildOrgListCacheKey(params);
  const cached = orgPageCache.get(cacheKey);
  if (!options?.forceRefresh && cached && Date.now() - cached.timestamp < ORG_LIST_CACHE_TTL_MS) {
    return cached.data;
  }
  const existing = orgPageInflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const run = (async () => {
  const explicitOrgId = requireExplicitAdminOrgId('admin organizations', options?.preferredOrgId);
  const query = buildOrgQuery(params);
  const path = appendAdminOrgIdQuery(`/api/admin/organizations${query}`, explicitOrgId);
  const clientTraceId = `admin-orgs-${Date.now().toString(36)}`;
  if (import.meta.env.DEV) {
    console.info('[orgService] request_dispatch', {
      clientTraceId,
      route: '/api/admin/organizations',
      requestedOrgId: explicitOrgId,
      url: resolveApiUrl(path),
    });
  }
  try {
    const json = await apiRequest<{ data: any[]; pagination?: any; progress?: Record<string, any> }>(path);
  const response = {
    data: (json.data || []).map(mapOrgRecord),
    pagination: {
      page: json.pagination?.page ?? params?.page ?? 1,
      pageSize: json.pagination?.pageSize ?? params?.pageSize ?? (json.data?.length ?? 0),
      total: json.pagination?.total ?? json.data?.length ?? 0,
      hasMore: Boolean(json.pagination?.hasMore),
    },
    progress: json.progress ?? {},
  };
  if (import.meta.env.DEV) {
    console.info('[orgService] response_received', {
      clientTraceId,
      route: '/api/admin/organizations',
      requestedOrgId: explicitOrgId,
      rowCount: response.data.length,
      totalCount: response.pagination.total,
      envelopeKeys: Object.keys(json ?? {}),
    });
  }
  orgPageCache.set(cacheKey, { timestamp: Date.now(), data: response });
  orgListCache.set(cacheKey, { timestamp: Date.now(), data: response.data });
  return response;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[orgService] response_failed', {
        clientTraceId,
        route: '/api/admin/organizations',
        requestedOrgId: explicitOrgId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
  })();
  orgPageInflight.set(cacheKey, run);
  return run.finally(() => {
    orgPageInflight.delete(cacheKey);
  });
};

export const listOrgs = async (
  params?: OrgListParams,
  options?: { forceRefresh?: boolean; preferredOrgId?: string | null }
): Promise<Org[]> => {
  const cacheKey = buildOrgListCacheKey(params);
  if (!options?.forceRefresh) {
    const entry = orgListCache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < ORG_LIST_CACHE_TTL_MS) {
      return entry.data;
    }
  } else {
    invalidateOrgListCache((key) => key === cacheKey);
  }

  const response = await listOrgPage(params, options);
  orgListCache.set(cacheKey, { timestamp: Date.now(), data: response.data });
  return response.data;
};

export const getOrgProfileDetails = async (id: string): Promise<OrgProfileDetails | null> => {
  const cached = orgProfileCache.get(id);
  if (cached && Date.now() - cached.timestamp < ORG_LIST_CACHE_TTL_MS) {
    return cached.data;
  }
  const existing = orgProfileInflight.get(id);
  if (existing) {
    return existing;
  }
  const run = (async () => {
  try {
    const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${id}`);
    if (!json?.data) return null;
    const response = mapOrgProfileResponse(json.data);
    orgProfileCache.set(id, { timestamp: Date.now(), data: response });
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      orgProfileCache.set(id, { timestamp: Date.now(), data: null });
      return null;
    }
    throw error;
  }
  })();
  orgProfileInflight.set(id, run);
  return run.finally(() => {
    orgProfileInflight.delete(id);
  });
};

export const getOrg = async (id: string): Promise<Org | null> => {
  const profile = await getOrgProfileDetails(id);
  return profile?.organization ?? null;
};

type CreateOrgPayload = Partial<Org> & {
  ownerEmail?: string;
  owner?: {
    email?: string;
    name?: string;
  };
};

export const createOrg = async (payload: CreateOrgPayload): Promise<Org> => {
  const json = await apiRequest<{ data: any }>('/api/admin/organizations', {
    method: 'POST',
    body: payload
  });
  invalidateOrgListCache();
  return mapOrgRecord(json.data);
};

export const updateOrg = async (id: string, patch: Partial<Org>): Promise<Org> => {
  const json = await apiRequest<{ data: any }>(`/api/admin/organizations/${id}`, {
    method: 'PUT',
    body: patch
  });
  invalidateOrgListCache();
  orgProfileCache.delete(id);
  return mapOrgRecord(json.data);
};

export const deleteOrg = async (id: string): Promise<void> => {
  await apiRequest(`/api/admin/organizations/${id}`, { method: 'DELETE' });
  // Invalidate org list cache so the deleted org can't reappear from stale cached list
  invalidateOrgListCache();
  orgProfileCache.delete(id);
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
  const profile = await getOrgProfileDetails(id);
  if (!profile) return null;
  const metrics = profile.metrics;
  const totalUsers = metrics.totalUsers ?? profile.organization.totalLearners ?? 0;
  const activeUsers = metrics.activeUsers ?? profile.organization.activeLearners ?? 0;

  return {
    overview: {
      totalUsers,
      activeUsers,
      completionRate: metrics.courseCompletionRate ?? profile.organization.completionRate ?? 0,
      avgSessionTime: Math.max(5, Math.round((activeUsers || 1) * 0.5)),
    },
    engagement: {
      dailyActiveUsers: Math.round(activeUsers * 0.6),
      weeklyActiveUsers: Math.round(activeUsers * 0.8),
      monthlyActiveUsers: activeUsers,
    },
    performance: {
      coursesCompleted: metrics.coursesAssigned ?? 0,
      certificatesIssued: Math.round(totalUsers * ((metrics.courseCompletionRate ?? 0) / 100)),
      avgScores: {},
    },
    trends: {
      userGrowth: Array.from({ length: 6 }, (_, i) => ({
        month: new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        users: Math.max(0, totalUsers - i * 2),
      })),
      completionTrends: Array.from({ length: 6 }, (_, i) => ({
        date: new Date(Date.now() - (5 - i) * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        completions: Math.max(0, Math.round((metrics.coursesAssigned ?? 0) / 6) - i),
      })),
    },
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
  invalidateOrgListCache();
};

export type OrgInviteInput = {
  email: string;
  role?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
  note?: string | null;
  allowDuplicate?: boolean;
};

export const listOrgInvites = async (organizationId: string) => {
  return apiRequest<{ data: OrgProfileInvite[] }>(`/api/admin/organizations/${organizationId}/invites`);
};

export const createOrgInvite = async (organizationId: string, payload: OrgInviteInput) => {
  return apiRequest<{ data: any; duplicate?: boolean }>(`/api/admin/organizations/${organizationId}/invites`, {
    method: 'POST',
    body: payload,
  });
};

export const bulkOrgInvites = async (organizationId: string, invites: OrgInviteInput[]) => {
  return apiRequest<{ results: Array<Record<string, any>> }>(`/api/admin/organizations/${organizationId}/invites/bulk`, {
    method: 'POST',
    body: { invites },
  });
};

export const resendOrgInvite = async (organizationId: string, inviteId: string) => {
  return apiRequest<{ data: any }>(`/api/admin/organizations/${organizationId}/invites/${inviteId}/resend`, {
    method: 'POST',
  });
};

export const remindOrgInvite = async (organizationId: string, inviteId: string) => {
  return apiRequest<{ data: any }>(`/api/admin/organizations/${organizationId}/invites/${inviteId}/remind`, {
    method: 'POST',
  });
};

export const revokeOrgInvite = async (organizationId: string, inviteId: string) => {
  return apiRequest(`/api/admin/organizations/${organizationId}/invites/${inviteId}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true,
  });
};

export default {
  listOrgPage,
  listOrgs,
  getOrg,
  getOrgProfileDetails,
  updateOrg,
  createOrg,
  deleteOrg,
  bulkUpdateOrgs,
  listOrgInvites,
  createOrgInvite,
  bulkOrgInvites,
  resendOrgInvite,
  remindOrgInvite,
  revokeOrgInvite,
  getOrgStats,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  invalidateOrgListCache,
  onOrgListInvalidated,
};
