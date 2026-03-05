#!/usr/bin/env node
import dns from 'node:dns';
import process from 'node:process';
import { Pool } from 'pg';

if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch (error) {
    console.warn('[schema] Failed to enforce ipv4first DNS', error);
  }
}

const requiredFunction = 'upsert_course_graph';
const requiredColumns = [
  { table: 'courses', column: 'organization_id' },
  { table: 'modules', column: 'organization_id' },
  { table: 'lessons', column: 'organization_id' },
];
const cascadeChecks = [
  { source: 'public.modules', column: 'course_id', target: 'public.courses' },
  { source: 'public.lessons', column: 'module_id', target: 'public.modules' },
];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[schema] DATABASE_URL is required for schema verification.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const fatal = (message) => {
  console.error(`[schema] ${message}`);
  process.exit(1);
};

const warn = (message) => console.warn(`[schema] ${message}`);

async function ensureFunction(client) {
  const query = `
    select proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and proname = $1
  `;
  const { rows } = await client.query(query, [requiredFunction]);
  const match = rows.find((row) => row.args === 'jsonb, uuid, uuid');
  if (!match) {
    fatal(`Missing required function public.${requiredFunction}(jsonb, uuid, uuid)`);
  }
}

async function ensureColumn(client, table, column) {
  const { rows } = await client.query(
    `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [table, column],
  );
  if (rows.length === 0) {
    fatal(`Missing column public.${table}.${column}`);
  }
}

async function ensureCascade(client, { source, target, column }) {
  const { rows } = await client.query(
    `select pg_get_constraintdef(oid) as def from pg_constraint where contype = 'f' and conrelid = $1::regclass and confrelid = $2::regclass`,
    [source, target],
  );
  const match = rows.find((row) => {
    const def = row.def?.toLowerCase() || '';
    return def.includes(`(${column.toLowerCase()})`) && def.includes('on delete cascade');
  });
  if (!match) {
    fatal(`Missing cascading FK from ${source}.${column} -> ${target}`);
  }
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureFunction(client);
    for (const { table, column } of requiredColumns) {
      await ensureColumn(client, table, column);
    }
    for (const cascade of cascadeChecks) {
      await ensureCascade(client, cascade);
    }
    const { rows } = await client.query(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = $1`,
      [requiredFunction],
    );
    if (rows.length === 0) {
      fatal(`Function public.${requiredFunction} still missing after verification`);
    }
    console.log('[schema] verification passed');
    process.exit(0);
  } catch (error) {
    fatal(error?.message || String(error));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => fatal(error?.message || String(error)));
