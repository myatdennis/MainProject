#!/usr/bin/env node
/*
  Start both the API (Express) server on 8888 and the Vite dev server on 5174.
  Keep the parent process alive while both children are running.
*/
const { spawn } = require('node:child_process');
const http = require('node:http');

function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(tryOnce, 500);
      });
      req.end();
    };
    tryOnce();
  });
}

function spawnProc(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[e2e-dev] Process ${cmd} ${args.join(' ')} exited with code ${code}`);
      process.exit(code || 1);
    }
  });
  return child;
}

const API_HEALTH_URL = 'http://127.0.0.1:8888/api/health';
const VITE_URL = 'http://localhost:5174';

let api;
let vite;

const cleanup = () => {
  try { api && api.kill(); } catch {}
  try { vite && vite.kill(); } catch {}
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function ensureApi() {
  try {
    await waitForUrl(API_HEALTH_URL, 2000);
    console.log('[e2e-dev] API already running on 8888');
    return;
  } catch {
    api = spawnProc('node', ['server/index.js'], {
      env: { ...process.env, NODE_ENV: 'test', E2E_TEST_MODE: 'true', DEV_FALLBACK: 'true', PORT: '8888' },
    });
    await waitForUrl(API_HEALTH_URL, 30_000);
    console.log('[e2e-dev] API ready on 8888');
  }
}

async function ensureVite() {
  try {
    await waitForUrl(VITE_URL, 2000);
    console.log('[e2e-dev] Vite dev already running on 5174');
    return;
  } catch {
    vite = spawnProc('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        PORT: '5174',
        // vite.config.ts reads VITE_PORT (not PORT) to set the dev server port
        VITE_PORT: '5174',
        VITE_E2E_TEST_MODE: 'true',
        VITE_DEV_FALLBACK: 'true',
        // Point Vite's /api and /ws proxies at the E2E API server (port 8888,
        // E2E_TEST_MODE=true) so browser fetch() calls reach the correct server.
        // Without this, Vite would proxy to port 3000 (the regular dev server)
        // which does not have E2E_TEST_MODE set and therefore rejects e2e tokens.
        VITE_API_PROXY_TARGET: 'http://127.0.0.1:8888',
        // Force API client to use relative /api (Vite proxy) instead of any pre-set external base
        VITE_API_BASE_URL: '',
        // Disable Supabase during E2E runs so the app uses demo mode and Vite proxy for /api
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: ''
      },
      shell: true,
    });
    await waitForUrl(VITE_URL, 30_000);
    console.log('[e2e-dev] Vite ready on 5174');
  }
}

(async () => {
  await ensureApi();
  await ensureVite();
})();
