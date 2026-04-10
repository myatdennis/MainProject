import 'dotenv/config';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const repoRoot = path.resolve(__dirname, '../../..');
const demoDataPath = path.join(repoRoot, 'server', 'demo-data.json');

const resolveAfter = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRecoverableTestInfraError = (error: any) => {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || error?.cause?.message || '');
  return (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNREFUSED') ||
    message.includes('SELF_SIGNED_CERT_IN_CHAIN')
  );
};

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
  // Prefer node-fetch over Node's built-in fetch (undici) for test stability.
  // Some sandboxed environments block undici's socket connections (EPERM) even for localhost.
  cachedFetch = (fetch as unknown) as FetchLike;
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

async function waitForHealth(apiBase: string, timeoutMs = 30_000) {
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

export async function startTestServer({ resetDemo = true, idempotencyFallback = false }: { resetDemo?: boolean; idempotencyFallback?: boolean } = {}): Promise<TestServerHandle> {
  if (resetDemo) resetDemoStore();
  await ensureTestEnvironment({ idempotencyFallback });

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const port = allocatePort();
    const apiBase = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      E2E_TEST_MODE: 'true',
      DEV_FALLBACK: 'false',
      DEMO_MODE: 'false',
      TEST_IDEMPOTENCY_FALLBACK_MODE: String(idempotencyFallback),
    };

    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outputBuffer: string[] = [];
    const appendOutput = (prefix: string, chunk: Buffer | string) => {
      const text = `${prefix}${chunk.toString()}`;
      outputBuffer.push(text);
      if (outputBuffer.length > 200) {
        outputBuffer.splice(0, outputBuffer.length - 200);
      }
    };

    child.stdout?.on('data', (chunk) => {
      appendOutput('', chunk);
      if (process.env.DEBUG_TEST_SERVER === 'true') {
        process.stdout.write(`[srv:${port}] ${chunk}`);
      }
    });
    child.stderr?.on('data', (chunk) => {
      appendOutput('[stderr] ', chunk);
      if (process.env.DEBUG_TEST_SERVER === 'true') {
        process.stderr.write(`[srv:${port} err] ${chunk}`);
      }
    });

    child.once('exit', (code, signal) => {
      if (process.env.DEBUG_TEST_SERVER === 'true') return;
      const tail = outputBuffer.slice(-40).join('');
      if (tail.trim()) {
        process.stderr.write(
          `[tests] server ${port} exited unexpectedly (code=${code ?? 'null'} signal=${signal ?? 'null'})\n${tail}\n`,
        );
      }
    });

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

    try {
      await waitForHealth(apiBase);

      const fetcher = async (path: string, init?: Record<string, any>) => {
        const fn = await resolveFetch();
        try {
          return await fn(`${apiBase}${path}`, init);
        } catch (error) {
          const tail = outputBuffer.slice(-60).join('');
          if (tail.trim()) {
            process.stderr.write(
              `[tests] fetch to ${apiBase}${path} failed; recent server output follows:\n${tail}\n`,
            );
          }
          throw error;
        }
      };

      return { port, apiBase, fetch: fetcher, stop, process: child };
    } catch (error) {
      lastError = error;
      await stop();
      const isLastAttempt = attempt === 2;
      if (isLastAttempt) {
        break;
      }
      if (process.env.DEBUG_TEST_SERVER === 'true') {
        console.warn(`[tests] startTestServer retrying after failed health check on port ${port}`, error);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to start test server');
}

export async function stopTestServer(handle?: TestServerHandle | null) {
  if (!handle) return;
  await handle.stop();
}

const TEST_ORGANIZATION_ID = process.env.TEST_ORGANIZATION_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
const TEST_USERS = {
  platformAdmin: {
    id: process.env.TEST_PLATFORM_ADMIN_ID || '00000000-0000-0000-0000-000000000001',
    email: process.env.TEST_PLATFORM_ADMIN_EMAIL || 'integration-admin@local',
    role: 'admin',
    platformRole: 'platform_admin',
    password: process.env.TEST_PLATFORM_ADMIN_PASSWORD || 'Admin123!',
    organizationId: TEST_ORGANIZATION_ID,
  },
  orgAdmin: {
    id: process.env.TEST_ORG_ADMIN_ID || '00000000-0000-0000-0000-000000000002',
    email: process.env.TEST_ORG_ADMIN_EMAIL || 'integration-org-admin@local',
    role: 'admin',
    platformRole: null,
    password: process.env.TEST_ORG_ADMIN_PASSWORD || 'OrgAdmin123!',
    organizationId: TEST_ORGANIZATION_ID,
  },
  learner: {
    id: process.env.TEST_LEARNER_ID || '00000000-0000-0000-0000-000000000003',
    email: process.env.TEST_LEARNER_EMAIL || 'integration-learner@local',
    role: 'member',
    platformRole: null,
    password: process.env.TEST_LEARNER_PASSWORD || 'Learner123!',
    organizationId: TEST_ORGANIZATION_ID,
  },
};

type TestUser = {
  id: string;
  email: string;
  role: string;
  platformRole: string | null;
  password: string;
  organizationId: string;
};

let supabaseAdminClient: any = null;

export const getSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !svcKey) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });
  }
  return supabaseAdminClient;
};

