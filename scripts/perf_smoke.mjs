import 'dotenv/config';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const port = Number(process.env.PERF_SMOKE_PORT || 8910);
const apiBase = `http://127.0.0.1:${port}`;
const outputBuffer = [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
};

const summarize = (values) => ({
  count: values.length,
  minMs: values.length ? Number(Math.min(...values).toFixed(2)) : null,
  p50Ms: percentile(values, 50),
  p95Ms: percentile(values, 95),
  p99Ms: percentile(values, 99),
  maxMs: values.length ? Number(Math.max(...values).toFixed(2)) : null,
});

const requiredJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const normalizedUrl = String(process.env.SUPABASE_URL || 'http://localhost').replace(/\/+$/, '');
const issuer = `${normalizedUrl}/auth/v1`;

const createAuthHeaders = ({ userId, email, role, platformRole = null }) => {
  if (!requiredJwtSecret) {
    throw new Error('Missing JWT secret for perf smoke auth.');
  }
  const token = jwt.sign(
    {
      sub: userId,
      email,
      role,
      app_metadata: { platform_role: platformRole },
      iss: issuer,
      aud: 'authenticated',
    },
    requiredJwtSecret,
    { algorithm: 'HS256', expiresIn: '15m' },
  );

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-user-id': userId,
    'x-user-role': role,
  };
};

const adminHeaders = () =>
  createAuthHeaders({
    userId: process.env.TEST_PLATFORM_ADMIN_ID || '00000000-0000-0000-0000-000000000001',
    email: process.env.TEST_PLATFORM_ADMIN_EMAIL || 'integration-admin@local',
    role: 'admin',
    platformRole: 'platform_admin',
  });

const learnerHeaders = (userId, email) =>
  createAuthHeaders({
    userId,
    email,
    role: 'member',
  });

const fetchJson = async (path, init = {}) => {
  const started = performance.now();
  const response = await fetch(`${apiBase}${path}`, init);
  const durationMs = performance.now() - started;
  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }
  return { response, body, durationMs: Number(durationMs.toFixed(2)) };
};

const waitForHealth = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiBase}/api/health`);
      if (res.ok || res.status === 503) return;
    } catch {
      // ignore until timeout
    }
    await wait(150);
  }
  throw new Error('Perf smoke server did not become healthy in time.');
};

const measureEndpoint = async (label, path, initFactory, iterations = 10) => {
  const latencies = [];
  for (let i = 0; i < iterations; i += 1) {
    const { response, body, durationMs } = await fetchJson(path, typeof initFactory === 'function' ? initFactory() : initFactory);
    if (!response.ok) {
      throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(body)}`);
    }
    latencies.push(durationMs);
  }
  return [label, summarize(latencies)];
};

const run = async () => {
  const child = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      E2E_TEST_MODE: 'true',
      DEV_FALLBACK: 'false',
      DEMO_MODE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      child.once('exit', resolve);
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 3000);
    });
  };

  child.stdout.on('data', () => {});
  child.stdout.on('data', (chunk) => {
    outputBuffer.push(chunk.toString());
    if (outputBuffer.length > 120) outputBuffer.splice(0, outputBuffer.length - 120);
  });
  child.stderr.on('data', (chunk) => {
    outputBuffer.push(`[stderr] ${chunk.toString()}`);
    if (outputBuffer.length > 120) outputBuffer.splice(0, outputBuffer.length - 120);
  });

  try {
    await waitForHealth();

    const slug = `perf-${randomUUID()}`;
    const moduleId = randomUUID();
    const lessonId = randomUUID();
    const learnerId = randomUUID();
    const learnerEmail = `perf+${slug}@example.com`;

    const createCourse = await fetchJson('/api/admin/courses', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        course: { title: `Perf ${slug}`, slug, status: 'draft' },
        modules: [
          {
            id: moduleId,
            title: 'Perf Module',
            lessons: [
              {
                id: lessonId,
                title: 'Perf Lesson',
                type: 'text',
                content_json: {
                  type: 'text',
                  body: { blocks: [{ type: 'paragraph', data: { text: 'Perf' } }] },
                },
              },
            ],
          },
        ],
      }),
    });

    if (![200, 201].includes(createCourse.response.status)) {
      throw new Error(`Course create failed: ${JSON.stringify(createCourse.body)}`);
    }

    const courseId = createCourse.body?.data?.id;
    if (!courseId) {
      throw new Error(`Course create did not return id: ${JSON.stringify(createCourse.body)}`);
    }

    const publishLatency = [];
    for (let i = 0; i < 5; i += 1) {
      const updateRes = await fetchJson(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          course: { id: courseId, title: `Perf ${slug}`, slug, status: 'published' },
          modules: [
            {
              id: moduleId,
              title: 'Perf Module',
              lessons: [
                {
                  id: lessonId,
                  title: 'Perf Lesson',
                  type: 'text',
                  content_json: {
                    type: 'text',
                    body: { blocks: [{ type: 'paragraph', data: { text: `Perf ${i}` } }] },
                  },
                },
              ],
            },
          ],
        }),
      });
      if (![200, 201].includes(updateRes.response.status)) {
        throw new Error(`Publish update failed: ${JSON.stringify(updateRes.body)}`);
      }
      publishLatency.push(updateRes.durationMs);
    }

    const assignRes = await fetchJson(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        assignedTo: { userIds: [learnerId] },
        status: 'assigned',
      }),
    });
    if (assignRes.response.status !== 200) {
      throw new Error(`Course assign failed: ${JSON.stringify(assignRes.body)}`);
    }

    const results = Object.fromEntries([
      await measureEndpoint('health', '/api/health', {}, 10),
      await measureEndpoint('adminMe', '/api/admin/me', () => ({ headers: adminHeaders() }), 10),
      await measureEndpoint(
        'adminCourses',
        '/api/admin/courses?includeStructure=true&includeLessons=true',
        () => ({ headers: adminHeaders() }),
        10,
      ),
      await measureEndpoint(
        'learnerAssignments',
        '/api/client/assignments?include_completed=true',
        () => ({ headers: learnerHeaders(learnerId, learnerEmail) }),
        10,
      ),
      await measureEndpoint(
        'learnerProgressRead',
        `/api/learner/progress?lessonIds=${encodeURIComponent(lessonId)}&userId=${encodeURIComponent(learnerId)}`,
        () => ({ headers: learnerHeaders(learnerId, learnerEmail) }),
        10,
      ),
      ['publishUpdate', summarize(publishLatency)],
    ]);

    console.log(JSON.stringify({ ok: true, data: results, code: 'perf_smoke_completed', message: 'Performance smoke completed.', meta: null }, null, 2));
  } finally {
    await stop();
  }
};

run().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    data: null,
    code: 'perf_smoke_failed',
    message: error instanceof Error ? error.message : String(error),
    meta: {
      recentOutput: outputBuffer.slice(-40).join(''),
    },
  }, null, 2));
  process.exitCode = 1;
});
