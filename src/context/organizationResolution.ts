import type { UserMembership, UserSession } from '../lib/secureStorage';
import type { OrgContextSnapshot } from '../store/courseStoreOrgBridge';

export type OrgResolutionStatus = 'idle' | 'resolving' | 'ready' | 'error';
export type ActiveOrgSource =
  | 'requested_hint'
  | 'preference'
  | 'membership_default'
  | 'session_payload'
  | 'user_payload'
  | 'none';

export const dedupeStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (!value) return;
    const trimmed = String(value).trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
};

export const normalizeMembershipStatusFlag = (
  status?: string | null,
  degradedFlag?: boolean | null,
): 'ready' | 'degraded' | 'error' => {
  if (degradedFlag) {
    return 'degraded';
  }
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : null;
  if (!normalized) {
    return 'ready';
  }
  if (normalized === 'degraded') {
    return 'degraded';
  }
  if (normalized === 'error') {
    return 'error';
  }
  return normalized === 'ready' ? 'ready' : 'ready';
};

export const normalizeMemberships = (rows: Array<Record<string, any>> | undefined): UserMembership[] => {
  if (!Array.isArray(rows)) return [];
  return rows.reduce<UserMembership[]>((acc, row) => {
    const orgId = row?.orgId || row?.organizationId || row?.organization_id || row?.org_id;
    if (!orgId) {
      return acc;
    }
    acc.push({
      orgId,
      organizationId: orgId,
      role: row.role ?? row.organization_role ?? null,
      status: row.status ?? 'active',
      organizationName: row.organizationName ?? row.organization_name ?? row.org_name ?? null,
      organizationSlug: row.organizationSlug ?? row.organization_slug ?? row.org_slug ?? null,
      organizationStatus: row.organizationStatus ?? row.organization_status ?? null,
      subscription: row.subscription ?? null,
      features: row.features ?? null,
      acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
      lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
    });
    return acc;
  }, []);
};

export const deriveOrgContextSnapshot = ({
  membershipStatus,
  sessionStatus,
  activeOrgId,
  lastActiveOrgId,
  user,
}: {
  membershipStatus: string | null | undefined;
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
  activeOrgId: string | null;
  lastActiveOrgId: string | null;
  user: UserSession | null;
}): OrgContextSnapshot => {
  const normalizedMembership = membershipStatus ?? 'idle';
  const sessionReady = sessionStatus === 'authenticated';
  const membershipReady = normalizedMembership === 'ready' || normalizedMembership === 'degraded';

  if (!sessionReady) {
    return {
      status: 'loading',
      membershipStatus: normalizedMembership,
      activeOrgId: null,
      orgId: null,
      role: null,
      userId: null,
    };
  }

  if (!membershipReady) {
    return {
      status: normalizedMembership === 'error' ? 'error' : 'loading',
      membershipStatus: normalizedMembership,
      activeOrgId: null,
      orgId: null,
      role: user?.role ?? null,
      userId: user?.id ?? null,
    };
  }

  const resolvedOrgId = activeOrgId ?? user?.activeOrgId ?? user?.organizationId ?? lastActiveOrgId ?? null;

  return {
    status: 'ready',
    membershipStatus: normalizedMembership,
    activeOrgId: resolvedOrgId,
    orgId: resolvedOrgId,
    role: user?.role ?? null,
    userId: user?.id ?? null,
  };
};

