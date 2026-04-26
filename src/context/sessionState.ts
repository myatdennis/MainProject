import type { UserMembership, UserSession } from '../lib/secureStorage';
import { resolvePreferredOrgId } from '../lib/authOrg';
import type { SessionResponsePayload } from './sessionBootstrap';
import {
  dedupeStrings,
  normalizeMembershipStatusFlag,
  normalizeMemberships,
  type ActiveOrgSource,
} from './organizationResolution';

type SessionStateResolutionInput = {
  payload: SessionResponsePayload;
  requestedOrgId?: string | null;
  lastActiveOrgId?: string | null;
  activeOrgPreference?: string | null;
  membershipCache?: UserMembership[];
  membershipsSnapshot?: UserMembership[];
  organizationIdsSnapshot?: string[];
};

export type SessionStateResolution = {
  membershipState: 'ready' | 'degraded' | 'error';
  resolvedMemberships: UserMembership[];
  organizationIds: string[];
  activeOrgId: string | null;
  activeOrgSource: ActiveOrgSource;
};

const getPlatformRole = (payload: SessionResponsePayload): string | null => {
  const user = payload.user ?? {};
  const appMetadata = user.appMetadata ?? user.app_metadata ?? (payload as any).app_metadata ?? null;
  return (
    appMetadata?.platform_role ??
    appMetadata?.platformRole ??
    user.platformRole ??
    user.platform_role ??
    payload.platformRole ??
    (payload as any).platform_role ??
    null
  );
};

const isPlatformAdminPayload = (payload: SessionResponsePayload): boolean =>
  Boolean(payload.isPlatformAdmin || payload.user?.isPlatformAdmin || String(getPlatformRole(payload) ?? '').toLowerCase() === 'platform_admin');

const resolveActiveOrg = (
  payload: SessionResponsePayload,
  memberships: UserMembership[],
  organizationIds: string[],
  preferredOrgId: string | null,
): { activeOrgId: string | null; source: ActiveOrgSource } => {
  if (preferredOrgId) {
    return { activeOrgId: preferredOrgId, source: 'membership_default' };
  }

  const rawMemberships = Array.isArray(payload.memberships) ? payload.memberships : [];
  const firstRawMembership = rawMemberships[0] as Record<string, any> | undefined;
  const rawMembershipOrgId =
    firstRawMembership?.organization_id ??
    firstRawMembership?.org_id ??
    firstRawMembership?.organizationId ??
    firstRawMembership?.orgId ??
    null;
  if (rawMembershipOrgId) {
    return { activeOrgId: String(rawMembershipOrgId), source: 'membership_default' };
  }

  const normalizedMembershipOrgId = memberships[0]?.orgId ?? null;
  if (normalizedMembershipOrgId) {
    return { activeOrgId: normalizedMembershipOrgId, source: 'membership_default' };
  }

  const directOrgId =
    (payload as any).organization_id ??
    (payload as any).org_id ??
    payload.user?.organization_id ??
    (payload.user as any)?.org_id ??
    payload.activeOrgId ??
    payload.user?.activeOrgId ??
    payload.user?.organizationId ??
    organizationIds[0] ??
    null;
  if (directOrgId) {
    return { activeOrgId: String(directOrgId), source: 'session_payload' };
  }

  if (isPlatformAdminPayload(payload)) {
    console.warn('Platform admin — no org required');
    return { activeOrgId: 'ALL_ORGS', source: 'platform_admin' };
  }

  return { activeOrgId: null, source: 'none' };
};

