import { randomUUID } from 'crypto';

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  timezone?: string | null;
  subscription?: string | null;
  features?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgMembershipRecord = {
  id: string;
  userId: string;
  orgId: string;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'revoked';
  acceptedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgMembershipPayload = {
  id: string;
  orgId: string;
  organizationId: string;
  role: string;
  status: string;
  organizationName: string | null;
  organizationSlug: string | null;
  organizationStatus: string | null;
  subscription?: string | null;
  features?: Record<string, unknown> | null;
  acceptedAt?: string | null;
  lastSeenAt?: string | null;
};

type OrganizationCreateInput = {
  name: string;
  slug?: string;
  status?: OrganizationRecord['status'];
  timezone?: string | null;
  subscription?: string | null;
  features?: Record<string, unknown> | null;
};

const organizations = new Map<string, OrganizationRecord>();
const memberships = new Map<string, OrgMembershipRecord>();
const membershipsByUser = new Map<string, Set<string>>();
const membershipsByOrg = new Map<string, Set<string>>();
const activeOrgByUser = new Map<string, string>();

const nowIso = () => new Date().toISOString();

const registerOrganization = (record: OrganizationRecord) => {
  organizations.set(record.id, record);
};

const registerMembership = (record: OrgMembershipRecord) => {
  memberships.set(record.id, record);
  if (!membershipsByUser.has(record.userId)) {
    membershipsByUser.set(record.userId, new Set());
  }
  if (!membershipsByOrg.has(record.orgId)) {
    membershipsByOrg.set(record.orgId, new Set());
  }
  membershipsByUser.get(record.userId)!.add(record.id);
  membershipsByOrg.get(record.orgId)!.add(record.id);
};

const sanitizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `org-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_FEATURES = {
  analytics: true,
  certificates: true,
  apiAccess: false,
  customBranding: true,
  sso: false,
  mobileApp: false,
  reporting: true,
  integrations: true,
};

const seedOrganizations = () => {
  const base = [
    {
      id: 'org-huddle',
      name: 'The Huddle HQ',
      slug: 'the-huddle',
      status: 'active' as const,
      timezone: 'America/Los_Angeles',
      subscription: 'enterprise',
    },
    {
      id: 'org-pacific',
      name: 'Pacific Coast University',
      slug: 'pacific-coast',
      status: 'active' as const,
      timezone: 'America/Chicago',
      subscription: 'growth',
    },
  ];

  base.forEach((org) => {
    const timestamp = nowIso();
    registerOrganization({
      ...org,
      features: { ...DEFAULT_FEATURES },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  const membershipSeed: Array<OrgMembershipRecord> = [
    {
      id: randomUUID(),
      userId: '00000000-0000-0000-0000-000000000001',
      orgId: 'org-huddle',
      role: 'admin',
      status: 'active',
      acceptedAt: nowIso(),
      lastSeenAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: randomUUID(),
      userId: '00000000-0000-0000-0000-000000000002',
      orgId: 'org-pacific',
      role: 'member',
      status: 'active',
      acceptedAt: nowIso(),
      lastSeenAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  membershipSeed.forEach((record) => registerMembership(record));
};

seedOrganizations();

const membershipsForUser = (userId: string): OrgMembershipRecord[] => {
  const ids = membershipsByUser.get(userId);
  if (!ids) {
    return [];
  }
  return Array.from(ids)
    .map((id) => memberships.get(id))
    .filter((value): value is OrgMembershipRecord => Boolean(value));
};

const membershipsForOrg = (orgId: string): OrgMembershipRecord[] => {
  const ids = membershipsByOrg.get(orgId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => memberships.get(id))
    .filter((value): value is OrgMembershipRecord => Boolean(value));
};

const toMembershipPayload = (record: OrgMembershipRecord): OrgMembershipPayload => {
  const organization = organizations.get(record.orgId);
  return {
    id: record.id,
    orgId: record.orgId,
    organizationId: record.orgId,
    role: record.role,
    status: record.status,
    organizationName: organization?.name ?? null,
    organizationSlug: organization?.slug ?? null,
    organizationStatus: organization?.status ?? null,
    subscription: organization?.subscription ?? null,
    features: organization?.features ?? null,
    acceptedAt: record.acceptedAt ?? record.createdAt,
    lastSeenAt: record.lastSeenAt ?? null,
  };
};

export const listUserMemberships = (userId: string): OrgMembershipPayload[] => {
  return membershipsForUser(userId).map(toMembershipPayload);
};

export const listOrganizationMembers = (orgId: string): OrgMembershipPayload[] => {
  return membershipsForOrg(orgId).map(toMembershipPayload);
};

export const getOrganizationById = (orgId: string): OrganizationRecord | undefined => {
  return organizations.get(orgId);
};

export const listOrganizationsForUser = (
  userId: string,
  options: { orgId?: string | null } = {},
): OrganizationRecord[] => {
  const membershipsForUserList = membershipsForUser(userId);
  const scoped = options.orgId
    ? membershipsForUserList.filter((membership) => membership.orgId === options.orgId)
    : membershipsForUserList;
  return scoped
    .map((membership) => organizations.get(membership.orgId))
    .filter((org): org is OrganizationRecord => Boolean(org));
};

export const getOrganizationIdsForUser = (userId: string): string[] => {
  return membershipsForUser(userId).map((membership) => membership.orgId);
};

export const findMembership = (userId: string, orgId: string): OrgMembershipPayload | null => {
  const match = membershipsForUser(userId).find((membership) => membership.orgId === orgId);
  return match ? toMembershipPayload(match) : null;
};

export const setActiveOrgForUser = (userId: string, orgId: string): string | null => {
  const membership = findMembership(userId, orgId);
  if (!membership) {
    return null;
  }
  activeOrgByUser.set(userId, membership.orgId);
  return membership.orgId;
};

export const getActiveOrgForUser = (userId: string): string | null => {
  const stored = activeOrgByUser.get(userId);
  if (stored) {
    return stored;
  }
  const membershipsList = membershipsForUser(userId);
  if (membershipsList.length === 0) {
    return null;
  }
  const fallback = membershipsList[0].orgId;
  activeOrgByUser.set(userId, fallback);
  return fallback;
};

export const createOrganization = (
  input: OrganizationCreateInput,
  ownerUserId?: string,
): { organization: OrganizationRecord } => {
  const timestamp = nowIso();
  const baseSlug = sanitizeSlug(input.slug || input.name);
  const candidateId = baseSlug.startsWith('org-') ? baseSlug : `org-${baseSlug}`;
  const finalId = organizations.has(candidateId)
    ? `${candidateId}-${Math.random().toString(36).slice(2, 6)}`
    : candidateId;
  const record: OrganizationRecord = {
    id: finalId,
    name: input.name.trim(),
    slug: baseSlug,
    status: input.status ?? 'active',
    timezone: input.timezone ?? 'UTC',
    subscription: input.subscription ?? 'standard',
    features: input.features ?? { ...DEFAULT_FEATURES },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  registerOrganization(record);

  if (ownerUserId) {
    registerMembership({
      id: randomUUID(),
      userId: ownerUserId,
      orgId: record.id,
      role: 'admin',
      status: 'active',
      acceptedAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    activeOrgByUser.set(ownerUserId, record.id);
  }

  return { organization: record };
};

export const upsertOrganization = (
  orgId: string,
  payload: Partial<OrganizationCreateInput>,
): OrganizationRecord | null => {
  const existing = organizations.get(orgId);
  if (!existing) return null;
  const updated: OrganizationRecord = {
    ...existing,
    name: payload.name?.trim() || existing.name,
    slug: payload.slug ? sanitizeSlug(payload.slug) : existing.slug,
    status: payload.status ?? existing.status,
    timezone: payload.timezone ?? existing.timezone,
    subscription: payload.subscription ?? existing.subscription,
    features: payload.features ?? existing.features,
    updatedAt: nowIso(),
  };
  organizations.set(orgId, updated);
  return updated;
};

export const assertOrgAccess = (
  userId: string,
  orgId: string,
): { organization: OrganizationRecord; membership: OrgMembershipPayload } | null => {
  const membership = findMembership(userId, orgId);
  if (!membership) {
    return null;
  }
  const organization = organizations.get(membership.orgId);
  if (!organization) {
    return null;
  }
  return { organization, membership };
};
