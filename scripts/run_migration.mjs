#!/usr/bin/env node
import fs from 'fs';
import process from 'process';
import sql from '../server/db.js';

const [, , migrationPath] = process.argv;
if (!migrationPath) {
  console.error('Usage: node scripts/run_migration.mjs <migration-file.sql>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Export DATABASE_URL or use npm run migrate:local:prompt.');
  process.exit(1);
}

const fileExists = fs.existsSync(migrationPath);
if (!fileExists) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

async function runMigration() {
  const sqlText = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Running migration: ${migrationPath}`);
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
    });
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

runMigration();
