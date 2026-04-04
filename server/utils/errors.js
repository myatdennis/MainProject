const missingColumnPatterns = [
  /column\s+"?([\w.]+)"?\s+does not exist/i,
  /Could not find ['"]?([\w.]+)['"]? column/i,
  /Could not find '([\w.]+)' column of '([\w.]+)' in the schema cache/i,
];

const missingRelationPatterns = [
  /relation\s+"?([\w.]+)"?\s+does not exist/i,
  /table\s+"?([\w.]+)"?\s+does not exist/i,
];

const missingFunctionPatterns = [
  /function\s+"?([\w.]+)"?\s+does not exist/i,
  /the function ["']?([\w.]+)["']?\s+does not exist/i,
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

export const isMissingFunctionError = (error) =>
  Boolean(
    error &&
      (error.code === '42883' ||
        missingFunctionPatterns.some((pattern) =>
          typeof error.message === 'string' && pattern.test(error.message)
            ? true
            : typeof error.details === 'string' && pattern.test(error.details),
        )),
  );

// PostgREST returns this when the onConflict column list does not correspond
// to a non-partial unique index or primary key.  This happens when the DB has
// only a PARTIAL unique index (WHERE clause) for the requested columns.
export const isMembershipConflictTargetError = (error) => {
  if (!error) return false;
  const code = String(error?.code || '').toUpperCase();
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    code === 'PGRST109' ||
    text.includes('there is no unique or exclusion constraint') ||
    text.includes('no unique or exclusion constraint') ||
    text.includes('could not find a unique index') ||
    text.includes('conflict_target') ||
    // Supabase sometimes surfaces this as a generic PostgREST 400 with this hint
    text.includes('on_conflict')
  );
};
