#!/usr/bin/env node
import sql from '../server/db.js';

async function listMigrations() {
  try {
    const rows = await sql`select version from supabase_migrations.schema_migrations order by version`;
    if (!rows || rows.length === 0) {
      console.log('No applied migrations found (table empty or missing)');
      return;
    }
    console.log('Applied migrations:');
    rows.forEach((r) => console.log(String(r.version)));
  } catch (err) {
    console.error('Failed to list applied migrations:', err?.message || String(err));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

listMigrations();
