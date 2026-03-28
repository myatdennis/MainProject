#!/usr/bin/env node
import fs from 'fs';
import process from 'process';
import sql from '../server/db.js';

const [, , version, migrationPath] = process.argv;

if (!version || !migrationPath) {
  console.error('Usage: node scripts/record_migration_history.mjs <version> <migration-file.sql>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const name = migrationPath
  .split('/')
  .pop()
  .replace(/^\d+_/, '')
  .replace(/\.sql$/, '');

const sqlText = fs.readFileSync(migrationPath, 'utf8');

try {
  await sql`
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (${version}, ${name}, ${[sqlText]})
    on conflict (version) do nothing
  `;
  console.log(`Recorded migration ${version} (${name}) in supabase_migrations.schema_migrations`);
} catch (error) {
  console.error('Failed to record migration history:', error?.message || error);
  process.exitCode = 1;
} finally {
  await sql.end?.();
}
