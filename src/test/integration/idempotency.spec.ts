import { spawn } from 'child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:8888';
let serverProc: any = null;
let adminAuthHeader: string | null = null;

type FetchLike = (input: string, init?: Record<string, any>) => Promise<any>;
let cachedFetch: FetchLike | null = null;

async function resolveFetch(): Promise<FetchLike> {
  if (cachedFetch) return cachedFetch;
  if (typeof globalThis.fetch === 'function') {
    cachedFetch = globalThis.fetch.bind(globalThis) as FetchLike;
    return cachedFetch;
  }
  const mod = await import('node-fetch');
  const impl = (mod as any).default ?? mod;
  cachedFetch = impl as FetchLike;
  return cachedFetch;
}

async function waitForHealth(timeout = 5000) {
  const deadline = Date.now() + timeout;
   
  while (true) {
    try {
      const fn = await resolveFetch();
      const res = await fn(`${API_BASE}/api/health`);
      if (res && (res.status === 200 || res.status === 201)) return;
    } catch (e) {
      // ignore
    }
    if (Date.now() > deadline) throw new Error('Server did not become healthy in time');
    // small sleep
     
    await new Promise((r) => setTimeout(r, 150));
  }
}

beforeAll(async () => {
  // Start server in E2E demo mode so it uses in-memory stores and RLS-free path
  serverProc = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: '8888', E2E_TEST_MODE: 'true', DEV_FALLBACK: 'true' },
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (serverProc?.stdout) serverProc.stdout.on('data', (d: any) => {
     
    console.log('[srv]', d.toString().trim());
  });
  if (serverProc?.stderr) serverProc.stderr.on('data', (d: any) => {
     
    console.error('[srv]', d.toString().trim());
  });

  await waitForHealth(8000);

  // Fetch a demo admin token so admin APIs receive an Authorization header even in fallback mode
  try {
    const fn = await resolveFetch();
    const loginRes = await fn(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: 'mya@the-huddle.co',
        password: 'admin123',
        type: 'admin',
      }),
    });
    if (loginRes.ok) {
      const payload = await loginRes.json();
      if (payload?.accessToken) {
        adminAuthHeader = `Bearer ${payload.accessToken}`;
      }
    } else {
      console.warn('[integration] Failed to bootstrap admin token for idempotency tests:', loginRes.status);
    }
  } catch (err) {
    console.warn('[integration] Unable to login admin demo user:', err);
  }
});

afterAll(() => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
});

describe('Idempotency keys (integration)', () => {
  it('should accept a course upsert and reject duplicate idempotency_key', async () => {
    const body = {
      course: { title: 'Integration Test Course' },
      modules: [],
      idempotency_key: 'itest-key-1'
    };

    const fn = await resolveFetch();

    const res1 = await fn(`${API_BASE}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminAuthHeader ? { Authorization: adminAuthHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    expect([200, 201]).toContain(res1.status);
    const json1 = await res1.json();
    expect(json1).toHaveProperty('data');

    // Retry with same idempotency key should be treated idempotently.
    // Accept either a 409 conflict OR a successful idempotent response returning the existing resource.
    const res2 = await fn(`${API_BASE}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminAuthHeader ? { Authorization: adminAuthHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const json2 = await res2.json();
    if (res2.status === 409) {
      expect(json2).toHaveProperty('error', 'idempotency_conflict');
    } else {
      expect([200, 201]).toContain(res2.status);
      expect(json2).toHaveProperty('data');
      expect(json2).toHaveProperty('idempotent', true);
    }
  }, 20000);
});
