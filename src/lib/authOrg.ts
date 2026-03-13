export type MembershipLike = {
  orgId: string | null;
  status?: string | null;
  acceptedAt?: string | null;
  createdAt?: string | null;
};

const ACTIVE_MEMBERSHIP_STATUSES = new Set(['active', 'ready', 'member', 'accepted', 'confirmed']);

const isActiveMembership = (membership: MembershipLike): boolean => {
  const normalizedStatus = String(membership.status ?? 'active').toLowerCase();
  if (!normalizedStatus) {
    return true;
  }
  return ACTIVE_MEMBERSHIP_STATUSES.has(normalizedStatus);
};

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortByRecency = (memberships: MembershipLike[]): MembershipLike[] => {
  return [...memberships].sort((a, b) => {
    const acceptedDiff = toTimestamp(b.acceptedAt) - toTimestamp(a.acceptedAt);
    if (acceptedDiff !== 0) return acceptedDiff;
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });
};

export interface PreferredOrgInput {
  memberships: MembershipLike[];
  requestedOrgId?: string | null;
  lastActiveOrgId?: string | null;
  fallbackOrgIds?: string[];
}

export type PreferredOrgSource = 'requested' | 'lastActive' | 'membership' | 'none';

export interface PreferredOrgResult {
  activeOrgId: string | null;
  hasActiveMembership: boolean;
  source: PreferredOrgSource;
}

export const resolvePreferredOrgId = ({
  memberships,
  requestedOrgId,
  lastActiveOrgId,
  fallbackOrgIds = [],
}: PreferredOrgInput): PreferredOrgResult => {
  const activeMemberships = sortByRecency(memberships.filter(isActiveMembership).filter((m) => Boolean(m.orgId)));
  const normalizedRequested = requestedOrgId?.trim() || null;
  const normalizedLast = lastActiveOrgId?.trim() || null;
  const fallbackOrgList = fallbackOrgIds.map((orgId) => orgId?.trim()).filter((orgId): orgId is string => Boolean(orgId));
  const fallbackOrgSet = new Set(fallbackOrgList);
  const hasActiveMembership = activeMemberships.length > 0;
  let source: PreferredOrgSource = 'none';
  const matches = (orgId: string | null | undefined) => {
    if (!orgId) return false;
    return activeMemberships.some((membership) => membership.orgId === orgId) || fallbackOrgSet.has(orgId);
  };

  let activeOrgId: string | null = null;
  if (matches(normalizedRequested)) {
    activeOrgId = normalizedRequested as string;
    source = 'requested';
  } else if (matches(normalizedLast)) {
    activeOrgId = normalizedLast as string;
    source = 'lastActive';
  } else if (activeMemberships[0]?.orgId) {
    activeOrgId = activeMemberships[0].orgId;
    source = 'membership';
  } else if (fallbackOrgList[0]) {
    activeOrgId = fallbackOrgList[0];
    source = 'membership';
  }

  return {
    activeOrgId,
    hasActiveMembership,
    source,
  };
};
