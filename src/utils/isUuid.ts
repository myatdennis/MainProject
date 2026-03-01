const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_PATTERN.test(trimmed);
};

export const coerceUuidOrNull = (value: unknown): string | null => {
  return isUuid(value) ? String(value).trim() : null;
};

export default isUuid;
