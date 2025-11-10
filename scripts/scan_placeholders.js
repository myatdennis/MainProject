#!/usr/bin/env node
/**
 * scan_placeholders.js
 * Fails (exit 1) if placeholder tokens remain in the repository.
 * Intended to run in CI before deploy.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist']);
const RUNTIME_FILES_ONLY = [
  'netlify.toml',
  '.github/workflows/health.yml',
  '.env',
];
const PLACEHOLDER_PATTERNS = [
  /<RAILWAY_HOST>/i,
  /<YOUR_SUPABASE_URL>/i,
  /<YOUR_SUPABASE_ANON_KEY>/i,
  /api\.example\.com/i,
  /example-api\.up\.railway\.app/i,
  /CHANGE_ME/i,
  /REPLACE_ME/i,
];

let failures = [];

function checkFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      failures.push({ file, pattern: pattern.toString() });
    }
  }
}

for (const rel of RUNTIME_FILES_ONLY) {
  checkFile(path.join(ROOT, rel));
}

if (failures.length > 0) {
  console.error('❌ Placeholder scan failed. Found unresolved placeholders:');
  for (const f of failures) {
    console.error(` - ${f.file} matches ${f.pattern}`);
  }
  process.exit(1);
}

console.log('✅ No unresolved placeholders detected in runtime-critical files.');
