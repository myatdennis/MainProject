import { describe, expect, it } from 'vitest';
import { isAllowedWsOrigin } from './wsOrigins.js';

describe('isAllowedWsOrigin', () => {
  it('allows primary production domains', () => {
    expect(isAllowedWsOrigin('https://the-huddle.co', { isProduction: true })).toEqual({ allowed: true, reason: 'static_allowlist' });
    expect(isAllowedWsOrigin('https://www.the-huddle.co', { isProduction: true })).toEqual({ allowed: true, reason: 'static_allowlist' });
  });

  it('allows matching Netlify deploy preview domains', () => {
    expect(isAllowedWsOrigin('https://deploy-preview-42--the-huddleco.netlify.app', { isProduction: true })).toEqual({
      allowed: true,
      reason: 'netlify_preview',
    });
  });

  it('allows any netlify.app domain', () => {
    expect(isAllowedWsOrigin('https://699fb6b5d82fe600082bb9e8--the-huddleco.netlify.app', { isProduction: true })).toEqual({
      allowed: true,
      reason: 'netlify_any',
    });
    expect(isAllowedWsOrigin('https://random-site.netlify.app', { isProduction: true })).toEqual({ allowed: true, reason: 'netlify_any' });
  });

  it('rejects unknown origins in production', () => {
    expect(isAllowedWsOrigin('https://malicious.example.com', { isProduction: true })).toEqual({
      allowed: false,
      reason: 'not_allowed',
    });
  });

  it('allows localhost when not in production', () => {
    expect(isAllowedWsOrigin('http://localhost:5174', { isProduction: false })).toEqual({ allowed: true, reason: 'local_dev' });
    expect(isAllowedWsOrigin('http://127.0.0.1:4173', { isProduction: false })).toEqual({ allowed: true, reason: 'local_dev' });
  });

  it('blocks missing origin anywhere', () => {
    expect(isAllowedWsOrigin(undefined, { isProduction: false })).toEqual({ allowed: false, reason: 'missing_origin' });
    expect(isAllowedWsOrigin(undefined, { isProduction: true })).toEqual({ allowed: false, reason: 'missing_origin' });
  });
});
