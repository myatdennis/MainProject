#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const serverDir = path.join(process.cwd(), 'server');
if (!fs.existsSync(serverDir)) {
  console.log('No server directory found — nothing to trim');
  process.exit(0);
}

const archiveDir = path.join(serverDir, 'ts-archive');
const movedDir = path.join(archiveDir, 'moved');
if (!fs.existsSync(movedDir)) fs.mkdirSync(movedDir, { recursive: true });

const walk = (dir) => {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let res = [];
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      res = res.concat(walk(full));
    } else {
      res.push(full);
    }
  }
  return res;
};

const files = walk(serverDir).filter((f) => f.endsWith('.ts') && !f.startsWith(archiveDir));
if (files.length === 0) {
  console.log('No .ts files outside of server/ts-archive found.');
  process.exit(0);
}

for (const f of files) {
  const rel = path.relative(process.cwd(), f);
  const destName = rel.replace(/[\/]/g, '_');
  const dest = path.join(movedDir, destName);
  console.log('Moving', rel, '->', path.relative(process.cwd(), dest));
  try {
    fs.copyFileSync(f, dest);
    fs.unlinkSync(f);
  } catch (err) {
    console.error('Failed to move', rel, err);
    process.exit(2);
  }
}

console.log('All leftover .ts files moved into server/ts-archive/moved/');
process.exit(0);
