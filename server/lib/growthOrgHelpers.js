const ORG_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => {
  if (typeof value !== 'string') return false;
  return ORG_UUID_PATTERN.test(value.trim());
};

export const isValidGrowthOrgId = (orgId, { allowNonUuidInDemoMode = false } = {}) => {
  if (!orgId) return false;
  if (isUuid(orgId)) return true;
  return Boolean(allowNonUuidInDemoMode);
};
