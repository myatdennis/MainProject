#!/usr/bin/env node
const http = require('node:http');

const EMAIL = process.env.DEV_SMOKE_EMAIL;
const PASSWORD = process.env.DEV_SMOKE_PASSWORD;
const BASE_URL = process.env.DEV_SMOKE_URL || 'http://localhost:5174';

if (!EMAIL || !PASSWORD) {
  console.error('[dev-auth-smoke] DEV_SMOKE_EMAIL and DEV_SMOKE_PASSWORD are required');
  process.exit(1);
}

const request = (path, options = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ res, body });
        });
      },
    );
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });

const run = async () => {
  try {
    const loginPayload = JSON.stringify({ email: EMAIL, password: PASSWORD });
    const loginResponse = await request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginPayload),
      },
      body: loginPayload,
    });

    const setCookie = loginResponse.res.headers['set-cookie'];
    if (!Array.isArray(setCookie) || setCookie.length === 0) {
      console.error('[dev-auth-smoke] Login failed: no cookies set');
      process.exit(1);
    }

    const cookies = setCookie.map((entry) => entry.split(';')[0]).join('; ');
    const sessionResponse = await request('/api/auth/session', {
      headers: { Cookie: cookies },
    });

    if (sessionResponse.res.statusCode !== 200) {
      console.error(
        `[dev-auth-smoke] session failed ${sessionResponse.res.statusCode}: ${sessionResponse.body}`,
      );
      process.exit(1);
    }

    const data = JSON.parse(sessionResponse.body || '{}');
    if (!data?.user?.id) {
      console.error('[dev-auth-smoke] session response missing user.id');
      process.exit(1);
    }

    console.log('[dev-auth-smoke] PASS', { userId: data.user.id });
    process.exit(0);
  } catch (error) {
    console.error('[dev-auth-smoke] ERROR', error?.message || error);
    process.exit(1);
  }
};

run();
