#!/usr/bin/env node
import sql from '../server/db.js';

async function run() {
  try {
    const rows = await sql`select * from pg_policies limit 1`;
    if (!rows || rows.length === 0) {
      console.log('No rows in pg_policies');
      return;
    }
    const r = rows[0];
    console.log('Columns and JS types for first pg_policies row:');
    for (const k of Object.keys(r)) {
      console.log(`${k} -> type: ${typeof r[k]}    value: ${String(r[k])}`);
    }
  } catch (err) {
    console.error('Error querying pg_policies:', err?.message || String(err));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

run();
