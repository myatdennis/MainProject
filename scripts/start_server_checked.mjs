#!/usr/bin/env node
import { spawn } from 'child_process';
import fetch from 'node-fetch';
// ensure env is loaded consistently for the wrapper process
// this will load .env.local then .env and perform env checks
// (loader is safe to import multiple times)
try {
  await import('../server/env/loadEnv.js');
} catch (e) {
  // ignore
}

const PORT = Number(process.env.PORT) || 8888;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;
const TIMEOUT_MS = Number(process.env.STARTUP_HEALTH_TIMEOUT_MS || 10000);
const INTERVAL_MS = 500;

console.info('[start_server_checked] launching server', { pid: process.pid, port: PORT, healthUrl: HEALTH_URL });

const child = spawn(process.execPath, ['index.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) },
});

let exited = false;
child.on('exit', (code, signal) => {
  exited = true;
  console.info('[start_server_checked] child exited', { code, signal });
  process.exit(code ?? (signal ? 1 : 0));
});

const forwardSignal = (sig) => {
  return () => {
    try {
      if (!exited) {
        child.kill(sig);
      }
    } catch (e) {
      // ignore
    }
  };
};
process.on('SIGINT', forwardSignal('SIGINT'));
process.on('SIGTERM', forwardSignal('SIGTERM'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function waitForHealth() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) return;
    try {
      const res = await fetch(HEALTH_URL, { method: 'GET' });
      if (res && res.status === 200) {
        console.info('[start_server_checked] health check success', { url: HEALTH_URL, status: res.status });
        return; // keep running and let child stay in foreground
      }
    } catch (err) {
      // ignore and retry
    }
    await sleep(INTERVAL_MS);
  }
  console.error('[start_server_checked] health check timed out', { url: HEALTH_URL, timeoutMs: TIMEOUT_MS });
  // If the child is still running, kill it to avoid a stuck background server
  try {
    if (!exited) child.kill('SIGTERM');
  } catch (e) {}
  process.exit(1);
})();