async function ensureTestOrganization() {
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    const { data, error } = await (client as any)
      .from('organizations')
      .select('id')
      .eq('id', TEST_ORGANIZATION_ID)
      .maybeSingle();
    if (error) {
      console.warn('[tests] Could not verify test organization', error);
      return;
    }
    if (!data) {
      await (client as any).from('organizations').insert([{ id: TEST_ORGANIZATION_ID, name: 'Integration Test Organization', slug: 'integration-test-org', status: 'active' }]);
    }
  } catch (error) {
    console.warn('[tests] Failed to ensure test organization', error);
  }
}

async function ensureSupabaseUser(user: TestUser) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !svcKey) return;

  // Ensure auth user exists (idempotent with REST API semantics)
  const userPayload: Record<string, any> = {
    id: user.id,
    email: user.email,
    password: user.password,
    email_confirmed: true,
    user_metadata: { role: user.role, platform_role: user.platformRole },
  };

  try {
    await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svcKey}`,
        apikey: svcKey,
      },
      body: JSON.stringify(userPayload),
    });
  } catch (error) {
    console.warn('[tests] failed to provision supabase auth user', { user: user.email, error });
  }

  const client = getSupabaseAdminClient();
  if (!client) return;

  try {
    await (client as any)
      .from('user_profiles')
      .upsert({ id: user.id, email: user.email, role: user.role, is_admin: user.role === 'admin' }, { onConflict: 'id' });
  } catch (error) {
    console.warn('[tests] failed to provision user_profiles row', { user: user.email, error });
  }

  try {
    await (client as any)
      .from('organization_memberships')
      .upsert(
        { organization_id: user.organizationId, user_id: user.id, role: user.role, status: 'active' },
        { onConflict: '(organization_id,user_id)' }
      );
  } catch (error) {
    console.warn('[tests] failed to provision organization_memberships row', { user: user.email, error });
  }
}

async function ensureIdempotencyTableAbsent() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_POOLER_URL) return;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL;
  const { Client } = await import('pg');
  const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query(`DROP TABLE IF EXISTS public.idempotency_keys`);
    console.info('[tests] dropped idempotency_keys table for fallback mode');
  } catch (error) {
    console.warn('[tests] failed to drop idempotency_keys table', error);
  } finally {
    await db.end();
  }
}

async function ensureIdempotencyTableExists() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_POOLER_URL) return;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL;
  const { Client } = await import('pg');
  const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  const advisoryLockId = 545912353; // deterministic key for idempotency table setup
  let lockAcquired = false;
  try {
    await db.connect();
    // Ensure we can acquire the advisory lock in a non-blocking manner with retries.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await db.query("SET LOCAL statement_timeout = '15000'");
      const lockResult = await db.query('SELECT pg_try_advisory_lock($1) AS acquired', [advisoryLockId]);
      const acquired = lockResult?.rows?.[0]?.acquired;
      if (acquired) {
        lockAcquired = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!lockAcquired) {
      console.warn('[idempotency-table] unable to acquire advisory lock; proceeding without lock');
    }

    const existingResult = await db.query(`SELECT to_regclass('public.idempotency_keys') AS existing`);
    const tableExists = Boolean(existingResult?.rows?.[0]?.existing);
    console.info('[idempotency-table] exists_check', { tableExists });

    if (tableExists) {
      console.info('[idempotency-table] no-op needed (already exists)');
      return;
    }

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS public.idempotency_keys (
          id text PRIMARY KEY,
          key_type text,
          resource_id uuid,
          payload jsonb,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
      `);
    } catch (createError) {
      const pgError = createError as any;
      const isTypeConflict =
        (pgError?.code === '23505' && String(pgError?.message || '').includes('pg_type_typname_nsp_index')) ||
        (pgError?.code === '42710' && String(pgError?.message || '').toLowerCase().includes('type "idempotency_keys" already exists'));
      if (isTypeConflict) {
        console.warn('[idempotency-table] type conflict detected on create, repairing...', { createError });
        await db.query(`DROP TABLE IF EXISTS public.idempotency_keys CASCADE;`);
        await db.query(`DROP TYPE IF EXISTS public.idempotency_keys CASCADE;`);
        await db.query(`
          CREATE TABLE IF NOT EXISTS public.idempotency_keys (
            id text PRIMARY KEY,
            key_type text,
            resource_id uuid,
            payload jsonb,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
        `);
        console.info('[idempotency-table] repaired and ensured existence');
      } else {
        throw createError;
      }
    }

    const verify = await db.query(`SELECT to_regclass('public.idempotency_keys') AS existing`);
    if (!verify?.rows?.[0]?.existing) {
      throw new Error('idempotency_keys table does not exist after creation attempt');
    }

    const supabaseClient = getSupabaseAdminClient();
    if (supabaseClient) {
      try {
        await (supabaseClient as any).from('idempotency_keys').select('id').limit(1);
        console.info('[idempotency-table] cache primed via supabase client');
      } catch (cacheError) {
        console.warn('[idempotency-table] failed to prime schema cache', cacheError);
      }
    }

    console.info('[idempotency-table] create_if_missing');
  } catch (error) {
    console.error('[idempotency-table] ensure_failed', error);
    throw error;
  } finally {
    if (lockAcquired) {
      try {
        await db.query('SELECT pg_advisory_unlock($1)', [advisoryLockId]);
      } catch (unlockError) {
        console.warn('[idempotency-table] advisory unlock failed', unlockError);
      }
    }
    await db.end();
  }
}

