import supabase from '../lib/supabaseClient.js';

const MEMBERSHIP_VIEW_NAME = 'user_organizations_vw';
const VIEW_COLUMNS = 'user_id, org_id, org_name, org_slug, role, created_at';

const isViewMissingError = (error) =>
  Boolean(
    error &&
      (error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.code === '42703' ||
        (typeof error.message === 'string' && error.message.includes(MEMBERSHIP_VIEW_NAME))),
  );

const normalizeOrgId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const mapMembershipRecord = (row = {}) => {
  const resolvedOrgId = normalizeOrgId(row.organization_id ?? row.org_id);
  return {
    organization_id: resolvedOrgId,
    org_id: resolvedOrgId,
    role: row.role || 'member',
    status: row.status || 'active',
    organization_name: row.organization_name ?? row.org_name ?? null,
    organization_slug: row.organization_slug ?? row.org_slug ?? null,
    org_slug: row.org_slug ?? row.organization_slug ?? null,
    organization_status: row.organization_status ?? null,
    subscription: row.subscription ?? null,
    features: row.features ?? null,
    accepted_at: row.accepted_at ?? row.created_at ?? null,
    last_seen_at: row.last_seen_at ?? null,
    created_at: row.created_at ?? null,
  };
};

const fetchMembershipsFromBaseTables = async (userId, logPrefix) => {
  if (!supabase || !userId) return [];
  try {
    const { data: membershipRows, error } = await supabase
      .from('organization_memberships')
      .select('org_id, role, created_at, updated_at')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(membershipRows) ? membershipRows : [];
    const orgIds = Array.from(new Set(rows.map((row) => normalizeOrgId(row?.org_id)).filter(Boolean)));

    let orgMap = new Map();
    if (orgIds.length > 0) {
      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select('id,name,slug,status,subscription,features')
        .in('id', orgIds);

      if (orgError) {
        throw orgError;
      }
      orgMap = new Map((organizations || []).map((org) => [org.id, org]));
    }

    return rows.map((row) => {
      const organization = orgMap.get(normalizeOrgId(row?.org_id)) || {};
      return mapMembershipRecord({
        org_id: row?.org_id,
        role: row?.role,
        status: 'active',
        organization_name: organization.name || null,
        organization_slug: organization.slug || null,
        organization_status: organization.status || null,
        subscription: organization.subscription ?? null,
        features: organization.features ?? null,
        accepted_at: row?.created_at || null,
        last_seen_at: row?.updated_at || null,
        org_slug: organization.slug || null,
      });
    });
  } catch (error) {
    console.warn(`${logPrefix} membership_base_fallback_failed`, {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
};

export const getUserMemberships = async (userId, { logPrefix = '[memberships]' } = {}) => {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase.from(MEMBERSHIP_VIEW_NAME).select(VIEW_COLUMNS).eq('user_id', userId);

    if (error) {
      if (isViewMissingError(error)) {
        console.debug(`${logPrefix} membership_view_unavailable`, {
          userId,
          code: error.code,
          message: error.message,
        });
        return fetchMembershipsFromBaseTables(userId, logPrefix);
      }
      console.warn(`${logPrefix} membership_view_query_failed`, {
        userId,
        code: error.code,
        message: error.message,
      });
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((row) => mapMembershipRecord(row));
  } catch (error) {
    console.error(`${logPrefix} membership_lookup_error`, {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
};

export default getUserMemberships;
