export const isPlatformAdminFor = ({ req = null, context = null } = {}) => {
  try {
    const fromContext = context && (context.isPlatformAdmin === true || String(context?.platformRole || '').trim().toLowerCase() === 'platform_admin');
    const fromReq = req && (req.user?.isPlatformAdmin === true || String(req.user?.platformRole || '').trim().toLowerCase() === 'platform_admin');
    return Boolean(fromContext || fromReq);
  } catch (e) {
    return false;
  }
};

export default isPlatformAdminFor;

export const requireOrgForNonPlatformAdmin = ({ orgId = null, req = null, context = null } = {}) => {
  const isPlatformAdmin = isPlatformAdminFor({ req, context });
  if (!isPlatformAdmin && !orgId) {
    const err = new Error('org_id_required');
    err.code = 'org_id_required';
    throw err;
  }
  return true;
};
