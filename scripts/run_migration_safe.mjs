#!/usr/bin/env node
import fs from 'fs';
import process from 'process';
import { basename } from 'path';
import sql from '../server/db.js';

const [, , migrationPath] = process.argv;
if (!migrationPath) {
  console.error('Usage: node scripts/run_migration_safe.mjs <migration-file.sql>');
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

function stripFences(content) {
  // Remove leading/trailing Markdown code fences like ```sql ... ``` or ``` ... ```
  let out = content;
  // Remove leading BOM
  out = out.replace(/^\uFEFF/, '');
  // Remove any leading/trailing fences
  out = out.replace(/^\s*```[\s\S]*?\n/, '');
  out = out.replace(/\n```\s*$/ms, '');
  // Also remove any standalone triple-backticks
  out = out.replace(/```/g, '');
  return out.trim();
}

function extractVersionFromName(name) {
  return name.replace(/^(\d+).*$/, '$1');
}

async function run() {
  try {
    const raw = fs.readFileSync(migrationPath, 'utf8');
    const sqlText = stripFences(raw);
    if (!sqlText) {
      console.error('Migration file empty after stripping fences:', migrationPath);
      process.exit(1);
    }

    const fileName = basename(migrationPath);
    const version = extractVersionFromName(fileName);

    console.log(`Running migration: ${migrationPath}`);

    await sql.begin(async (tx) => {
      // If the migration version is already recorded, skip executing the SQL.
      const already = await tx`select version from supabase_migrations.schema_migrations where version = ${version} limit 1`;
      if (already && already.length) {
        console.log(`Migration version ${version} already recorded - skipping execution.`);
        return;
      }

      await tx.unsafe(sqlText);

      // Record the migration version so that Supabase CLI / tooling recognizes it as applied.
      // Use a safe insert that only inserts when the version is not present.
      await tx.unsafe(
        `INSERT INTO supabase_migrations.schema_migrations (version) SELECT '${version}' WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}')`
      );
    });

    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error?.message || String(error));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

run();
