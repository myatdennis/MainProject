#!/usr/bin/env node
/**
 * Validates every Supabase/Postgres migration by replaying it inside a disposable
 * transaction and scanning for dangerous directives such as
 * `set check_function_bodies = off`.
 *
 * Requirements:
 *  - `psql` available on PATH
 *  - `DATABASE_URL` env var pointing at a test/preview database
 *
 * Usage: npm run validate:migrations
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required to run migration validation.');
  process.exit(1);
}

const bannedPatterns = [/set\s+check_function_bodies\s*=\s*off/gi];

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

const offenders = [];
for (const file of migrationFiles) {
  const contents = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  for (const pattern of bannedPatterns) {
    if (pattern.test(contents)) {
      offenders.push({ file, reason: 'contains "set check_function_bodies = off"' });
      break;
    }
  }
}

if (offenders.length) {
  console.error('❌ Dangerous directives detected in migrations:');
  offenders.forEach((offender) => {
    console.error(`   - ${offender.file}: ${offender.reason}`);
  });
  process.exit(1);
}

const failures = [];

for (const file of migrationFiles) {
  const absPath = join(MIGRATIONS_DIR, file);
  const escapedPath = absPath.replace(/'/g, "''");
  const inputSql = `BEGIN;\n\\i '${escapedPath}'\nROLLBACK;\n`;
  const result = spawnSync('psql', ['--set', 'ON_ERROR_STOP=1', '--quiet', DATABASE_URL], {
    input: inputSql,
    encoding: 'utf8',
  });

  if (result.error) {
    failures.push({
      file,
      message: result.error.message,
    });
    continue;
  }

  if (result.status !== 0) {
    failures.push({
      file,
      message: result.stderr.trim() || 'psql exited with non-zero status',
      output: result.stdout.trim(),
    });
  }
}

if (failures.length) {
  console.error('❌ Migration validation failed:');
  failures.forEach((failure) => {
    console.error(`   - ${failure.file}: ${failure.message}`);
    if (failure.output) {
      console.error(`     STDOUT: ${failure.output}`);
    }
  });
  process.exit(1);
}

console.log(`✅ ${migrationFiles.length} migrations validated successfully.`);
console.log('   (Each migration was replayed within a rollback-only transaction.)');
