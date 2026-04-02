import 'dotenv/config';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
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
    E2E_TEST_MODE: 'false',
    DEV_FALLBACK: 'false',
    DEMO_MODE: 'false',
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

async function createSupabaseUserIfMissing(email: string, password: string, role = 'admin') {
  const supabaseUrl = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !svcKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svcKey}`,
        apikey: svcKey,
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: { role, email },
      }),
    });
    if (response.ok) {
      return true;
    }
    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    // If the user already exists, not an error for us.
    if (
      (typeof data.message === 'string' && data.message.includes('already exists')) ||
      data.code === 'PGRST116' ||
      Boolean(data.request_id)
    ) {
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[tests] createSupabaseUserIfMissing failed', error);
    return false;
  }
}

async function createSupabaseJwt(claims: Record<string, any> = {}) {
  const requiredJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (process.env.NODE_ENV === 'test' && requiredJwtSecret && supabaseUrl) {
    const normalizedUrl = String(supabaseUrl).replace(/\/+$/, '');
    const iss = `${normalizedUrl}/auth/v1`;
    const payload: Record<string, any> = {
      sub: claims.userId || claims.email || 'test-user',
      email: claims.email || 'test-user@local',
      role: claims.role || 'admin',
      app_metadata: { platform_role: (claims.role || 'admin') === 'admin' ? 'platform_admin' : null },
      iss,
      aud: 'authenticated',
    };
    return jwt.sign(payload, requiredJwtSecret, { algorithm: 'HS256', expiresIn: '15m' });
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const email = claims.email || 'integration@tests.local';
  const password = process.env.TEST_SUPABASE_PASSWORD || 'admin123';

  if (!supabaseUrl || !svcKey) {
    const role = typeof claims.role === 'string' && claims.role.length > 0 ? claims.role : 'member';
    return role === 'admin' ? 'e2e-access-token' : 'member-access-token';
  }

  const getToken = async () => {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: svcKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      throw { response, data };
    }
    return data.access_token;
  };

  try {
    return await getToken();
  } catch (error: any) {
    const data = (error?.data ?? {}) as Record<string, any>;
    const invalidCredentials =
      data?.error_code === 'invalid_credentials' ||
      (typeof data?.msg === 'string' && data.msg.includes('Invalid login credentials'));
    if (invalidCredentials) {
      const created = await createSupabaseUserIfMissing(email, password, claims.role || 'admin');
      if (created) {
        try {
          return await getToken();
        } catch (retryError: any) {
          const retryData = (retryError?.data || {}) as Record<string, any>;
          throw new Error(
            `Failed to fetch Supabase token (after user creation): ${retryError?.response?.status ?? 'unknown'} ${JSON.stringify(retryData)}`
          );
        }
      }
    }
    throw new Error(
      `Failed to fetch Supabase token: ${error?.response?.status ?? 'unknown'} ${JSON.stringify(data || error)}`
    );
  }
}

async function buildAuthHeaders(claims: Record<string, any> = {}) {
  const token = await createSupabaseJwt(claims);
  return { Authorization: `Bearer ${token}` };
}

export async function createAdminAuthHeaders(claims: Partial<{ email: string }> = {}) {
  return buildAuthHeaders({ ...claims, role: 'admin' });
}

export async function createMemberAuthHeaders(claims: Partial<{ email: string; role: string }> = {}) {
  return buildAuthHeaders({ ...claims, role: claims.role || 'member' });
}
