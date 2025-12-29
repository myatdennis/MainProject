import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEV_URL = 'http://localhost:5174/admin/login';
const READY_REGEX = /Local:\s+http:\/\/localhost:5174/;
const DEV_START_TIMEOUT_MS = 15_000;

async function startDevServer() {
  const devProc = spawn('npm', ['run', 'dev'], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;

  const stdoutListener = (data) => {
    const text = data.toString();
    process.stdout.write(`[vite] ${text}`);
    if (!ready && READY_REGEX.test(text)) {
      ready = true;
    }
  };

  const stderrListener = (data) => {
    process.stderr.write(`[vite:err] ${data}`);
  };

  devProc.stdout.on('data', stdoutListener);
  devProc.stderr.on('data', stderrListener);

  const timeoutPromise = delay(DEV_START_TIMEOUT_MS).then(() => {
    throw new Error('Dev server did not report readiness in time.');
  });

  try {
    await Promise.race([
      timeoutPromise,
      (async () => {
        while (!ready) {
          await delay(100);
        }
      })(),
    ]);
  } catch (err) {
    devProc.kill('SIGINT');
    throw err;
  }

  devProc.on('exit', (code) => {
    if (!ready) {
      console.error(`Dev server exited early with code ${code}`);
    }
  });

  return devProc;
}

async function stopDevServer(devProc) {
  if (!devProc) return;
  devProc.kill('SIGINT');
  try {
    await once(devProc, 'exit');
  } catch (err) {
    console.warn('Failed waiting for dev server to exit cleanly:', err);
  }
}

async function captureAdminConsole() {
  const devProc = await startDevServer();
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', (msg) => {
      console.log(`[console:${msg.type()}]`, msg.text());
    });

    page.on('pageerror', (err) => {
      console.error('[pageerror]', err?.stack ?? err?.message ?? err);
    });

    page.on('requestfailed', (request) => {
      console.error('[requestfailed]', request.url(), request.failure()?.errorText ?? 'unknown error');
    });

    console.log('Navigating to', DEV_URL);
    await page.goto(DEV_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const title = await page.title();
    console.log('Page title:', title);

    await browser.close();
  } finally {
    await stopDevServer(devProc);
  }
}

captureAdminConsole().catch((err) => {
  console.error('Failed to capture admin console output:', err);
  process.exitCode = 1;
});
