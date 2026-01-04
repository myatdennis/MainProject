import { describe, expect, it } from 'vitest';
import { isAllowedWsOrigin } from './wsOrigins.js';

describe('isAllowedWsOrigin', () => {
  it('allows primary production domains', () => {
    expect(isAllowedWsOrigin('https://the-huddle.co', { isProduction: true })).toBe(true);
    expect(isAllowedWsOrigin('https://www.the-huddle.co', { isProduction: true })).toBe(true);
  });

  it('allows matching Netlify deploy preview domains', () => {
    expect(isAllowedWsOrigin('https://deploy-preview-42--the-huddleco.netlify.app', { isProduction: true })).toBe(true);
  });

  it('rejects other netlify domains', () => {
    expect(isAllowedWsOrigin('https://random-site.netlify.app', { isProduction: true })).toBe(false);
    expect(isAllowedWsOrigin('https://deploy-preview-fake--another.netlify.app', { isProduction: true })).toBe(false);
  });

  it('rejects unknown origins in production', () => {
    expect(isAllowedWsOrigin('https://malicious.example.com', { isProduction: true })).toBe(false);
  });

  it('allows localhost when not in production', () => {
    expect(isAllowedWsOrigin('http://localhost:5174', { isProduction: false })).toBe(true);
    expect(isAllowedWsOrigin('http://127.0.0.1:4173', { isProduction: false })).toBe(true);
  });

  it('allows missing origin only outside production', () => {
    expect(isAllowedWsOrigin(undefined, { isProduction: false })).toBe(true);
    expect(isAllowedWsOrigin(undefined, { isProduction: true })).toBe(false);
  });
});
