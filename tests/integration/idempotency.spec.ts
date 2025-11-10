import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:8888';
let serverProc: any = null;

async function waitForHealth(timeout = 5000) {
  const deadline = Date.now() + timeout;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Use global fetch (Node 18+) or dynamic import fallback
      const fn = (globalThis as any).fetch ?? (await import('node-fetch')).default;
      const res = await fn(`${API_BASE}/api/health`);
      if (res && (res.status === 200 || res.status === 201)) return;
    } catch (e) {
      // ignore
    }
    if (Date.now() > deadline) throw new Error('Server did not become healthy in time');
    // small sleep
    // eslint-disable-next-line no-await-in-loop
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

  // Pipe server logs into test output for easier debugging if needed
  if (serverProc?.stdout) serverProc.stdout.on('data', (d: any) => {
    // eslint-disable-next-line no-console
    console.log('[srv]', d.toString().trim());
  });
  if (serverProc?.stderr) serverProc.stderr.on('data', (d: any) => {
    // eslint-disable-next-line no-console
    console.error('[srv]', d.toString().trim());
  });

  await waitForHealth(8000);
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

    const fn = (globalThis as any).fetch ?? (await import('node-fetch')).default;

    const res1 = await fn(`${API_BASE}/api/admin/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect([200, 201]).toContain(res1.status);
    const json1 = await res1.json();
    expect(json1).toHaveProperty('data');

    // Retry with same idempotency key should be treated as duplicate
    const res2 = await fn(`${API_BASE}/api/admin/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Server currently responds 409 for duplicate idempotency
    expect(res2.status).toBe(409);
    const json2 = await res2.json();
    expect(json2).toHaveProperty('error', 'idempotency_conflict');
  }, 20000);
});
