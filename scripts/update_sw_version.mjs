#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const swPath = path.join(projectRoot, 'public', 'sw.js');

if (!fs.existsSync(swPath)) {
  console.error('[sw-version] public/sw.js not found');
  process.exit(1);
}

const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const versionTag = `v${buildId}`;

const swSource = fs.readFileSync(swPath, 'utf8');
const pattern = /const CACHE_VERSION = '([^']*)';/;

if (!pattern.test(swSource)) {
  console.error('[sw-version] Unable to locate CACHE_VERSION declaration');
  process.exit(1);
}

const updated = swSource.replace(pattern, `const CACHE_VERSION = '${versionTag}';`);
fs.writeFileSync(swPath, updated);
console.log(`[sw-version] CACHE_VERSION set to ${versionTag}`);
