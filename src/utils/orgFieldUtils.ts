export type OrgFieldCarrier = Record<string, any> | null | undefined;

const normalizeOrgCandidate = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

export const resolveOrgIdFromCarrier = (...candidates: Array<OrgFieldCarrier | string | null | undefined>): string | null => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'object') {
      const nested =
        normalizeOrgCandidate((candidate as Record<string, any>).organization_id) ??
        normalizeOrgCandidate((candidate as Record<string, any>).organizationId) ??
        normalizeOrgCandidate((candidate as Record<string, any>).org_id) ??
        normalizeOrgCandidate((candidate as Record<string, any>).orgId);
      if (nested) {
        return nested;
      }
      continue;
    }
    const normalized = normalizeOrgCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const ORG_ALIAS_KEYS = ['organizationId', 'org_id', 'orgId'] as const;

type SanitizeOptions = {
  removeAliases?: boolean;
};

export const cloneWithCanonicalOrgId = <T extends Record<string, any>>(
  entity: T,
  options: SanitizeOptions = { removeAliases: true }
): { clone: Record<string, any>; organizationId: string | null; strippedKeys: string[] } => {
  const clone: Record<string, any> = { ...entity };
  const organizationId = resolveOrgIdFromCarrier(clone);
  const strippedKeys: string[] = [];

  if (organizationId) {
    clone.organization_id = organizationId;
  } else if ('organization_id' in clone) {
    delete clone.organization_id;
  }

  if (options.removeAliases) {
    for (const key of ORG_ALIAS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(clone, key)) {
        strippedKeys.push(key);
        delete clone[key];
      }
    }
  }

  return { clone, organizationId, strippedKeys };
};

export const detectOrgAliases = (entity: Record<string, any> | null | undefined): string[] => {
  if (!entity) return [];
  return ORG_ALIAS_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(entity, key));
};

export const stampCanonicalOrgId = <T extends Record<string, any>>(entity: T, organizationId: string | null): T => {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }
  if (organizationId) {
    (entity as Record<string, any>).organization_id = organizationId;
  } else if ('organization_id' in entity) {
    delete (entity as Record<string, any>).organization_id;
  }
  return entity;
};
