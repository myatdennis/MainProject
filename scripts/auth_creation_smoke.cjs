#!/usr/bin/env node
const crypto = require('node:crypto');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:8787';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;
const ORG_ID = process.env.SMOKE_ORG_ID;
const SKIP_IF_MISSING = process.env.SMOKE_SKIP_IF_MISSING === '1';

const NEW_USER_EMAIL =
  process.env.SMOKE_NEW_USER_EMAIL || `smoke+${Date.now()}-${crypto.randomUUID().slice(0, 6)}@example.com`;
const NEW_USER_PASSWORD =
  process.env.SMOKE_NEW_USER_PASSWORD || `Smoke!${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}A1`;

const requireEnv = (name, value) => {
  if (value) return;
  console.error(`[auth-creation-smoke] Missing ${name}`);
};

const ensureEnv = () => {
  requireEnv('SMOKE_ADMIN_EMAIL', ADMIN_EMAIL);
  requireEnv('SMOKE_ADMIN_PASSWORD', ADMIN_PASSWORD);
  requireEnv('SMOKE_ORG_ID', ORG_ID);

  if (ADMIN_EMAIL && ADMIN_PASSWORD && ORG_ID) {
    return true;
  }

  if (SKIP_IF_MISSING) {
    console.warn('[auth-creation-smoke] Skipping because required env vars are missing.');
    return false;
  }

  process.exit(1);
};

const parseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const getCookieHeader = (response) => {
  let cookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    cookies = response.headers.getSetCookie();
  } else {
    const header = response.headers.get('set-cookie');
    if (header) cookies = [header];
  }

  if (!Array.isArray(cookies) || cookies.length === 0) return '';
  return cookies.map((entry) => entry.split(';')[0]).join('; ');
};

const request = async (path, options = {}) => {
  const url = new URL(path, BASE_URL);
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  });
  const text = await res.text();
  return { res, text, json: parseJson(text) };
};

const expectStatus = (res, accepted, label, body) => {
  if (!accepted.includes(res.status)) {
    throw new Error(`[${label}] Expected ${accepted.join('/')} but got ${res.status}: ${body}`);
  }
};

const run = async () => {
  if (!ensureEnv()) return;

  console.log('[auth-creation-smoke] Logging in as admin...');
  const adminLoginPayload = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(adminLoginPayload),
    },
    body: adminLoginPayload,
  });
  expectStatus(adminLogin.res, [200], 'admin_login', adminLogin.text);

  const adminCookies = getCookieHeader(adminLogin.res);
  if (!adminCookies) {
    throw new Error('[admin_login] Missing auth cookies');
  }

  console.log('[auth-creation-smoke] Creating new user + setup link...');
  const createPayload = JSON.stringify({
    orgId: ORG_ID,
    firstName: 'Smoke',
    lastName: 'User',
    email: NEW_USER_EMAIL,
    password: NEW_USER_PASSWORD,
    membershipRole: 'member',
  });

  const createUser = await request('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createPayload),
      Cookie: adminCookies,
    },
    body: createPayload,
  });
  expectStatus(createUser.res, [200, 201], 'admin_users_create', createUser.text);

  const setupLink = createUser.json?.setupLink;
  if (!setupLink) {
    throw new Error('[admin_users_create] Missing setupLink in response');
  }

  console.log('[auth-creation-smoke] Logging in as newly created user...');
  const userLoginPayload = JSON.stringify({ email: NEW_USER_EMAIL, password: NEW_USER_PASSWORD });
  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(userLoginPayload),
    },
    body: userLoginPayload,
  });
  expectStatus(userLogin.res, [200], 'user_login', userLogin.text);

  const userCookies = getCookieHeader(userLogin.res);
  if (!userCookies) {
    throw new Error('[user_login] Missing auth cookies');
  }

  console.log('[auth-creation-smoke] Fetching /api/client/courses...');
  const courses = await request('/api/client/courses', {
    headers: {
      Cookie: userCookies,
    },
  });
  expectStatus(courses.res, [200], 'client_courses', courses.text);

  console.log('[auth-creation-smoke] PASS', {
    email: NEW_USER_EMAIL,
    setupLinkPresent: Boolean(setupLink),
  });
};

run().catch((error) => {
  console.error('[auth-creation-smoke] FAIL', error?.message || error);
  process.exit(1);
});
