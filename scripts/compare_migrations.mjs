#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sql from '../server/db.js';

const MIG_DIR = join(process.cwd(), 'supabase', 'migrations');

const localFiles = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
const extractVersion = (name) => name.replace(/^(\d+).*$/, '$1');

async function run() {
  try {
    const rows = await sql`select version from supabase_migrations.schema_migrations order by version`;
    const applied = new Set((rows || []).map((r) => String(r.version)));
    const missing = [];
    for (const f of localFiles) {
      const v = extractVersion(f);
      if (!applied.has(v)) missing.push({ file: f, version: v });
    }
    console.log(`Local migrations: ${localFiles.length}, Applied: ${applied.size}, Missing: ${missing.length}`);
    if (missing.length) {
      console.log('Missing migrations (local -> not applied):');
      missing.forEach((m) => console.log(`${m.version}  ${m.file}`));
    } else {
      console.log('No missing local migrations.');
    }
  } catch (err) {
    console.error('Error comparing migrations:', err?.message || String(err));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

run();
