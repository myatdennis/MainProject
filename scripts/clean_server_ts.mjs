#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const serverDir = path.join(process.cwd(), 'server');
if (!fs.existsSync(serverDir)) {
  console.log('No server directory found, nothing to clean.');
  process.exit(0);
}

const archiveDir = path.join(serverDir, 'ts-archive');
const files = walk(serverDir).filter((f) => f.endsWith('.ts') && !f.startsWith(archiveDir));
if (files.length === 0) {
  console.log('No .ts files found under /server outside ts-archive');
  process.exit(0);
}

for (const f of files) {
  try {
    fs.unlinkSync(f);
    console.log('Deleted', path.relative(process.cwd(), f));
  } catch (err) {
    console.error('Failed to delete', f, err.message);
  }
}

process.exit(0);
