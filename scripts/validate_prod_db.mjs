#!/usr/bin/env node
/**
 * Read-only production DB validation.
 *
 * Fails CI for critical launch schema drift and prints a clean PASS/WARN/FAIL
 * summary. This script only reads information_schema, pg_catalog, and
 * supabase_migrations metadata. It does not run migrations or write data.
 */

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('FAIL DATABASE_URL is required.');
  process.exit(1);
}

const criticalMigrations = [
  {
    version: '20260506020000',
    file: '20260506020000_fix_canonical_org_column_sync_triggers.sql',
    reason: 'canonical organization membership trigger drift fix',
  },
  {
    version: '20260506021000',
    file: '20260506021000_fix_remaining_legacy_org_id_triggers.sql',
    reason: 'remaining legacy org_id trigger drift fix',
  },
  {
    version: '20260506022000',
    file: '20260506022000_restore_canonical_membership_unique_index.sql',
    reason: 'canonical membership unique index restore',
  },
];

const criticalIndexGroups = [
  {
    label: 'organization_memberships unique organization/user index',
    names: ['organization_memberships_unique', 'organization_memberships_unique_organization_id_user_id'],
    table: 'organization_memberships',
    columns: ['organization_id', 'user_id'],
    unique: true,
  },
];

const protectedTables = [
  'organizations',
  'organization_memberships',
  'courses',
  'assignments',
  'user_course_progress',
  'user_lesson_progress',
  'surveys',
  'survey_responses',
  'documents',
];

const canonicalOrgColumnTables = [
  'organization_memberships',
  'org_invites',
  'assignments',
  'courses',
  'surveys',
  'survey_responses',
  'documents',
];

const optionalViews = ['org_onboarding_progress_vw', 'user_organizations_vw'];
const optionalTriggers = [
  'sync_org_membership_compat_cols_trigger',
  'sync_membership_org_columns_trigger',
  'org_invites_integrity_trigger',
];

const pass = [];
const warn = [];
const fail = [];

const addPass = (message) => pass.push(message);
const addWarn = (message) => warn.push(message);
const addFail = (message) => fail.push(message);

const quoteIdentifierList = (values) => values.map((value) => String(value)).join(', ');

const hasColumn = (columnsByTable, table, column) => columnsByTable.get(table)?.has(column) === true;

const normalizePgArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
};

const createPgClient = () => {
  let host = '';
  let connectionString = DATABASE_URL;
  try {
    const parsed = new URL(DATABASE_URL);
    host = parsed.hostname;
    if (host.includes('supabase.com')) {
      parsed.searchParams.delete('sslmode');
      connectionString = parsed.toString();
    }
  } catch {
    host = '';
  }
  const isSupabasePooler = host.includes('supabase.com');
  return new Client({
    connectionString,
    ...(isSupabasePooler ? { ssl: { rejectUnauthorized: false } } : {}),
  });
};

const getColumnsByTable = async (client) => {
  const { rows } = await client.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'`,
  );
  const columnsByTable = new Map();
  for (const row of rows) {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set());
    }
    columnsByTable.get(row.table_name).add(row.column_name);
  }
  return columnsByTable;
};

const getExistingTables = async (client) => {
  const { rows } = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'`,
  );
  return new Set(rows.map((row) => row.table_name));
};

const checkMigrations = async (client) => {
  const { rows: tableRows } = await client.query(
    `select 1
       from information_schema.tables
      where table_schema = 'supabase_migrations'
        and table_name = 'schema_migrations'`,
  );

  if (tableRows.length === 0) {
    addFail('missing supabase_migrations.schema_migrations table');
    return;
  }

  const { rows } = await client.query(
    `select *
       from supabase_migrations.schema_migrations
      where version = any($1)`,
    [criticalMigrations.map((migration) => migration.version)],
  );
  const foundVersions = new Set(rows.map((row) => String(row.version)));

  for (const migration of criticalMigrations) {
    if (foundVersions.has(migration.version)) {
      addPass(`migration present: ${migration.file}`);
    } else {
      addFail(`missing critical migration: ${migration.file} (${migration.reason})`);
    }
  }
};

