import { sendError, sendOk } from '../lib/apiEnvelope.js';

const normalizePortalRole = (value) => String(value || '').toLowerCase();

const mapActivityRecord = (row) => ({
  id: row?.id ?? null,
  action: row?.action ?? null,
  details: row?.details ?? {},
  userId: row?.user_id ?? null,
  organizationId: row?.organization_id ?? null,
  createdAt: row?.created_at ?? new Date().toISOString(),
});

export const buildClientMePayload = ({ context, sessionUser }) => {
  const memberships = Array.isArray(sessionUser?.memberships) ? sessionUser.memberships : [];
  const organizations = memberships.map((membership) => ({
    orgId: membership?.orgId || membership?.org_id || null,
    role: membership?.role ?? null,
    status: membership?.status ?? null,
  }));
  const email = sessionUser?.email || sessionUser?.user?.email || null;
  const displayName =
    sessionUser?.displayName ||
    sessionUser?.fullName ||
    sessionUser?.user_metadata?.full_name ||
    sessionUser?.user?.user_metadata?.full_name ||
    null;
  const normalizedRoles = Array.isArray(sessionUser?.roles)
    ? sessionUser.roles.map((role) => normalizePortalRole(role))
    : [];
  const normalizedPrimaryRole = normalizePortalRole(context?.userRole || sessionUser?.role);
  const hasOrgMembership = organizations.some((organization) => Boolean(organization.orgId));
  const hasLearnerSurfaceAccess = Boolean(context?.userId);
  const hasClientSurfaceAccess =
    hasLearnerSurfaceAccess &&
    (hasOrgMembership ||
      normalizedPrimaryRole === 'client' ||
      normalizedPrimaryRole === 'learner' ||
      normalizedPrimaryRole === 'facilitator' ||
      normalizedRoles.includes('client') ||
      normalizedRoles.includes('learner') ||
      normalizedRoles.includes('facilitator'));

  return {
    userId: context?.userId ?? null,
    email,
    displayName,
    role: context?.userRole ?? sessionUser?.role ?? null,
    orgId:
      context?.requestedOrgId ||
      sessionUser?.activeOrgId ||
      sessionUser?.organizationId ||
      (organizations.find((org) => Boolean(org.orgId))?.orgId ?? null),
    organizations,
    portalAccess: {
      admin: Boolean(sessionUser?.isPlatformAdmin || normalizedRoles.includes('admin')),
      learner: hasLearnerSurfaceAccess,
      client: hasClientSurfaceAccess,
    },
  };
};

export const createClientPortalService = ({ logger, supabase, e2eStore, isDemoOrTestMode }) => ({
  async loadClientActivity({ userId, limit }) {
    if (isDemoOrTestMode) {
      return Array.from(e2eStore?.auditLogs || [])
        .filter((entry) => entry.user_id === userId || entry.actor_id === userId)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, limit)
        .map(mapActivityRecord);
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, details, user_id, organization_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapActivityRecord);
  },

  handleClientActivityError(res, error, userId) {
    logger.warn('client_activity_fetch_failed', {
      userId,
      message: error?.message ?? String(error),
    });
    return sendError(res, 500, 'client_activity_fetch_failed', 'Unable to fetch activity feed');
  },

  respondClientMe(res, payload) {
    return sendOk(res, payload);
  },
});

