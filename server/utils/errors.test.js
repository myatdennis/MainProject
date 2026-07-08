import { describe, it, expect } from 'vitest';
import { isMissingColumnError, extractMissingColumnName, normalizeColumnIdentifier } from './errors.js';

describe('errors utils - missing column detection', () => {
  it('recognizes real PostgREST PGRST204 schema-cache errors', () => {
    const error = {
      code: 'PGRST204',
      details: null,
      hint: null,
      message: "Could not find the 'subcategory' column of 'documents' in the schema cache",
    };
    expect(isMissingColumnError(error)).toBe(true);
    expect(extractMissingColumnName(error)).toBe('subcategory');
    expect(normalizeColumnIdentifier(extractMissingColumnName(error))).toBe('subcategory');
  });

  it('still matches raw Postgres "does not exist" errors', () => {
    const error = { code: '42703', message: 'column "org_id" does not exist' };
    expect(isMissingColumnError(error)).toBe(true);
    expect(extractMissingColumnName(error)).toBe('org_id');
  });

  it('does not misfire on unrelated errors', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(isMissingColumnError(error)).toBe(false);
    expect(extractMissingColumnName(error)).toBeNull();
  });
});
