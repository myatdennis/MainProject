export type MembershipLike = {
  orgId: string | null;
  status?: string | null;
  acceptedAt?: string | null;
  createdAt?: string | null;
};

const isActiveMembership = (membership: MembershipLike): boolean => {
  const normalizedStatus = String(membership.status ?? 'active').toLowerCase();
  return normalizedStatus === 'active';
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
}

export interface PreferredOrgResult {
  activeOrgId: string | null;
  hasActiveMembership: boolean;
}

export const resolvePreferredOrgId = ({
  memberships,
  requestedOrgId,
  lastActiveOrgId,
}: PreferredOrgInput): PreferredOrgResult => {
  const activeMemberships = sortByRecency(memberships.filter(isActiveMembership).filter((m) => Boolean(m.orgId)));
  const normalizedRequested = requestedOrgId?.trim() || null;
  const normalizedLast = lastActiveOrgId?.trim() || null;
  const hasActiveMembership = activeMemberships.length > 0;
  const matches = (orgId: string | null | undefined) =>
    Boolean(orgId) && activeMemberships.some((membership) => membership.orgId === orgId);

  let activeOrgId: string | null = null;
  if (matches(normalizedRequested)) {
    activeOrgId = normalizedRequested as string;
  } else if (matches(normalizedLast)) {
    activeOrgId = normalizedLast as string;
  } else if (activeMemberships[0]?.orgId) {
    activeOrgId = activeMemberships[0].orgId;
  }

  return {
    activeOrgId,
    hasActiveMembership,
  };
};
