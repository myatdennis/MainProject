import { describe, expect, it } from 'vitest';
import corsMiddleware, { resolveCorsOriginDecision } from '../../middleware/cors.js';

const runMiddleware = (req) => {
  const headers = new Map();
  const res = {
    header(key, value) {
      headers.set(key, value);
      return this;
    },
    setHeader(key, value) {
      headers.set(key, value);
    },
    getHeader(key) {
      return headers.get(key);
    },
    get(key) {
      return headers.get(key);
    },
  };
  return new Promise((resolve, reject) => {
    corsMiddleware(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(headers);
    });
  });
};

describe('cors middleware', () => {
  it('allows configured production origins', () => {
    const decision = resolveCorsOriginDecision('https://the-huddle.co');
    expect(decision.allowed).toBe(true);
    expect(decision.resolvedOrigin).toBe('https://the-huddle.co');
  });

  it('attaches credentials and origin headers for allowed origin', async () => {
    const headers = await runMiddleware({
      method: 'GET',
      headers: { origin: 'https://the-huddle.co' },
      path: '/api/test',
    });

    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://the-huddle.co');
    expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(headers.get('Vary')).toMatch(/Origin/);
  });
});
