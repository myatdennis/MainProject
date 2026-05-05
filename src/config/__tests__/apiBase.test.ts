import { describe, it, expect, afterEach } from 'vitest';
import { resolveApiUrl, __setApiBaseUrlOverride, getApiBaseUrl } from '../apiBase';

afterEach(() => {
  __setApiBaseUrlOverride(undefined);
});

describe('resolveApiUrl', () => {
  it('generates absolute URLs when an override is provided', () => {
    __setApiBaseUrlOverride('https://api.example.com/api');
    expect(resolveApiUrl('/api/auth/register')).toBe('https://api.example.com/api/auth/register');
    expect(resolveApiUrl('/health')).toBe('https://api.example.com/api/health');
  });

  it('accepts fully-qualified URLs unchanged', () => {
    __setApiBaseUrlOverride('https://api.example.com/api');
    expect(resolveApiUrl('https://api.other.com/api/health')).toBe('https://api.other.com/api/health');
  });

  it('rejects Supabase Functions API base overrides and falls back to non-functions API paths', () => {
    __setApiBaseUrlOverride('https://eprsgmfzqjptfywoecuy.supabase.co/functions/v1');
    const authUrl = resolveApiUrl('/api/auth/register');
    expect(authUrl).not.toContain('supabase.co/functions/v1');
    expect(authUrl).toContain('/api/auth/register');
  });
});

describe('getApiBaseUrl logging contract', () => {
  it('always returns a string so boot logs can print a resolved target', () => {
    __setApiBaseUrlOverride('https://api.example.com/api');
    const result = getApiBaseUrl();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
