#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SERVER_DIR = path.join(ROOT, 'server');
const ARCHIVE_DIR = path.join(SERVER_DIR, 'ts-archive');

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  let out = [];
  for (const item of items) {
    const fp = path.join(dir, item.name);
    if (item.isDirectory()) {
      out = out.concat(walk(fp));
    } else {
      out.push(fp);
    }
  }
  return out;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(ARCHIVE_DIR);

const files = walk(SERVER_DIR).filter((f) => f.endsWith('.ts') && !f.includes(path.join('server', 'ts-archive')));
if (files.length === 0) {
  console.log('[move_server_ts_to_archive] Nothing to move');
  process.exit(0);
}

for (const f of files) {
  const rel = path.relative(SERVER_DIR, f);
  const target = path.join(ARCHIVE_DIR, rel);
  ensureDir(path.dirname(target));
  console.log('[move_server_ts_to_archive] Moving', rel, '->', path.relative(ROOT, target));
  // Copy original file to archive unless a different archived version already exists.
  try {
    fs.copyFileSync(f, target);
  } catch (e) {
    console.error('[move_server_ts_to_archive] Failed to copy', f, e.message);
  }
  // Remove original file
  try {
    fs.rmSync(f);
  } catch (e) {
    console.error('[move_server_ts_to_archive] Failed to remove', f, e.message);
  }
}

console.log('[move_server_ts_to_archive] Move complete.');
