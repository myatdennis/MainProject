export const isPlatformAdminActor = (actor) => {
  if (!actor || typeof actor !== 'object') return false;
  return Boolean(
    actor.isPlatformAdmin ||
    actor.platformRole === 'platform_admin' ||
    actor.role === 'admin' ||
    actor.userRole === 'admin'
  );
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
