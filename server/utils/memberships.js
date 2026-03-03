import supabase from '../lib/supabaseClient.js';
import sql from '../db.js';

const MEMBERSHIP_VIEW_NAME = 'user_organizations_vw';
const VIEW_COLUMNS = '*';
const OPTIONAL_ORG_COLUMNS = ['slug', 'logo_url', 'created_at', 'updated_at', 'features'];
let organizationColumnDetectionPromise = null;
let organizationColumnSet = new Set();

const sanitizeErrorPayload = (error) => {
  if (!error || typeof error !== 'object') {
    return { message: String(error ?? 'unknown_error') };
  }
  return {
    message: error.message ?? String(error),
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
};

const buildDiagnostics = (overrides = {}) => {
  const primaryCode = overrides.code || null;
  const codes = Array.isArray(overrides.codes)
    ? overrides.codes.filter(Boolean)
    : primaryCode
      ? [primaryCode]
      : [];
  return {
    code: primaryCode,
    codes,
    severity: overrides.severity || 'info',
    fallback: overrides.fallback || null,
    message: overrides.message || null,
    source: overrides.source || 'memberships',
    timestamp: new Date().toISOString(),
    error: overrides.error ? sanitizeErrorPayload(overrides.error) : null,
    details: overrides.details || null,
  };
};

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

const DIAGNOSTIC_KEY = '__diagnostics';

const attachDiagnostics = (rows, diagnostics) => {
  if (!Array.isArray(rows) || !diagnostics) return rows;
  Object.defineProperty(rows, DIAGNOSTIC_KEY, {
    value: diagnostics,
    enumerable: false,
    configurable: true,
  });
  return rows;
};

const getDiagnostics = (rows) => (rows && rows[DIAGNOSTIC_KEY]) || null;

const ACTIVE_STATUSES = new Set(['active']);

const isAcceptedMembership = (row = {}) => {
  const normalizedStatus = String(row.status ?? 'active').toLowerCase();
  const isActiveFlag = row.is_active;
  const acceptedAt = row.accepted_at ?? row.created_at ?? null;
  const activeStatus = ACTIVE_STATUSES.has(normalizedStatus);
  const activeFlag = isActiveFlag === undefined || isActiveFlag === null || isActiveFlag === true;
  return activeStatus && activeFlag && Boolean(acceptedAt);
};

const mapMembershipRecord = (row = {}) => {
  const resolvedOrgId = normalizeOrgId(row.organization_id);
  return {
    organization_id: resolvedOrgId,
    orgId: resolvedOrgId,
    organizationId: resolvedOrgId,
    role: row.role || 'member',
    status: row.status || 'active',
    is_active: row.is_active ?? true,
    organization_name: row.organization_name ?? row.org_name ?? null,
    organization_slug: row.organization_slug ?? row.org_slug ?? null,
    org_slug: row.org_slug ?? row.organization_slug ?? null,
    organization_status: row.organization_status ?? null,
    organization_logo_url: row.organization_logo_url ?? row.logo_url ?? null,
    logo_url: row.logo_url ?? row.organization_logo_url ?? null,
    subscription: row.subscription ?? null,
    features: row.features ?? null,
    accepted_at: row.accepted_at ?? row.created_at ?? null,
    last_seen_at: row.last_seen_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
};

const filterActiveMemberships = (rows = []) => rows.filter((row) => isAcceptedMembership(row));

const membershipColumnState = {
  detectionPromise: null,
  columns: new Set(),
};

const detectOrganizationColumns = async () => {
  if (!process.env.DATABASE_URL) {
    return new Set();
  }
  try {
    const rows = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations'
    `;
    return new Set(rows.map((row) => row.column_name));
  } catch (error) {
    console.warn('[memberships] organization column detection failed', {
      message: error?.message || error,
    });
    return new Set();
  }
};

const detectMembershipColumns = async () => {
  if (!process.env.DATABASE_URL) {
    return new Set();
  }
  try {
    const rows = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'organization_memberships'
    `;
    return new Set(rows.map((row) => row.column_name));
  } catch (error) {
    console.warn('[memberships] membership column detection failed', {
      message: error?.message || error,
    });
    return new Set();
  }
};

const ensureOrganizationColumnMetadata = async () => {
  if (organizationColumnDetectionPromise) {
    return organizationColumnDetectionPromise;
  }
  organizationColumnDetectionPromise = detectOrganizationColumns()
    .then((columns) => {
      organizationColumnSet = columns;
      return columns;
    })
    .catch((error) => {
      console.warn('[memberships] organization column detection error', {
        message: error?.message || error,
      });
      return organizationColumnSet;
    });
  return organizationColumnDetectionPromise;
};

const ORGANIZATION_BASE_COLUMNS = ['id', 'name', 'status', 'subscription'];
let cachedOrganizationSelectClause = null;

const ensureMembershipColumnMetadata = async () => {
  if (membershipColumnState.detectionPromise) {
    return membershipColumnState.detectionPromise;
  }
  membershipColumnState.detectionPromise = detectMembershipColumns()
    .then((columns) => {
      membershipColumnState.columns = columns;
      return columns;
    })
    .catch((error) => {
      console.warn('[memberships] membership column detection error', {
        message: error?.message || error,
      });
      return membershipColumnState.columns;
    });
  return membershipColumnState.detectionPromise;
};

const hasMembershipProfileColumn = () => membershipColumnState.columns.has('profile_id');

const getOrganizationSelectClause = async () => {
  if (cachedOrganizationSelectClause) {
    return cachedOrganizationSelectClause;
  }
  const columnsSet = await ensureOrganizationColumnMetadata();
  const columns = [...ORGANIZATION_BASE_COLUMNS];
  OPTIONAL_ORG_COLUMNS.forEach((column) => {
    if (columnsSet.has(column) && !columns.includes(column)) {
      columns.push(column);
    }
  });
  cachedOrganizationSelectClause = columns.join(',');
  return cachedOrganizationSelectClause;
};

// kick off metadata detection without blocking startup
ensureOrganizationColumnMetadata().catch(() => {});
ensureMembershipColumnMetadata().catch(() => {});

const getMembershipSelectColumns = async () => {
  await ensureMembershipColumnMetadata();
  const baseColumns = [
    'organization_id',
    'role',
    'status',
    'is_active',
    'accepted_at',
    'created_at',
    'updated_at',
    'user_id',
    'id',
  ];
  if (membershipColumnState.columns.has('profile_id')) {
    baseColumns.push('profile_id');
  }
  return baseColumns.join(',');
};

const buildMembershipMatchFilter = (userId) => {
  const normalized = String(userId || '').trim();
  if (!normalized) {
    return '';
  }
  if (hasMembershipProfileColumn()) {
    return `user_id.eq.${normalized},profile_id.eq.${normalized}`;
  }
  return `user_id.eq.${normalized}`;
};

export const getMembershipColumnCapabilities = async () => {
  await ensureMembershipColumnMetadata();
  return {
    hasProfileId: hasMembershipProfileColumn(),
  };
};

export const buildMembershipFilterString = async (userId) => {
  await ensureMembershipColumnMetadata();
  return buildMembershipMatchFilter(userId);
};

const fetchMembershipsFromBaseTables = async (userId, logPrefix) => {
  if (!supabase || !userId) {
    return { rows: [], error: new Error('supabase_unavailable') };
  }
  try {
    const selectClause = await getMembershipSelectColumns();
    const filter = await buildMembershipFilterString(userId);
    let query = supabase
      .from('organization_memberships')
      .select(selectClause)
      .eq('status', 'active')
      .eq('is_active', true)
      .not('accepted_at', 'is', null);

    if (filter) {
      query = query.or(filter);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: membershipRows, error } = await query;
    if (error) {
      throw error;
    }

    const rows = Array.isArray(membershipRows) ? membershipRows : [];
    const filteredRows = filterActiveMemberships(rows);
    const orgIds = Array.from(new Set(rows.map((row) => normalizeOrgId(row?.organization_id)).filter(Boolean)));

    let orgMap = new Map();
    if (orgIds.length > 0) {
      const selectClause = await getOrganizationSelectClause();
      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select(selectClause)
        .in('id', orgIds);

      if (orgError) {
        throw orgError;
      }
      orgMap = new Map((organizations || []).map((org) => [org.id, org]));
    }

    return filteredRows.map((row) => {
      const organization = orgMap.get(normalizeOrgId(row?.organization_id)) || {};
      return mapMembershipRecord({
        organization_id: row?.organization_id,
        role: row?.role,
        status: row?.status ?? 'active',
        is_active: row?.is_active ?? true,
        organization_name: organization.name || null,
        organization_slug: organization.slug || null,
        organization_status: organization.status || null,
        subscription: organization.subscription ?? null,
        features: organization.features ?? null,
        organization_logo_url: organization.logo_url ?? null,
        logo_url: organization.logo_url ?? null,
        accepted_at: row?.accepted_at || row?.created_at || null,
        last_seen_at: row?.updated_at || null,
        org_slug: organization.slug || null,
      });
    });

    return { rows: filteredRows, error: null };
  } catch (error) {
    console.warn(`${logPrefix} membership_base_fallback_failed`, {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { rows: [], error };
  }
};

export const getUserMemberships = async (userId, { logPrefix = '[memberships]' } = {}) => {
  if (!supabase || !userId) {
    return attachDiagnostics([], buildDiagnostics({ code: 'membership_query_error', severity: 'error', message: 'Supabase client unavailable' }));
  }
  try {
    const { data, error } = await supabase.from(MEMBERSHIP_VIEW_NAME).select(VIEW_COLUMNS).eq('user_id', userId);

    if (error) {
      if (isViewMissingError(error)) {
        console.debug(`${logPrefix} membership_view_unavailable`, {
          userId,
          code: error.code,
          message: error.message,
        });
        const fallbackResult = await fetchMembershipsFromBaseTables(userId, logPrefix);
        const diag = buildDiagnostics({
          code: error.code || 'view_unavailable',
          severity: fallbackResult.error ? 'error' : 'warn',
          fallback: 'base_tables',
          message: fallbackResult.error ? fallbackResult.error.message : error.message,
          error: fallbackResult.error ?? error,
        });
        return attachDiagnostics(fallbackResult.rows, diag);
      }
      console.warn(`${logPrefix} membership_view_query_failed`, {
        userId,
        code: error.code,
        message: error.message,
      });
      return attachDiagnostics(
        [],
        buildDiagnostics({
          code: error.code || 'view_query_failed',
          severity: 'error',
          fallback: 'none',
          message: error.message,
          error,
        }),
      );
    }

    if (!Array.isArray(data)) {
      return attachDiagnostics(
        [],
        buildDiagnostics({
          code: 'membership_query_error',
          severity: 'error',
          message: 'membership view returned invalid payload',
        }),
      );
    }

    const normalizedRows = data.map((row) => mapMembershipRecord(row));
    const filtered = filterActiveMemberships(normalizedRows);
    if (filtered.length === 0) {
      const fallbackResult = await fetchMembershipsFromBaseTables(userId, logPrefix);
      const diag = fallbackResult.error
        ? buildDiagnostics({
            code: 'membership_query_error',
            severity: 'error',
            fallback: 'base_tables',
            message: fallbackResult.error?.message || 'membership view empty and base query failed',
            error: fallbackResult.error,
          })
        : buildDiagnostics({
            code: 'empty_view_result',
            severity: 'warn',
            fallback: 'base_tables',
            message: 'membership view returned no active rows',
          });
      return attachDiagnostics(fallbackResult.rows, diag);
    }

    return filtered;
  } catch (error) {
    console.error(`${logPrefix} membership_lookup_error`, {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return attachDiagnostics(
      [],
      buildDiagnostics({
        code: 'membership_query_error',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        error,
      }),
    );
  }
};

export default getUserMemberships;

export const getMembershipDiagnostics = (rows) => getDiagnostics(rows);
