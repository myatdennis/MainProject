import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const host = process.env.CHECK_HOST ?? '127.0.0.1';
const port = Number(process.env.CHECK_PORT ?? 5174);
const url = process.env.CHECK_URL ?? `http://${host}:${port}`;

console.log('[Diag] importMeta', import.meta.url);
const filePath = fileURLToPath(import.meta.url);
const tmpDir = path.dirname(filePath);
const projectRoot = path.resolve(tmpDir, '..');
console.log('[Diag] tmpDir', tmpDir);
console.log('[Diag] projectRoot', projectRoot);

const server = spawn('npm', ['run', 'dev', '--', '--host', host], {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    FORCE_COLOR: '0',
  }
});

const waitForServer = () => new Promise((resolve, reject) => {
  let resolved = false;
  const onData = (data) => {
    const text = data.toString();
    if (!resolved && text.includes('Local:')) {
      resolved = true;
      resolve(undefined);
    }
  };

  server.stdout.on('data', onData);
  server.stderr.on('data', (d) => {
    if (!resolved) {
      console.error('[dev server]', d.toString());
    }
  });
  server.once('error', reject);
  server.once('exit', (code) => {
    if (!resolved) {
      reject(new Error(`Dev server exited early with code ${code}`));
    }
  });
});

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', (err) => {
    console.error('[PageError]', err);
    errors.push({ type: 'pageerror', message: err.message, stack: err.stack });
  });

  page.on('console', (msg) => {
    console.log('[Console]', msg.type(), msg.text());
    if (msg.type() === 'error') {
      errors.push({ type: 'console', message: msg.text() });
    }
  });

  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  console.log('[Response]', response?.status(), response?.url());
  await page.waitForTimeout(2000);
  const content = await page.content();
  console.log('[Content length]', content.length);

  if (errors.length === 0) {
    console.log('No runtime errors detected.');
  } else {
    console.log('Captured runtime errors:', JSON.stringify(errors, null, 2));
  }

  await browser.close();
} catch (err) {
  console.error('Failed to load page:', err);
} finally {
  server.kill('SIGINT');
}
