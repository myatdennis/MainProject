const normalizeTextLocal = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export function normalizeMembershipStatus(membership, statusColumn = 'status') {
  if (statusColumn === 'is_active') {
    const isActive = membership?.is_active;
    if (typeof isActive === 'boolean') {
      return isActive ? 'active' : 'inactive';
    }
    return 'inactive';
  }

  const status = normalizeTextLocal(membership?.status || '');
  if (!status) return 'unknown';
  return status;
}

export function isMembershipActive(membership, statusColumn = 'status') {
  if (statusColumn === 'is_active') {
    return Boolean(membership?.is_active);
  }
  const status = normalizeMembershipStatus(membership, statusColumn);
  return status === 'active';
}

export function mergeMembershipWithProfile(membership, profile, statusColumn = 'status') {
  const orgId = membership?.organization_id || membership?.org_id || profile?.organization_id || profile?.org_id || null;
  const orgIdAlt = membership?.org_id || membership?.organization_id || profile?.org_id || profile?.organization_id || null;
  const normalizedStatus = normalizeMembershipStatus(membership, statusColumn);
  const active = isMembershipActive(membership, statusColumn);
  const role = membership?.role || profile?.role || 'member';

  return {
    ...profile,
    ...membership,
    organization_id: orgId,
    org_id: orgIdAlt,
    role,
    status: normalizedStatus,
    is_active: active,
    profile: profile || null,
    user: {
      id: membership?.user_id ?? null,
      email: profile?.email || null,
      first_name: profile?.first_name || profile?.firstName || null,
      last_name: profile?.last_name || profile?.lastName || null,
      organization_id: orgId,
      role,
      is_active: active,
    },
  };
}

export function buildCanonicalMembershipState({ status, is_active } = {}) {
  const normalizedStatus = normalizeTextLocal(status);
  const hasStatus = normalizedStatus.length > 0;
  const hasIsActive = typeof is_active === 'boolean';

  let canonicalStatus = 'inactive';
  if (hasStatus) {
    if (normalizedStatus === 'active' || normalizedStatus === 'pending') {
      canonicalStatus = normalizedStatus;
    } else if (normalizedStatus === 'revoked' || normalizedStatus === 'inactive') {
      canonicalStatus = 'inactive';
    } else {
      canonicalStatus = 'inactive';
    }
  } else if (hasIsActive) {
    canonicalStatus = is_active ? 'active' : 'inactive';
  }

  const canonicalIsActive = canonicalStatus === 'active' || canonicalStatus === 'pending';

  return {
    status: canonicalStatus,
    is_active: canonicalIsActive,
  };
}

export function resolveMembershipStatusUpdate({ status, is_active } = {}) {
  const canonical = buildCanonicalMembershipState({ status, is_active });
  return {
    status: canonical.status,
    is_active: canonical.is_active,
  };
}
