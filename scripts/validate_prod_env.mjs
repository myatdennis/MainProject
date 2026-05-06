#!/usr/bin/env node
/*
  validate_prod_env.mjs

  Small validation utility to run on a production host to ensure runtime
  environment matches expectations from the local validated runtime.

  Usage (on target host):
    NODE_ENV=production node scripts/validate_prod_env.mjs

  Optional environment variables for extra checks:
    PROD_BASE_URL - base URL of the deployed frontend (https://app.example.com)
    PROD_API_URL  - base URL of the deployed backend API (https://api.example.com)
    AUTH_TEST_EMAIL - email for a test login (optional)
    AUTH_TEST_PASSWORD - password for a test login (optional)

  The script performs non-destructive checks only.
*/

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const requiredFrontendVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
  // VITE_ENABLE_WS is optional boolean but check presence
  'VITE_ENABLE_WS',
];

const requiredBackendVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'DATABASE_URL',
  'NODE_ENV',
];

const isProbablyLocal = (val) => {
  if (!val || typeof val !== 'string') return true;
  return /localhost|127\.0\.0\.1|::1/.test(val);
};

const warn = (msg) => console.warn('[WARN]', msg);
const ok = (msg) => console.log('[OK]', msg);
const fail = (msg) => console.error('[FAIL]', msg);

async function checkEnvVars() {
  console.log('Checking frontend environment variables...');
  let pass = true;
  for (const v of requiredFrontendVars) {
    const val = process.env[v];
    if (!val) {
      fail(`Missing frontend env var: ${v}`);
      pass = false;
      continue;
    }
    if (v.startsWith('VITE_') && isProbablyLocal(val)) {
      warn(`Frontend env var ${v} appears to be a localhost value: ${val}`);
    } else {
      ok(`${v} is set`);
    }
  }

  console.log('\nChecking backend environment variables...');
  for (const v of requiredBackendVars) {
    const val = process.env[v];
    if (!val) {
      fail(`Missing backend env var: ${v}`);
      pass = false;
      continue;
    }
    if (v !== 'NODE_ENV' && isProbablyLocal(val)) {
      warn(`Backend env var ${v} appears to be a localhost value: ${val}`);
    } else {
      ok(`${v} is set`);
    }
  }

  return pass;
}

async function checkCors() {
  console.log('\nInspecting server CORS configuration...');
  try {
    // Attempt to import the server cors middleware to read declared origins
    const corsModulePath = path.resolve(process.cwd(), 'server/middleware/cors.js');
    if (!fs.existsSync(corsModulePath)) {
      warn('CORS middleware not present at server/middleware/cors.js');
      return false;
    }
    const corsModule = await import('file://' + corsModulePath);
    const resolved = corsModule.resolvedCorsOrigins || corsModule.default?.resolvedCorsOrigins || null;
    if (!resolved) {
      // try named export
      const r = corsModule.resolvedCorsOrigins ?? null;
      if (!r) {
        warn('Could not determine resolved CORS origins from middleware.');
        return false;
      }
    }
    const origins = corsModule.resolvedCorsOrigins || [];
    ok(`CORS allowed origins: ${origins.join(', ')}`);

    // Sanity: ensure no wildcard * is present in production
    if (process.env.NODE_ENV === 'production') {
      if (origins.some((o) => o.includes('*'))) {
        fail('Wildcard origins detected in production CORS configuration');
        return false;
      }
    }

    // If PROD_BASE_URL given, ensure it's in allowed origins
    const prodBase = process.env.PROD_BASE_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL;
    if (prodBase) {
      const url = new URL(prodBase).origin;
      if (!origins.includes(url)) {
        warn(`PROD_BASE_URL (${url}) is not present in server CORS allowlist`);
      } else {
        ok(`PROD_BASE_URL (${url}) is present in allowed origins`);
      }
    }
    return true;
  } catch (err) {
    fail('Failed to inspect CORS middleware: ' + String(err));
    return false;
  }
}

async function performOptionalHttpChecks() {
  const apiBase = process.env.PROD_API_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL;
  const prodBase = process.env.PROD_BASE_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL;
  if (!apiBase && !prodBase) {
    warn('No PROD_API_URL / PROD_BASE_URL provided. Skipping HTTP checks.');
    return true;
  }

  const checks = [];
  if (apiBase) checks.push({ name: 'api', url: apiBase });
  if (prodBase) checks.push({ name: 'frontend', url: prodBase });

  for (const chk of checks) {
    try {
      const healthUrl = new URL('/api/health', chk.url).toString();
      console.log(`Pinging ${chk.name} health endpoint: ${healthUrl}`);
      const res = await fetch(healthUrl, { method: 'GET', redirect: 'manual' });
      if (res.ok) {
        ok(`${chk.name} health OK (${res.status})`);
      } else {
        warn(`${chk.name} health returned ${res.status}`);
      }
    } catch (err) {
      fail(`Failed to reach ${chk.name} at ${chk.url}: ${String(err)}`);
    }
  }

  // Optional: try a login flow if credentials provided
  const testEmail = process.env.AUTH_TEST_EMAIL;
  const testPassword = process.env.AUTH_TEST_PASSWORD;
  if (apiBase && testEmail && testPassword) {
    try {
      const loginUrl = new URL('/api/auth/login', apiBase).toString();
      console.log('Attempting test login (non-destructive) to check auth flow...');
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      if (res.ok) {
        ok('Test login endpoint OK');
      } else {
        warn(`Test login failed with status ${res.status}`);
      }
    } catch (err) {
      warn('Test login attempt failed: ' + String(err));
    }
  }

  return true;
}

async function main() {
  console.log('Production environment validation starting...');
  const envOk = await checkEnvVars();
  const corsOk = await checkCors();
  const httpOk = await performOptionalHttpChecks();

  const overall = envOk && corsOk && httpOk;
  if (!overall) {
    console.error('\nPRODUCTION VALIDATION FAILED');
    process.exitCode = 2;
  } else {
    console.log('\nPRODUCTION VALIDATION PASSED');
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error('Validation script failed:', err);
  process.exitCode = 3;
});
