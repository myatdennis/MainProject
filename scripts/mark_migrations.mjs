#!/usr/bin/env node
import process from 'process';
import { basename } from 'path';
import sql from '../server/db.js';

const versions = process.argv.slice(2);
if (!versions || versions.length === 0) {
  console.error('Usage: node scripts/mark_migrations.mjs <migration-file-or-version> [more...]');
  console.error('You can pass either filenames (eg supabase/migrations/20260501_name.sql) or raw version numbers.');
  process.exit(1);
}

function extractVersionFromName(name) {
  const base = basename(name);
  const m = base.match(/^(\d+)/);
  return m ? m[1] : base;
}

async function run() {
  try {
    await sql.begin(async (tx) => {
      for (const v of versions) {
        const version = extractVersionFromName(v);
        console.log('Marking version:', version);
        await tx.unsafe(
          `INSERT INTO supabase_migrations.schema_migrations (version) SELECT '${version}' WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}')`
        );
      }
    });
    console.log('Done');
  } catch (err) {
    console.error('Failed to mark migrations:', err?.message || String(err));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

run();