export const resolveSessionStatePayload = ({
  payload,
  requestedOrgId,
  lastActiveOrgId,
  activeOrgPreference,
  membershipCache = [],
  membershipsSnapshot = [],
  organizationIdsSnapshot = [],
}: SessionStateResolutionInput): SessionStateResolution => {
  const membershipState = normalizeMembershipStatusFlag(payload.membershipStatus, payload.membershipDegraded);
  const membershipsTrusted = membershipState === 'ready';
  const normalizedMembershipsFromPayload = normalizeMemberships(payload.memberships);

  let resolvedMemberships: UserMembership[] = [];
  if (membershipsTrusted) {
    resolvedMemberships = normalizedMembershipsFromPayload;
  } else if (normalizedMembershipsFromPayload.length > 0) {
    resolvedMemberships = normalizedMembershipsFromPayload;
  } else if (membershipCache.length > 0) {
    resolvedMemberships = [...membershipCache];
  } else if (membershipsSnapshot.length > 0) {
    resolvedMemberships = [...membershipsSnapshot];
  }

  const orgIdSources: string[] = [];
  if (Array.isArray(payload.organizationIds) && payload.organizationIds.length > 0) {
    orgIdSources.push(...payload.organizationIds);
  }
  if (resolvedMemberships.length > 0) {
    orgIdSources.push(...resolvedMemberships.map((membership) => membership.orgId));
  }
  if (orgIdSources.length === 0 && organizationIdsSnapshot.length > 0) {
    orgIdSources.push(...organizationIdsSnapshot);
  }
  const organizationIds = dedupeStrings(orgIdSources);

  const preferredOrg = resolvePreferredOrgId({
    memberships: resolvedMemberships,
    requestedOrgId,
    lastActiveOrgId: lastActiveOrgId ?? activeOrgPreference ?? null,
    fallbackOrgIds: organizationIds,
  });

  let activeOrgSource: ActiveOrgSource = 'none';
  let activeOrgId = preferredOrg.activeOrgId ?? null;
  if (activeOrgId) {
    if (preferredOrg.source === 'requested') {
      activeOrgSource = 'requested_hint';
    } else if (preferredOrg.source === 'lastActive') {
      activeOrgSource = 'preference';
    } else if (preferredOrg.source === 'membership') {
      activeOrgSource = 'membership_default';
    }
  }
  if (!activeOrgId) {
    const resolved = resolveActiveOrg(payload, resolvedMemberships, organizationIds, null);
    activeOrgId = resolved.activeOrgId;
    activeOrgSource = resolved.source;
  }

  return {
    membershipState,
    resolvedMemberships,
    organizationIds,
    activeOrgId,
    activeOrgSource,
  };
};

export const buildUserSessionFromPayload = ({
  payload,
  organizationIds,
  memberships,
  activeOrgId,
  activeOrgSource,
}: {
  payload: SessionResponsePayload;
  organizationIds: string[];
  memberships: UserMembership[];
  activeOrgId: string | null;
  activeOrgSource: ActiveOrgSource;
}): UserSession => {
  const session: UserSession = {
    id: payload.user?.id,
    email: payload.user?.email ?? payload.user?.user_email ?? '',
    role:
      payload.user?.role ||
      payload.role ||
      payload.user?.platformRole ||
      payload.platformRole ||
      payload.user?.platform_role ||
      payload.user?.userRole ||
      (payload.isPlatformAdmin ? 'admin' : null) ||
      'learner',
    firstName: payload.user?.firstName ?? payload.user?.first_name ?? payload.user?.user_metadata?.first_name,
    lastName: payload.user?.lastName ?? payload.user?.last_name ?? payload.user?.user_metadata?.last_name,
    organizationId:
      payload.user?.organizationId ??
      payload.user?.organization_id ??
      (organizationIds.length === 1 ? organizationIds[0] : null),
    organizationIds,
    memberships,
    activeOrgId:
      activeOrgId ??
      payload.activeOrgId ??
      payload.user?.activeOrgId ??
      payload.user?.organizationId ??
      null,
    platformRole: getPlatformRole(payload),
    isPlatformAdmin: (() => {
      const explicitFlag = payload.user?.isPlatformAdmin ?? payload.isPlatformAdmin ?? null;
      const roleFlag = String(getPlatformRole(payload) ?? '').toLowerCase() === 'platform_admin';
      return Boolean(explicitFlag || roleFlag);
    })(),
    appMetadata: payload.user?.appMetadata ?? payload.user?.app_metadata ?? null,
    userMetadata: payload.user?.userMetadata ?? payload.user?.user_metadata ?? null,
  };

  if (session.activeOrgId && session.activeOrgId !== 'ALL_ORGS') {
    session.organizationId = session.activeOrgId;
  } else if (activeOrgSource === 'none') {
    if (payload.activeOrgId) {
      activeOrgSource = 'session_payload';
    } else if (payload.user?.activeOrgId || payload.user?.organizationId) {
      activeOrgSource = 'user_payload';
    }
  }

  return session;
};
