import { describe, it, expect } from 'vitest';
import { isUuid, coerceUuidOrNull } from '../isUuid';

describe('isUuid utility', () => {
  it('accepts canonical UUID strings', () => {
    expect(isUuid('9c2f2a7e-3b9b-4b09-8f6c-3d4c2b0c9d38')).toBe(true);
    expect(isUuid('9C2F2A7E-3B9B-4B09-8F6C-3D4C2B0C9D38')).toBe(true);
  });

  it('rejects malformed identifiers', () => {
    expect(isUuid('mod-temp-id')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null as unknown as string)).toBe(false);
  });

  it('coerces UUID-like strings and returns null otherwise', () => {
    const valid = ' 4f2f2a7e-3b9b-4b09-8f6c-3d4c2b0c9d38 ';
    expect(coerceUuidOrNull(valid)).toBe(valid.trim());
    expect(coerceUuidOrNull('mod-temp-id')).toBeNull();
  });
});
