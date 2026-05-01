import { describe, it, expect } from 'vitest';
import { isSupabaseAuthCreateUserAlreadyExists, isSupabaseAuthCreateUserDatabaseError } from '../authHelpers.js';

describe('authHelpers', () => {
  it('isSupabaseAuthCreateUserAlreadyExists handles null/undefined safely', () => {
    expect(isSupabaseAuthCreateUserAlreadyExists(null)).toBe(false);
    expect(isSupabaseAuthCreateUserAlreadyExists(undefined)).toBe(false);
    expect(isSupabaseAuthCreateUserAlreadyExists({})).toBe(false);
  });

  it('isSupabaseAuthCreateUserAlreadyExists detects known existing-email shapes', () => {
    expect(
      isSupabaseAuthCreateUserAlreadyExists({ message: 'User already registered', code: '23505', status: 409 }),
    ).toBe(true);
    expect(
      isSupabaseAuthCreateUserAlreadyExists({ message: 'duplicate key value violates unique constraint', code: 'PGRST116' }),
    ).toBe(true);
    expect(
      isSupabaseAuthCreateUserAlreadyExists({ message: 'Email already exists', statusCode: 422 }),
    ).toBe(true);
  });

  it('isSupabaseAuthCreateUserAlreadyExists does not misclassify unrelated errors', () => {
    expect(
      isSupabaseAuthCreateUserAlreadyExists({ message: 'Some fatal issue', code: '500', status: 500 }),
    ).toBe(false);
  });

  it('isSupabaseAuthCreateUserDatabaseError detects explicit DB error', () => {
    expect(
      isSupabaseAuthCreateUserDatabaseError({ message: 'Database error creating new user: connection failed', code: 'unexpected_failure' }),
    ).toBe(true);
    expect(isSupabaseAuthCreateUserDatabaseError({ message: 'database error invalid', code: '42P02' })).toBe(true);
  });
});
