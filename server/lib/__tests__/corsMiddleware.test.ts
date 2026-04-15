import { describe, expect, it } from 'vitest';
import corsMiddleware, { resolveCorsOriginDecision } from '../../middleware/cors.js';

interface MockRequest {
  method: string;
  headers: Record<string, string>;
  path: string;
}

interface MockRes {
  header(key: string, value: string): this;
  setHeader(key: string, value: string): void;
  getHeader(key: string): string | undefined;
  get(key: string): string | undefined;
}

const runMiddleware = (req: MockRequest): Promise<Map<string, string>> => {
  const headers = new Map<string, string>();
  const res: MockRes = {
    header(key: string, value: string) {
      headers.set(key, value);
      return this;
    },
    setHeader(key: string, value: string): void {
      headers.set(key, value);
    },
    getHeader(key: string): string | undefined {
      return headers.get(key);
    },
    get(key: string): string | undefined {
      return headers.get(key);
    },
  };
  return new Promise<Map<string, string>>((resolve, reject) => {
    corsMiddleware(req, res, (err: unknown) => {
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

  it('allows local development origins when not in production', () => {
    const decision = resolveCorsOriginDecision('http://127.0.0.1:3000');
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('local_dev');
  });

  it('attaches credentials and origin headers for local dev origin', async () => {
    const headers = await runMiddleware({
      method: 'GET',
      headers: { origin: 'http://127.0.0.1:3000' },
      path: '/api/test',
    });

    expect(headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000');
    expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(headers.get('Vary')).toMatch(/Origin/);
  });
});
