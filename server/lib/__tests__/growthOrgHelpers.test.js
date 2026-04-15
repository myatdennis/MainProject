import { describe, it, expect } from 'vitest';
import { isValidGrowthOrgId } from '../growthOrgHelpers.js';

describe('growth org ID validation', () => {
  it('accepts UUID org IDs in all modes', () => {
    expect(isValidGrowthOrgId('f3d5a770-7b90-4e53-96c7-5aca2aa8817f')).toBe(true);
    expect(isValidGrowthOrgId('f3d5a770-7b90-4e53-96c7-5aca2aa8817f', { allowNonUuidInDemoMode: true })).toBe(true);
  });

  it('rejects non-UUID org IDs in normal mode', () => {
    expect(isValidGrowthOrgId('demo-sandbox-org')).toBe(false);
    expect(isValidGrowthOrgId('org-1')).toBe(false);
  });

  it('accepts non-UUID org IDs in demo/test mode', () => {
    expect(isValidGrowthOrgId('demo-sandbox-org', { allowNonUuidInDemoMode: true })).toBe(true);
    expect(isValidGrowthOrgId('org-1', { allowNonUuidInDemoMode: true })).toBe(true);
  });
});
