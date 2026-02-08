const missingColumnPatterns = [
  /column\s+"?([\w.]+)"?\s+does not exist/i,
  /Could not find ['"]?([\w.]+)['"]? column/i,
  /Could not find '([\w.]+)' column of '([\w.]+)' in the schema cache/i,
];

const missingRelationPatterns = [
  /relation\s+"?([\w.]+)"?\s+does not exist/i,
  /table\s+"?([\w.]+)"?\s+does not exist/i,
];

export const normalizeColumnIdentifier = (identifier) => {
  if (typeof identifier !== 'string') return null;
  const cleaned = identifier.replace(/['"]/g, '');
  const segments = cleaned.split('.');
  return segments[segments.length - 1] || null;
};

export const extractMissingColumnName = (error) => {
  if (!error) return null;
  const candidates = [error.message, error.details, error.hint, error.code];
  for (const text of candidates) {
    if (typeof text !== 'string') continue;
    for (const pattern of missingColumnPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }
  return null;
};

export const isMissingColumnError = (error) =>
  Boolean(
    error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        missingColumnPatterns.some((pattern) =>
          typeof error.message === 'string' && pattern.test(error.message)
            ? true
            : typeof error.details === 'string' && pattern.test(error.details),
        )),
  );

export const isMissingRelationError = (error) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        missingRelationPatterns.some((pattern) =>
          typeof error.message === 'string' && pattern.test(error.message)
            ? true
            : typeof error.details === 'string' && pattern.test(error.details),
        )),
  );

