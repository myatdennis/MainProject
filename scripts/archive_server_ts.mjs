#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Small utility to move any .ts files under /server (except those in ts-archive)
// into server/ts-archive. This is idempotent and safe to run from CI or locally.

const cwd = process.cwd();
const serverDir = path.join(cwd, 'server');
if (!fs.existsSync(serverDir)) {
  console.log('No server folder found; skipping');
  process.exit(0);
}

const archiveDir = path.join(serverDir, 'ts-archive');
fs.mkdirSync(archiveDir, { recursive: true });

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      // skip ts-archive while walking
      if (full === archiveDir) continue;
      results.push(...walk(full));
    } else if (full.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(serverDir);
if (files.length === 0) {
  console.log('No .ts files under server found to archive');
  process.exit(0);
}

for (const f of files) {
  const rel = path.relative(serverDir, f);
  const dest = path.join(archiveDir, rel);
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  // If dest exists, skip to avoid overwriting
  if (fs.existsSync(dest)) {
    console.log(`Target exists; skipping: ${path.relative(cwd, dest)}`);
    continue;
  }
  fs.renameSync(f, dest);
  console.log(`Moved ${path.relative(cwd, f)} -> ${path.relative(cwd, dest)}`);
}

console.log('Archive complete.');
process.exit(0);
