import { describe, it, expect } from 'vitest';
import { resolveCorsOriginDecision } from '../../server/middleware/cors.js';

describe('CORS middleware', () => {
  it('blocks Netlify preview origin in production', () => {
    process.env.NODE_ENV = 'production';
    const decision = resolveCorsOriginDecision('https://my-branch--the-huddleco.netlify.app');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('not_allowlisted');
  });

  it('allows Netlify preview origin in development', () => {
    process.env.NODE_ENV = 'development';
    const decision = resolveCorsOriginDecision('https://my-branch--the-huddleco.netlify.app');
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('netlify_preview');
  });
});
