#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const port = Number(process.env.PORT) || 3000;
const healthUrl = process.env.VERIFY_SERVER_HEALTH_URL || `http://127.0.0.1:${port}/api/health`;

const fail = (message) => {
  console.error(`[verify:server] ${message}`);
  process.exit(1);
};

try {
  const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!/\bnode\b/i.test(output) || !/\bLISTEN\b/i.test(output)) {
    fail(`Expected a Node listener on port ${port}, got:\n${output}`);
  }

  console.log(`[verify:server] listener ok on ${port}`);
} catch (error) {
  fail(`Port ${port} is not listening (${error.message})`);
}

try {
  const response = await fetch(healthUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const bodyText = await response.text();
  let payload = null;

  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch (error) {
    fail(`Health endpoint returned invalid JSON: ${error.message}`);
  }

  if (response.status !== 200) {
    fail(`Health endpoint returned HTTP ${response.status}`);
  }

  if (payload?.status !== 'ok') {
    fail(`Health payload status was ${JSON.stringify(payload?.status)}`);
  }

  console.log(`[verify:server] health ok (${response.status})`);
} catch (error) {
  fail(`Health endpoint check failed: ${error.message}`);
}
