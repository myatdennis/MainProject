#!/usr/bin/env node
import 'dotenv/config';
import dns from 'node:dns';
import { Client } from 'pg';

dns.setDefaultResultOrder?.('ipv4first');

const log = (status, message) => {
  const prefix = status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  console.log(`${prefix} - ${message}`);
};

const exitWithStatus = (ok) => {
  process.exit(ok ? 0 : 1);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

async function checkSchema(client) {
  // 1) Connection already established
  log('PASS', 'Connected to database');

  // 2) Check function exists
  const fnResult = await client.query(
    `
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = $1
        AND pg_get_function_identity_arguments(p.oid) = 'jsonb, uuid, uuid'
    `,
    ['upsert_course_graph'],
  );
  assert(fnResult.rowCount === 1, 'Function public.upsert_course_graph(jsonb, uuid, uuid) is missing');
  log('PASS', 'Found public.upsert_course_graph(jsonb, uuid, uuid)');

  // 3) Ensure tables have organization_id columns
  const tables = ['courses', 'modules', 'lessons'];
  for (const table of tables) {
    const columnResult = await client.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = 'organization_id'
      `,
      [table],
    );
    assert(columnResult.rowCount === 1, `Table public.${table} is missing organization_id column`);
    log('PASS', `public.${table} has organization_id column`);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Please export it or load via .env.');
    exitWithStatus(false);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await checkSchema(client);
    log('PASS', 'Schema verification completed successfully');
    exitWithStatus(true);
  } catch (error) {
    log('FAIL', error.message || error);
    exitWithStatus(false);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
