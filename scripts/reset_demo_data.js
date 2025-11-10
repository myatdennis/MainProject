#!/usr/bin/env node
/**
 * reset_demo_data.js
 * Safely archive and truncate server/demo-data.json to avoid OOM (exit 137) from huge demo persistence files.
 * Usage: npm run reset:demo
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const file = path.join(root, 'server', 'demo-data.json');
if (!fs.existsSync(file)) {
  console.log('No demo-data.json present. Nothing to reset.');
  process.exit(0);
}

try {
  const stat = fs.statSync(file);
  const archiveDir = path.join(root, 'server', 'archives');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = path.join(archiveDir, `demo-data-${timestamp}-${stat.size}b.json`);
  fs.copyFileSync(file, archivePath);
  fs.writeFileSync(file, JSON.stringify({ courses: [] }, null, 2));
  console.log(`Archived old demo-data.json (${stat.size} bytes) -> ${archivePath}`);
  console.log('Reset demo-data.json to an empty structure.');
} catch (err) {
  console.error('Failed to reset demo data:', err);
  process.exit(1);
}
