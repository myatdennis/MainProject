import { useCallback, useMemo, useState } from 'react';
import { useSecureAuth } from '../context/SecureAuthContext';
import type { UserMembership } from '../lib/secureStorage';

type SessionSurface = 'admin' | 'lms';

export interface ActiveOrganizationOption {
  id: string;
  label: string;
  status?: string | null;
  membership: UserMembership | null;
}

export interface UseActiveOrganizationResult {
  activeOrgId: string | null;
  activeMembership: UserMembership | null;
  organizations: ActiveOrganizationOption[];
  isMultiOrg: boolean;
  isSwitching: boolean;
  selectOrganization: (orgId: string | null) => Promise<void>;
  refreshOrganizations: () => Promise<boolean>;
  memberships: UserMembership[];
}

export const useActiveOrganization = (options?: { surface?: SessionSurface }): UseActiveOrganizationResult => {
  const surface = options?.surface;
  const { memberships, organizationIds, activeOrgId, setActiveOrganization, reloadSession } = useSecureAuth();
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);

  const organizations = useMemo<ActiveOrganizationOption[]>(() => {
    if (memberships.length > 0) {
      return memberships.map((membership) => ({
        id: membership.orgId,
        label: membership.organizationName ?? `Organization ${membership.orgId.slice(0, 6)}`,
        status: membership.status,
        membership,
      }));
    }

    if (organizationIds.length > 0) {
      return organizationIds.map((orgId) => ({
        id: orgId,
        label: `Organization ${orgId.slice(0, 6)}`,
        status: 'unknown',
        membership: null,
      }));
    }

    return [];
  }, [memberships, organizationIds]);

  const activeMembership = useMemo(() => {
    if (!activeOrgId) return null;
    return memberships.find((membership) => membership.orgId === activeOrgId) ?? null;
  }, [activeOrgId, memberships]);

  const selectOrganization = useCallback(
    async (orgId: string | null) => {
      setPendingOrgId(orgId ?? '__none__');
      try {
        await setActiveOrganization(orgId);
      } finally {
        setPendingOrgId(null);
      }
    },
    [setActiveOrganization],
  );

  const refreshOrganizations = useCallback(() => {
    return surface ? reloadSession({ surface }) : reloadSession();
  }, [reloadSession, surface]);

  return {
    activeOrgId,
    activeMembership,
    organizations,
    isMultiOrg: organizations.length > 1,
    isSwitching: pendingOrgId !== null,
    selectOrganization,
    refreshOrganizations,
    memberships,
  };
};

export default useActiveOrganization;
