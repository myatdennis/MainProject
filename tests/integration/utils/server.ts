import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const repoRoot = path.resolve(__dirname, '../../..');
const demoDataPath = path.join(repoRoot, 'server', 'demo-data.json');

const resolveAfter = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const allocatePort = (() => {
  const explicitPort = Number(process.env.TEST_SERVER_PORT || NaN);
  if (Number.isFinite(explicitPort) && explicitPort > 0) {
    let pinned = explicitPort;
    return () => pinned++;
  }
  const workerId = Number(process.env.VITEST_WORKER_ID || '0');
  let nextPort = 8800 + workerId * 100;
  return () => nextPort++;
})();

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

function resetDemoStore() {
  try {
    if (fs.existsSync(demoDataPath)) {
      fs.rmSync(demoDataPath);
    }
  } catch (error) {
    console.warn('[tests] Failed to reset demo store:', error);
  }
}

async function waitForHealth(apiBase: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      const fn = await resolveFetch();
      const res = await fn(`${apiBase}/api/health`);
      if (res && res.status >= 200 && res.status < 300) return;
      if (res?.status === 503) {
        try {
          const body = await res.json();
          const supabaseDisabled = body?.supabase?.disabled;
          if (supabaseDisabled) return;
        } catch (jsonErr) {
          if (process.env.DEBUG_TEST_SERVER === 'true') {
            console.warn('[tests] Failed to parse health payload:', jsonErr);
          }
        }
      }
      if (process.env.DEBUG_TEST_SERVER === 'true') {
        console.warn(`[tests] Health check responded with status ${res?.status ?? 'unknown'}`);
      }
    } catch (error) {
      if (process.env.DEBUG_TEST_SERVER === 'true') {
        console.warn('[tests] Health check error:', error);
      }
      // ignore until timeout
    }
    await resolveAfter(150);
  }
  throw new Error('Server did not become healthy in time');
}

export type TestServerHandle = {
  port: number;
  apiBase: string;
  fetch: (path: string, init?: Record<string, any>) => Promise<any>;
  stop: () => Promise<void>;
  process: ChildProcess;
};

export async function startTestServer({ resetDemo = true }: { resetDemo?: boolean } = {}): Promise<TestServerHandle> {
  if (resetDemo) resetDemoStore();
  const port = allocatePort();
  const apiBase = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    E2E_TEST_MODE: 'true',
    DEV_FALLBACK: 'true',
  };

  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk) => {
    if (process.env.DEBUG_TEST_SERVER === 'true') {
      process.stdout.write(`[srv:${port}] ${chunk}`);
    }
  });
  child.stderr?.on('data', (chunk) => {
    if (process.env.DEBUG_TEST_SERVER === 'true') {
      process.stderr.write(`[srv:${port} err] ${chunk}`);
    }
  });

  await waitForHealth(apiBase);

  const fetcher = async (path: string, init?: Record<string, any>) => {
    const fn = await resolveFetch();
    return fn(`${apiBase}${path}`, init);
  };

  const stop = async () => {
    if (child.killed) return;
    child.kill();
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
        resolve();
      }, 3000);
    });
  };

  return { port, apiBase, fetch: fetcher, stop, process: child };
}

export async function stopTestServer(handle?: TestServerHandle | null) {
  if (!handle) return;
  await handle.stop();
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars';

type TokenClaims = Partial<{ userId: string; email: string; role: string }>;

function buildAuthHeaders(claims: TokenClaims = {}) {
  const token = jwt.sign(
    {
      userId: claims.userId || 'integration-user',
      email: claims.email || 'integration@tests.local',
      role: claims.role || 'member',
    },
    JWT_SECRET,
    {
      expiresIn: 60 * 60,
      issuer: 'lms-platform',
      audience: 'lms-users',
    }
  );
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function createAdminAuthHeaders(claims: Partial<{ userId: string; email: string }> = {}) {
  return buildAuthHeaders({ ...claims, role: 'admin' });
}

export function createMemberAuthHeaders(claims: TokenClaims = {}) {
  return buildAuthHeaders({ ...claims, role: claims.role || 'member' });
}
