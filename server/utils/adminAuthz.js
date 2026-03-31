export const isPlatformAdminActor = (actor) => {
  if (!actor || typeof actor !== 'object') return false;
  const normalizedPlatformRole = String(actor.platformRole || actor.userRole || '').toLowerCase();
  const isPlatformFlag = Boolean(actor.isPlatformAdmin);
  return Boolean(
    isPlatformFlag ||
    normalizedPlatformRole === 'platform_admin'
  );
};

const normalizeOrgId = (orgId) => {
  if (!orgId) return null;
  if (typeof orgId === 'string') {
    const trimmed = orgId.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') return null;
    return trimmed;
  }
  if (typeof orgId === 'number') {
    return String(orgId);
  }
  if (typeof orgId === 'object') {
    const fromProps = orgId.organization_id || orgId.org_id || orgId.orgId || orgId.organizationId || orgId.id;
    if (typeof fromProps === 'string') {
      const trimmed = fromProps.trim();
      return trimmed || null;
    }
    if (typeof fromProps === 'number') {
      return String(fromProps);
    }
  }
  return null;
};

const getMembershipOrgId = (membership) => {
  if (!membership || typeof membership !== 'object') return null;
  return normalizeOrgId(membership.orgId || membership.organization_id || membership.org_id || membership.organizationId || membership.orgId);
};

const isWritableOrgRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return ['owner', 'admin', 'manager', 'editor'].includes(normalized);
};

export const hasMembershipForOrg = (actor, orgId) => {
  if (!actor || !Array.isArray(actor.memberships)) return false;
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) return false;
  return actor.memberships.some((membership) => {
    const membershipOrg = getMembershipOrgId(membership);
    return membershipOrg && membershipOrg === normalizedOrgId;
  });
};

export const canModifyOrganization = (actor, orgId) => {
  if (isPlatformAdminActor(actor)) return true;
  if (!actor || !Array.isArray(actor.memberships)) return false;
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) return false;
  return actor.memberships.some((membership) => {
    const membershipOrg = getMembershipOrgId(membership);
    if (!membershipOrg || membershipOrg !== normalizedOrgId) return false;
    return isWritableOrgRole(membership.role || membership.displayRole || membership.role_name || '');
  });
};

export const canModifyUser = (actor, targetUser = {}) => {
  if (isPlatformAdminActor(actor)) return true;
  if (!actor || !Array.isArray(actor.memberships) || !targetUser) return false;

  const targetOrg =
    normalizeOrgId(targetUser.active_organization_id) ||
    normalizeOrgId(targetUser.organization_id) ||
    normalizeOrgId(targetUser.org_id) ||
    normalizeOrgId(targetUser.orgId);

  if (!targetOrg) return false;
  return actor.memberships.some((membership) => {
    const membershipOrg = getMembershipOrgId(membership);
    if (!membershipOrg || membershipOrg !== targetOrg) return false;
    return isWritableOrgRole(membership.role || membership.displayRole || membership.role_name || '');
  });
};

export const canAssignAcrossOrganizations = (actor, sourceOrgId, targetOrgId) => {
  if (isPlatformAdminActor(actor)) return true;
  const sourceOrg = normalizeOrgId(sourceOrgId);
  const targetOrg = normalizeOrgId(targetOrgId);
  if (!sourceOrg || !targetOrg) return false;
  if (sourceOrg !== targetOrg) return false;
  return canModifyOrganization(actor, sourceOrg);
};

export const canInviteToOrg = async ({ orgId, inviterId, actor, isUserActiveOrganizationMember }) => {
  if (!orgId || !inviterId) return false;
  if (!actor || !isUserActiveOrganizationMember) {
    throw new Error('canInviteToOrg requires actor and isUserActiveOrganizationMember');
  }

  if (isPlatformAdminActor(actor)) {
    return true;
  }
  return await isUserActiveOrganizationMember(orgId, inviterId);
};
