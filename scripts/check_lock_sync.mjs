#!/usr/bin/env node
import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

const ROOT = process.cwd();
const lockPath = path.join(ROOT, 'package-lock.json');
const before = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : '';

console.log('[check_lock_sync] Running npm install --package-lock-only to verify lockfile sync...');
const res = spawnSync('npm', ['install', '--package-lock-only'], { stdio: 'inherit', shell: true });
if (res.status !== 0) {
  console.error('[check_lock_sync] npm install --package-lock-only failed.');
  process.exit(res.status || 1);
}

const after = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : '';
if (before !== after) {
  console.error('[check_lock_sync] package-lock.json is out of sync with package.json.');
  console.error('[check_lock_sync] Run `npm install` locally and commit the updated lock file.');
  process.exit(2);
}

console.log('[check_lock_sync] package-lock.json is in sync.');
process.exit(0);