const checkCriticalIndexes = async (client) => {
  const { rows } = await client.query(
    `select
        i.relname as index_name,
        t.relname as table_name,
        ix.indisunique as is_unique,
        pg_get_indexdef(ix.indexrelid) as index_def,
        array_agg(a.attname order by k.ordinality) filter (where a.attname is not null) as column_names
       from pg_index ix
       join pg_class i on i.oid = ix.indexrelid
       join pg_class t on t.oid = ix.indrelid
       join pg_namespace n on n.oid = t.relnamespace
       left join lateral unnest(ix.indkey) with ordinality as k(attnum, ordinality) on true
       left join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
      where n.nspname = 'public'
      group by i.relname, t.relname, ix.indisunique, ix.indexrelid`,
  );

  for (const group of criticalIndexGroups) {
    const match = rows.find((row) => {
      if (!group.names.includes(row.index_name)) return false;
      if (row.table_name !== group.table) return false;
      if (group.unique && !row.is_unique) return false;
      const columns = normalizePgArray(row.column_names);
      return group.columns.every((column) => columns.includes(column));
    });

    if (match) {
      addPass(`critical index present: ${group.label} (${match.index_name})`);
    } else {
      addFail(
        `missing critical index: ${group.label}; expected one of ${quoteIdentifierList(group.names)} on ${group.table}(${quoteIdentifierList(group.columns)})`,
      );
    }
  }
};

const checkCanonicalColumns = (existingTables, columnsByTable) => {
  for (const table of canonicalOrgColumnTables) {
    if (!existingTables.has(table)) {
      addWarn(`optional/conditional table absent while checking canonical org column: ${table}`);
      continue;
    }

    if (hasColumn(columnsByTable, table, 'organization_id')) {
      addPass(`canonical organization_id column present: ${table}.organization_id`);
    } else {
      addFail(`missing canonical organization_id column: ${table}.organization_id`);
    }

    if (hasColumn(columnsByTable, table, 'org_id')) {
      addWarn(`legacy org_id column still present: ${table}.org_id`);
    }
  }
};

const checkRls = async (client, existingTables) => {
  const tablesToCheck = protectedTables.filter((table) => existingTables.has(table));
  const missingProtectedTables = protectedTables.filter((table) => !existingTables.has(table));
  for (const table of missingProtectedTables) {
    addFail(`missing protected table: ${table}`);
  }

  if (tablesToCheck.length === 0) return;

  const { rows } = await client.query(
    `select c.relname, c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1)`,
    [tablesToCheck],
  );
  const rlsByTable = new Map(rows.map((row) => [row.relname, Boolean(row.relrowsecurity)]));

  for (const table of tablesToCheck) {
    if (rlsByTable.get(table) === true) {
      addPass(`RLS enabled: ${table}`);
    } else {
      addFail(`RLS disabled on protected table: ${table}`);
    }
  }
};

const checkOptionalViews = async (client) => {
  const { rows } = await client.query(
    `select table_name
       from information_schema.views
      where table_schema = 'public'
        and table_name = any($1)`,
    [optionalViews],
  );
  const found = new Set(rows.map((row) => row.table_name));

  for (const view of optionalViews) {
    if (found.has(view)) {
      addPass(`optional view present: ${view}`);
    } else {
      addWarn(`optional view missing: ${view}`);
    }
  }
};

const checkOptionalTriggers = async (client) => {
  const { rows } = await client.query(
    `select tg.tgname
       from pg_trigger tg
       join pg_class c on c.oid = tg.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and tg.tgname = any($1)`,
    [optionalTriggers],
  );
  const found = new Set(rows.map((row) => row.tgname));

  for (const trigger of optionalTriggers) {
    if (found.has(trigger)) {
      addPass(`optional trigger present: ${trigger}`);
    } else {
      addWarn(`optional trigger absent: ${trigger}`);
    }
  }
};

const printSummary = () => {
  console.log('\n=== Production DB validation summary ===');

  console.log('\nPASS');
  if (pass.length === 0) {
    console.log('  - none');
  } else {
    for (const message of pass) console.log(`  - ${message}`);
  }

  console.log('\nWARN');
  if (warn.length === 0) {
    console.log('  - none');
  } else {
    for (const message of warn) console.log(`  - ${message}`);
  }

  console.log('\nFAIL');
  if (fail.length === 0) {
    console.log('  - none');
  } else {
    for (const message of fail) console.log(`  - ${message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: fail.length === 0,
        pass: pass.length,
        warn: warn.length,
        fail: fail.length,
      },
      null,
      2,
    ),
  );
};

const client = createPgClient();

try {
  await client.connect();
  const [existingTables, columnsByTable] = await Promise.all([getExistingTables(client), getColumnsByTable(client)]);

  await checkMigrations(client);
  await checkCriticalIndexes(client);
  checkCanonicalColumns(existingTables, columnsByTable);
  await checkRls(client, existingTables);
  await checkOptionalViews(client);
  await checkOptionalTriggers(client);

  printSummary();
  process.exit(fail.length === 0 ? 0 : 2);
} catch (error) {
  console.error('FAIL validate_prod_db runtime error:', error?.message || String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
