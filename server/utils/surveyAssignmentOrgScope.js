/**
 * @typedef {Object} MembershipRow
 * @property {string | number | null | undefined} [user_id]
 * @property {string | number | null | undefined} [organization_id]
 * @property {string | null | undefined} [status]
 * @property {boolean | null | undefined} [is_active]
 * @property {string | null | undefined} [accepted_at]
 */

/**
 * @typedef {Object} OrgScopeDerivationSuccess
 * @property {true} ok
 * @property {string[]} organizationIds
 */

/**
 * @typedef {Object} OrgScopeDerivationFailure
 * @property {false} ok
 * @property {'organization_scope_required' | 'explicit_org_selection_required'} code
 * @property {string} message
 * @property {{ unresolvedUsers?: string[]; ambiguousUsers?: string[] }} meta
 */

const normalizeOrgIdValue = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') {
      return null;
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value && typeof value === 'object') {
    const candidate =
      value.organization_id ??
      value.organizationId ??
      value.orgId ??
      value.id ??
      null;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed || null;
    }
  }
  return null;
};

const normalizeUserId = (value) =>
  typeof value === 'string'
    ? value.trim().toLowerCase()
    : typeof value === 'number'
      ? String(value).trim().toLowerCase()
      : '';

const hasAcceptedMembership = (row) => {
  if (row?.is_active === false) return false;
  if (row?.accepted_at === null) return false;
  return true;
};

/**
 * @param {{ normalizedUserIds?: Array<string | number>; membershipRows?: MembershipRow[] }} input
 * @returns {OrgScopeDerivationSuccess | OrgScopeDerivationFailure}
 */
export const deriveSurveyAssignmentOrgScope = ({
  normalizedUserIds = [],
  membershipRows = [],
} = {}) => {
  const byUser = new Map();

  for (const row of membershipRows || []) {
    const rowUserId = normalizeUserId(row?.user_id);
    const rowOrgId = normalizeOrgIdValue(row?.organization_id);
    if (!rowUserId || !rowOrgId) continue;
    if (String(row?.status ?? '').toLowerCase() !== 'active') continue;
    if (!hasAcceptedMembership(row)) continue;

    if (!byUser.has(rowUserId)) {
      byUser.set(rowUserId, new Set());
    }
    byUser.get(rowUserId).add(rowOrgId);
  }

  const unresolvedUsers = [];
  const ambiguousUsers = [];
  const derivedOrgs = new Set();

  for (const userId of normalizedUserIds) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) continue;

    const orgSet = byUser.get(normalizedUserId);
    if (!orgSet || orgSet.size === 0) {
      unresolvedUsers.push(normalizedUserId);
      continue;
    }

    if (orgSet.size > 1) {
      ambiguousUsers.push(normalizedUserId);
      continue;
    }

    for (const orgId of orgSet) {
      derivedOrgs.add(orgId);
    }
  }

  if (unresolvedUsers.length > 0) {
    return {
      ok: false,
      code: 'organization_scope_required',
      message:
        'One or more target users are missing an active organization membership. Provide organizationIds explicitly.',
      meta: { unresolvedUsers },
    };
  }

  if (ambiguousUsers.length > 0) {
    return {
      ok: false,
      code: 'explicit_org_selection_required',
      message:
        'One or more target users belong to multiple organizations. Provide organizationIds explicitly.',
      meta: { ambiguousUsers },
    };
  }

  return {
    ok: true,
    organizationIds: Array.from(derivedOrgs),
  };
};

export default deriveSurveyAssignmentOrgScope;
