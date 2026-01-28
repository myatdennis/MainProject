#!/usr/bin/env node

/**
 * guard_api_navigation.cjs
 *
 * Blocks commits that accidentally include direct browser navigations to /api/*
 * endpoints (e.g., <a href="/api/..."> or form actions). Real API traffic must
 * go through apiRequest/apiClient helpers so credentials + headers are attached.
 */

const { execSync } = require('node:child_process');

const RG_OPTS = '--color never --no-heading -n';

const CHECKS = [
  {
    id: 'href',
    description: 'Anchor/link href pointing at /api/*',
    command: `rg ${RG_OPTS} -g'*.[tj]sx' -g'*.[tj]s' -e 'href\\s*=\\s*(?:\\{\\s*)?[\\'"\\\`]/api' src`,
    suggestion: 'Use a UI route or call apiRequest()/apiClient() instead of linking directly to /api/*.',
  },
  {
    id: 'action',
    description: 'Form action posting directly to /api/*',
    command: `rg ${RG_OPTS} -g'*.[tj]sx' -g'*.[tj]s' -e 'action\\s*=\\s*(?:\\{\\s*)?[\\'"\\\`]/api' src`,
    suggestion: 'Submit forms through React handlers that call apiRequest() so auth headers/cookies are included.',
  },
  {
    id: 'navigate',
    description: 'Router navigation helpers sending users to /api/*',
    command: `rg ${RG_OPTS} -g'*.[tj]sx' -g'*.[tj]s' -e '(navigate|router\\.push|router\\.replace)\\s*\\(\\s*[\\'"\\\`]/api' src`,
    suggestion: 'Route users to SPA pages (e.g., /admin/organizations) and let the page load data via the API client.',
  },
  {
    id: 'location',
    description: 'window.location mutations targeting /api/*',
    command: `rg ${RG_OPTS} -g'*.[tj]sx' -g'*.[tj]s' -e 'window\\.location\\.(href|assign|replace)\\s*=\\s*[\\'"\\\`]/api' src`,
    suggestion: 'Use fetch/axios with credentials instead of causing a top-level navigation to an API route.',
  },
];

let hasFailures = false;

for (const check of CHECKS) {
  try {
    const output = execSync(check.command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (output.trim().length > 0) {
      hasFailures = true;
      console.error(`\n🚫 ${check.description}`);
      console.error(output.trim());
      console.error(`Suggestion: ${check.suggestion}\n`);
    }
  } catch (error) {
    // Ripgrep exits with status 1 when no matches are found—we can ignore that.
    if (typeof error.status === 'number' && error.status === 1) {
      continue;
    }
    throw error;
  }
}

if (hasFailures) {
  console.error('guard:api-nav failed. Replace direct /api/* navigations with apiRequest/apiClient calls.');
  process.exit(1);
}
