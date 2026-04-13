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
  if (preferredOrg.activeOrgId) {
    if (preferredOrg.source === 'requested') {
      activeOrgSource = 'requested_hint';
    } else if (preferredOrg.source === 'lastActive') {
      activeOrgSource = 'preference';
    } else if (preferredOrg.source === 'membership') {
      activeOrgSource = 'membership_default';
    }
  }

  return {
    membershipState,
    resolvedMemberships,
    organizationIds,
    activeOrgId: preferredOrg.activeOrgId ?? null,
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
    platformRole: payload.user?.platformRole ?? payload.user?.platform_role ?? payload.platformRole ?? null,
    isPlatformAdmin: (() => {
      const explicitFlag = payload.user?.isPlatformAdmin ?? payload.isPlatformAdmin ?? null;
      const roleFlag =
        payload.user?.platformRole === 'platform_admin' || payload.platformRole === 'platform_admin';
      return Boolean(explicitFlag || roleFlag);
    })(),
    appMetadata: payload.user?.appMetadata ?? payload.user?.app_metadata ?? null,
    userMetadata: payload.user?.userMetadata ?? payload.user?.user_metadata ?? null,
  };

  if (session.activeOrgId) {
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
