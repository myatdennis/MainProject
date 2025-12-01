#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const base = path.join(process.cwd(), 'server');
const archive = path.join(base, 'ts-archive');

if (!fs.existsSync(base)) {
  console.error('No server directory');
  process.exit(1);
}

let deleted = 0;
function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (full === archive) continue; // skip archive
      walk(full);
    } else {
      if (full.endsWith('.ts')) {
        console.log('Deleting:', full);
        try {
          fs.unlinkSync(full);
          deleted++;
        } catch (err) {
          console.error('Failed to delete', full, err.message);
        }
      }
    }
  }
}

walk(base);
console.log('Deleted', deleted, '.ts files');
process.exit(0);
