#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Move any .ts files found under server/ to server/ts-archive/
// This script is intended to be run locally by the maintainer when cleaning
// the repository or as a one-off CI step. It will preserve the directory
// structure under the archive location and remove the original file from
// the server runtime tree.

const ROOT = process.cwd();
const serverDir = path.join(ROOT, 'server');
const archiveDir = path.join(serverDir, 'ts-archive');

if (!fs.existsSync(serverDir)) {
  console.log('No server directory found. Nothing to do.');
  process.exit(0);
}

function walk(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let res = [];
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) res = res.concat(walk(full));
    else res.push(full);
  }
  return res;
}

// Ensure archive exists
fs.mkdirSync(archiveDir, { recursive: true });

const tsFiles = walk(serverDir).filter(p => p.endsWith('.ts') && !p.startsWith(archiveDir));
if (tsFiles.length === 0) {
  console.log('No .ts files under /server (outside archive) found.');
  process.exit(0);
}

for (const f of tsFiles) {
  const rel = path.relative(serverDir, f);
  const dest = path.join(archiveDir, rel);
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  try {
    fs.renameSync(f, dest);
    console.log(`Moved: ${path.relative(ROOT, f)} -> ${path.relative(ROOT, dest)}`);
  } catch (e) {
    console.error(`Failed to move ${f} -> ${dest}:`, e.message);
  }
}

console.log('Operation complete. Please commit the moved files.');
process.exit(0);
