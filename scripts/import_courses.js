#!/usr/bin/env node
/*
  Batch import courses into the Admin API.
  Usage:
    node scripts/import_courses.js path/to/file.json [--publish] [--dedupe] [--wait --wait-timeout 15000] [--dry-run]

  The script forwards the JSON payload directly to POST /api/admin/courses/import
  and prints the payload, response, and any validation errors for easier debugging.
*/

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || null;
let cachedAdminToken = process.env.ADMIN_TOKEN?.trim() || null;

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.API_URL ||
  process.env.SERVER_URL ||
  'https://api.the-huddle.co/api'
).replace(/\/+$/, '');
const IMPORT_ENDPOINT = `${API_BASE}/admin/courses/import`;
const LOGIN_ENDPOINT = `${API_BASE}/auth/login`;
const INPUT = process.argv[2] || 'import/courses-template.json';
const PUBLISH = process.argv.includes('--publish');
const DEDUPE = process.argv.includes('--dedupe') || process.argv.includes('--upsert-by=slug');
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const WAIT = process.argv.includes('--wait');
const WAIT_TIMEOUT_MS = (() => {
  const idx = process.argv.findIndex((arg) => arg === '--wait-timeout');
  if (idx !== -1 && process.argv[idx + 1]) {
    const timeout = parseInt(process.argv[idx + 1], 10);
    if (Number.isFinite(timeout) && timeout > 0) return timeout;
  }
  return 10000;
})();

const resolveJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function loginAndFetchToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'Provide ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD environment variables to authenticate the importer.',
    );
  }

  console.log(`[auth] Logging in via ${LOGIN_ENDPOINT} as ${ADMIN_EMAIL}`);
  const response = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const payload = await resolveJson(response);
  if (!response.ok) {
    console.error('[auth] Login failed:', typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
    throw new Error('Unable to obtain admin access token. Check credentials or ADMIN_TOKEN.');
  }
  const token = payload?.accessToken || payload?.session?.access_token || null;
  if (!token) {
    console.error('[auth] Login response missing accessToken:', JSON.stringify(payload, null, 2));
    throw new Error('Login succeeded but no access token was returned.');
  }
  console.log('[auth] Obtained access token from /auth/login');
  return token;
}

async function resolveAdminToken() {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }
  cachedAdminToken = await loginAndFetchToken();
  return cachedAdminToken;
}

async function buildAuthHeaders(extra = {}) {
  const token = await resolveAdminToken();
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

function readJson(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  return JSON.parse(raw);
}

function buildImportPayload(rawInput) {
  if (Array.isArray(rawInput)) {
    return { items: rawInput };
  }
  if (rawInput && typeof rawInput === 'object') {
    // Preserve any existing top-level flags (publish, overwrite, etc.)
    const payload = { ...rawInput };
    if (Array.isArray(payload.items) || Array.isArray(payload.courses)) {
      return payload;
    }
    if (payload.course || payload.modules) {
      return { items: [payload] };
    }
  }
  throw new Error('Input file must contain an array, { items: [...] }, or { courses: [...] }');
}

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  const url = `${API_BASE}/health`;
  let endpointMissing = false;
  while (Date.now() - start < timeoutMs) {
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(url, { headers, credentials: 'include' });
      if (res.status === 404 || res.status === 405) {
        console.warn(`[health-check] ${url} not available (${res.status}); skipping health check.`);
        endpointMissing = true;
        break;
      }
      if (res.ok) return true;
    } catch (err) {
      // Ignore and retry until timeout
      console.warn('[health-check] request failed:', err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return endpointMissing;
}

async function sendImportRequest(payload) {
  console.log(`\n[import] POST ${IMPORT_ENDPOINT}`);
  console.log('[import] Request payload (redacted only by JSON.stringify):');
  console.log(JSON.stringify(payload, null, 2));

  if (DRY_RUN) {
    console.log('[import] Dry run enabled; skipping API request.');
    return;
  }

  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  const parsedBody = await resolveJson(response);

  const prettyBody = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody, null, 2);

  if (!response.ok) {
    console.error(`[import] HTTP ${response.status} ${response.statusText}`);
    console.error('[import] Response body:', prettyBody || '(empty)');
    if (response.status === 422 && parsedBody?.details) {
      console.error('[import] Validation details:');
      parsedBody.details.forEach((detail, idx) => {
        console.error(`  [${idx}]`, JSON.stringify(detail));
      });
    }
    throw new Error('Import request failed. See logs above for details.');
  }

  console.log('[import] Success response:');
  console.log(prettyBody || '(empty body)');
}

async function importCourses() {
  if (WAIT) {
    const healthy = await waitForHealth(WAIT_TIMEOUT_MS);
    if (!healthy) {
      console.error(`Server not healthy at ${API_BASE} within ${WAIT_TIMEOUT_MS}ms`);
      process.exit(1);
    }
  }

  const rawInput = readJson(INPUT);
  const payload = buildImportPayload(rawInput);
  if (PUBLISH) {
    payload.publish = true;
    if (!payload.publishMode) payload.publishMode = 'published';
  }
  if (DEDUPE) {
    payload.overwrite = true;
  }

  await sendImportRequest(payload);
}

if (typeof fetch !== 'function') {
  console.error('This script requires Node 18+ (global fetch). Please upgrade Node or add a fetch polyfill.');
  process.exit(1);
}

importCourses().catch((err) => {
  console.error('Unexpected error during import:', err);
  process.exit(1);
});
