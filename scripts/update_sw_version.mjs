#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const swPath = path.join(projectRoot, 'public', 'sw.js');
const swVersionPath = path.join(projectRoot, 'public', 'sw-version.json');

if (!fs.existsSync(swPath)) {
  console.error('[sw-version] public/sw.js not found');
  process.exit(1);
}

// CACHE_VERSION was never actually set by any build environment (Netlify
// doesn't define it), so this always fell back to the literal string 'v1' —
// on every single deploy, forever. ServiceWorkerManager.tsx registers the
// worker at `/sw.js?v=<this value>`; since that URL never changed, browsers
// never saw a new service worker to install, so nobody's cached bundle ever
// got busted after a deploy, no matter how many times we shipped fixes.
// Netlify sets COMMIT_REF (the git SHA) and BUILD_ID/DEPLOY_ID for every
// build — use those so the tag is genuinely unique per deploy.
const buildId =
  process.env.CACHE_VERSION ||
  process.env.COMMIT_REF ||
  process.env.BUILD_ID ||
  process.env.DEPLOY_ID ||
  new Date().toISOString();
const versionTag = buildId;

const manifestPayload = {
  version: versionTag,
  generatedAt: new Date().toISOString(),
};

try {
  fs.writeFileSync(swVersionPath, `${JSON.stringify(manifestPayload, null, 2)}\n`, 'utf8');
  console.log(`[sw-version] Wrote ${path.relative(projectRoot, swVersionPath)} (${versionTag})`);
} catch (error) {
  console.warn('[sw-version] Failed to write sw-version manifest:', error);
}

const swSource = fs.readFileSync(swPath, 'utf8');
const legacyPattern = /const CACHE_VERSION = '([^']*)';/;
const templateLiteralPattern = /const CACHE_VERSION\s*=\s*`[^`]+`;/;

if (legacyPattern.test(swSource)) {
  const updated = swSource.replace(legacyPattern, `const CACHE_VERSION = '${versionTag}';`);
  fs.writeFileSync(swPath, updated);
  console.log(`[sw-version] CACHE_VERSION set to ${versionTag}`);
  process.exit(0);
}

if (templateLiteralPattern.test(swSource)) {
  console.log('[sw-version] Detected dynamic CACHE_VERSION template literal; skipping manual rewrite.');
  process.exit(0);
}

console.warn('[sw-version] CACHE_VERSION declaration not found; no changes applied.');
