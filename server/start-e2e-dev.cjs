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

let api;
// Start API server (express) in E2E mode if not already running
// NOTE: We use port 8888 to match Vite's proxy target in vite.config.ts
waitForUrl('http://localhost:8888/api/health', 2000)
  .then(() => {
    console.log('[e2e-dev] API already running on 8888');
  })
  .catch(() => {
    api = spawnProc('node', ['server/index.js'], {
      env: { ...process.env, E2E_TEST_MODE: 'true', PORT: '8888' },
    });
  });

// Give API a moment to boot
setTimeout(() => {
  // Start Vite dev server on 5174 (as configured in vite.config)
  let vite;
  waitForUrl('http://localhost:5174', 2000)
    .then(() => {
      console.log('[e2e-dev] Vite dev already running on 5174');
    })
    .catch(() => {
      vite = spawnProc('npm', ['run', 'dev'], {
        env: {
          ...process.env,
          PORT: '5174',
          // Force API client to use relative /api (Vite proxy) instead of any pre-set external base
          VITE_API_BASE_URL: '',
          // Disable Supabase during E2E runs so the app uses demo mode and Vite proxy for /api
          VITE_SUPABASE_URL: '',
          VITE_SUPABASE_ANON_KEY: ''
        },
        shell: true,
      });
    });

  // Clean up both on exit
  const cleanup = () => {
    try { api && api.kill(); } catch {}
    try { vite && vite.kill(); } catch {}
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}, 500);