async function ensureTestEnvironment({ idempotencyFallback = false }: { idempotencyFallback?: boolean } = {}) {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return;
  }

  try {
    await ensureTestOrganization();
  } catch (error) {
    if (isRecoverableTestInfraError(error)) {
      console.warn('[tests] skipping remote organization bootstrap due unavailable DB/network', error);
    } else {
      throw error;
    }
  }

  try {
    await ensureIdempotencyTableExists();
  } catch (error) {
    if (isRecoverableTestInfraError(error)) {
      console.warn('[tests] skipping remote idempotency table bootstrap due unavailable DB/network', error);
    } else {
      throw error;
    }
  }

  for (const user of Object.values(TEST_USERS)) {
    try {
      await ensureSupabaseUser(user);
    } catch (error) {
      if (isRecoverableTestInfraError(error)) {
        console.warn('[tests] skipping remote user bootstrap due unavailable DB/network', {
          user: user.email,
          error,
        });
        continue;
      }
      throw error;
    }
  }
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
    if (response.ok) return true;
    const body = (await response.json()) as any;
    if (body && typeof body.message === 'string' && body.message.includes('duplicate key')) return true;
    console.warn('[tests] createSupabaseUserIfMissing failed', { email, role, body });
  } catch (error) {
    console.warn('[tests] createSupabaseUserIfMissing error', { email, role, error });
  }

  return false;
}

