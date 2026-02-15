#!/usr/bin/env node
import { Client } from 'pg';

const contracts = {
  audit_logs: ['id', 'action', 'org_id', 'user_id', 'details', 'ip_address', 'created_at'],
  analytics_events: [
    'id',
    'org_id',
    'course_id',
    'lesson_id',
    'user_id',
    'event_type',
    'session_id',
    'user_agent',
    'payload',
    'client_event_id',
    'created_at',
  ],
  courses: ['id', 'slug', 'title', 'description', 'status', 'organization_id', 'meta_json'],
  modules: ['id', 'course_id', 'title', 'description', 'order_index'],
  lessons: ['id', 'module_id', 'title', 'type', 'order_index', 'content_json'],
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[schema-contract] DATABASE_URL not set. Skipping contract check.');
  process.exit(0);
}

const client = new Client({ connectionString });

const fetchColumns = async (table) => {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows.map((row) => row.column_name).sort();
};

const run = async () => {
  await client.connect();
  let hasMismatch = false;

  for (const [table, expected] of Object.entries(contracts)) {
    const actual = await fetchColumns(table);
    const missing = expected.filter((column) => !actual.includes(column));
    const extras = actual.filter((column) => !expected.includes(column));
    if (missing.length || extras.length) {
      hasMismatch = true;
      console.error(`[schema-contract] ${table} mismatch`, { expected, actual, missing, extras });
    } else {
      console.info(`[schema-contract] ${table} OK`);
    }
  }

  await client.end();

  if (hasMismatch) {
    console.error('[schema-contract] Schema contract mismatches detected.');
    process.exit(1);
  }

  console.info('[schema-contract] All contracts satisfied.');
};

run().catch((error) => {
  console.error('[schema-contract] Failed to verify schema contract', error);
  process.exit(1);
});
