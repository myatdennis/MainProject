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

const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const versionTag = `v${buildId}`;

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
