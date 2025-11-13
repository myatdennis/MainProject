#!/usr/bin/env node
// Simple smoke-check: start the server in E2E_TEST_MODE on a separate port,
// query /api/health and assert it reports supabaseConfigured: false.
const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || '8890';
const SERVER_CMD = process.env.SERVER_CMD || 'node';
const SERVER_ARGS = process.env.SERVER_ARGS ? process.env.SERVER_ARGS.split(' ') : ['server/index.js'];

function waitForHealth(url, timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      http.get(url, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (err) => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(poll, 250);
      });
    })();
  });
}

(async () => {
  console.log('[check_e2e] Starting server in E2E_TEST_MODE on port', PORT);
  const env = Object.assign({}, process.env, { E2E_TEST_MODE: 'true', PORT });
  const child = spawn(SERVER_CMD, SERVER_ARGS, { env, stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d.toString()}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server:error] ${d.toString()}`));

  try {
    const health = await waitForHealth(`http://localhost:${PORT}/api/health`, 15000);
    console.log('[check_e2e] /api/health response:', health);
    if (health && health.supabaseConfigured === false) {
      console.log('[check_e2e] OK: server reports supabaseConfigured=false while E2E_TEST_MODE=true');
      process.exitCode = 0;
    } else {
      console.error('[check_e2e] FAIL: unexpected /api/health response');
      process.exitCode = 2;
    }
  } catch (err) {
    console.error('[check_e2e] ERROR waiting for /api/health:', err && err.message ? err.message : err);
    process.exitCode = 3;
  } finally {
    try { child.kill('SIGTERM'); } catch (e) {}
  }
})();
