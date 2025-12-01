#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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

const serverDir = path.join(process.cwd(), 'server');
if (!fs.existsSync(serverDir)) {
  console.log('No server directory');
  process.exit(0);
}

// Exclude archived files located under server/ts-archive from checks.
const archiveDir = path.join(serverDir, 'ts-archive');
const files = walk(serverDir).filter((f) => f.endsWith('.ts') && !f.startsWith(archiveDir));


// Previously we allowed some placeholder .ts files; make the rule strict and fail on any .ts outside the archive.
const bad = files.slice();
if (bad.length > 0) {
  console.error('Error: Found .ts files under /server:');
  for (const f of bad) console.error(' -', path.relative(process.cwd(), f));
  process.exit(2);
}

console.log('No .ts files found under /server outside of ts-archive');
process.exit(0);