async function createTestUsersIfMissing() {
  for (const user of Object.values(TEST_USERS)) {
    await createSupabaseUserIfMissing(user.email, user.password, user.role);
  }
}

async function setupTestEnvironment() {
  resetDemoStore();
  await ensureTestEnvironment();
}

async function teardownTestEnvironment() {
  resetDemoStore();
}

export async function initTestEnvironment() {
  setupTestEnvironment();
  if (process.env.DEBUG_TEST_SERVER === 'true') {
    console.log('[tests] Debug mode enabled, skipping environment setup');
  } else {
    await setupTestEnvironment();
  }
}

export async function cleanupTestEnvironment() {
  teardownTestEnvironment();
  if (process.env.DEBUG_TEST_SERVER === 'true') {
    console.log('[tests] Debug mode enabled, skipping environment cleanup');
  } else {
    await teardownTestEnvironment();
  }
}

export async function createTestOrganization() {
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    await client
      .from('organizations')
      .insert([{ id: TEST_ORGANIZATION_ID, name: 'Integration Test Organization', slug: 'integration-test-org', status: 'active' }]);
  } catch (error) {
    console.warn('[tests] Failed to create test organization', error);
  }
}

export async function getJwtToken(user: TestUser) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !svcKey) return null;

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    org_id: user.organizationId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };

  return jwt.sign(payload, svcKey, { algorithm: 'HS256' });
}

async function createSupabaseJwt(claims: Record<string, any> = {}) {
  const requiredJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (process.env.NODE_ENV === 'test' && requiredJwtSecret) {
    const normalizedUrl = supabaseUrl ? String(supabaseUrl).replace(/\/+$|$/, '') : 'http://localhost';
    const iss = `${normalizedUrl}/auth/v1`;

    const effectiveRole = (claims.role || 'admin').toLowerCase();
    const effectivePlatformRole =
      claims.platformRole ??
      claims.platform_role ??
      (claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata.platform_role : null) ??
      (claims.appMetadata && typeof claims.appMetadata === 'object' ? claims.appMetadata.platform_role : null) ??
      null;

    let testUser: TestUser;
    if (effectiveRole === 'member') {
      testUser = TEST_USERS.learner;
    } else if (effectivePlatformRole === 'platform_admin') {
      testUser = TEST_USERS.platformAdmin;
    } else {
      testUser = TEST_USERS.orgAdmin;
    }

    const normalizedPlatformRole =
      typeof effectivePlatformRole === 'string' && effectivePlatformRole.trim()
        ? effectivePlatformRole.trim().toLowerCase()
        : null;

    const payload: Record<string, any> = {
      ...claims,
      sub: claims.userId || testUser.id,
      email: claims.email || testUser.email,
      role: claims.role || testUser.role,
      app_metadata: {
        ...(claims.app_metadata || {}),
        ...(normalizedPlatformRole ? { platform_role: normalizedPlatformRole } : {}),
      },
      iss,
      aud: 'authenticated',
    };
    return jwt.sign(payload, requiredJwtSecret, { algorithm: 'HS256', expiresIn: '15m' });
  }

  return null;
}

export async function buildAuthHeaders(claims: Partial<{ userId: string; email: string; role: string; platformRole: string }> = {}) {
  const token = await createSupabaseJwt(claims);
  if (!token) return {} as Record<string, string>;
  return { Authorization: `Bearer ${token}` };
}

export async function createAdminAuthHeaders(claims: Partial<{ email: string }> = {}) {
  return buildAuthHeaders({ ...claims, role: 'admin', platformRole: 'platform_admin' });
}

export async function createMemberAuthHeaders(claims: Partial<{ userId: string; email: string; role: string }> = {}) {
  return buildAuthHeaders({ ...claims, role: claims.role || 'member' });
}
