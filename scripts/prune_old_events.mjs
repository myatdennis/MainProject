#!/usr/bin/env node
import 'dotenv/config';
import postgres from 'postgres';

const retentionDays = Number(process.env.ANALYTICS_RETENTION_DAYS || 30);
const dryRun = process.argv.includes('--dry-run');
const connectionString = process.env.DATABASE_URL;
const isDemoEnv = [process.env.DEV_FALLBACK, process.env.DEMO_MODE]
  .filter((value) => typeof value === 'string')
  .some((value) => value.toLowerCase() === 'true');

if (!connectionString) {
  if (isDemoEnv || dryRun) {
    const reason = isDemoEnv ? 'demo fallback is enabled' : 'a dry run was requested';
    console.log(`[retention] DATABASE_URL not set and ${reason} – skipping prune.`);
    process.exit(0);
  }
  console.error('[retention] DATABASE_URL is required to prune analytics/progress events.');
  console.error('Set it in your environment or .env file (see .env.example) and rerun the script.');
  process.exit(1);
}

const sql = postgres(connectionString, {
  max: Number(process.env.RETENTION_DB_POOL_SIZE || 5),
});

const tables = [
  { name: 'analytics_events', column: 'created_at' },
  { name: 'progress_events', column: 'created_at' },
];

const buildThresholdFragment = () => `NOW() - INTERVAL '${retentionDays} days'`;
const isConnIssue = (error) => {
  if (!error) return false;
  const message = String(error.message || error);
  return (
    error.code === 'ECONNREFUSED'
    || /ECONNREFUSED/i.test(message)
    || /password authentication failed/i.test(message)
  );
};

async function pruneTable(table) {
  const threshold = buildThresholdFragment();
  const statementBase = `${table.column} < ${threshold}`;
  if (dryRun) {
    const [{ count }] = await sql.unsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${table.name} WHERE ${statementBase};`,
    );
    console.log(`DRY RUN: ${count} row(s) older than ${retentionDays} days in ${table.name}`);
    return { table: table.name, deleted: 0, eligible: Number(count) };
  }

  const result = await sql.unsafe(
    `DELETE FROM ${table.name} WHERE ${statementBase} RETURNING 1;`,
  );
  const deleted = Array.isArray(result) ? result.length : 0;
  console.log(`Deleted ${deleted} row(s) from ${table.name}`);
  return { table: table.name, deleted, eligible: deleted };
}

async function main() {
  console.log(`⏳ Pruning analytics/progress events older than ${retentionDays} day(s)...`);
  const outcomes = [];
  try {
    for (const table of tables) {
      outcomes.push(await pruneTable(table));
    }
    console.log('\nPrune summary:');
    outcomes.forEach((entry) => {
      const label = dryRun ? 'eligible' : 'deleted';
      console.log(`  • ${entry.table}: ${entry[label]} row(s) ${label}`);
    });
    if (dryRun) {
      console.log('\nDry run complete. Re-run without --dry-run to delete the rows.');
    }
  } catch (error) {
    if (dryRun && isConnIssue(error)) {
      console.warn('[retention] Dry run skipped – database not reachable:');
      console.warn(`  ${error?.message || error}`);
      console.warn('Set DATABASE_URL (see .env.example) to point at Supabase or local Postgres before running without --dry-run.');
      return;
    }
    console.error('Retention prune failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await sql.end({ timeout: 1000 });
    } catch (err) {
      if (process.env.DEBUG_RETENTION_PRUNE) {
        console.warn('Failed to close SQL connection cleanly:', err);
      }
    }
  }
}

main();
