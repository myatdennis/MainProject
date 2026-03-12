#!/usr/bin/env node
/**
 * Schema doctor: verifies that the production database still matches the LMS
 * contract for the five core tables. Fails fast when a required table/column
 * or data type is missing.
 *
 * Usage: npm run schema:doctor
 */

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required to run the schema doctor.');
  process.exit(1);
}

const canonicalTypes = {
  uuid: ['uuid'],
  text: ['text', 'character varying'],
  jsonb: ['jsonb'],
  timestamptz: ['timestamp with time zone'],
  int: ['integer', 'bigint', 'smallint'],
  numeric: ['numeric', 'double precision', 'real'],
  bool: ['boolean'],
};

const schemaContract = {
  courses: {
    columns: {
      id: 'uuid',
      organization_id: 'uuid',
      title: 'text',
      slug: 'text',
      description: 'text',
      status: 'text',
      meta_json: 'jsonb',
      key_takeaways: 'jsonb',
      version: 'int',
      published_at: 'timestamptz',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  modules: {
    columns: {
      id: 'uuid',
      course_id: 'uuid',
      organization_id: 'uuid',
      title: 'text',
      description: 'text',
      order_index: 'int',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  lessons: {
    columns: {
      id: 'uuid',
      module_id: 'uuid',
      course_id: 'uuid',
      organization_id: 'uuid',
      title: 'text',
      type: 'text',
      description: 'text',
      content_json: 'jsonb',
      order_index: 'int',
      duration_s: 'int',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  organization_memberships: {
    columns: {
      id: 'uuid',
      user_id: 'uuid',
      organization_id: 'uuid',
      role: 'text',
      status: 'text',
      is_active: 'bool',
      accepted_at: 'timestamptz',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  user_course_progress: {
    columns: {
      id: 'uuid',
      user_id: 'uuid',
      course_id: 'uuid',
      organization_id: 'uuid',
      progress: 'numeric',
      time_spent_s: 'int',
      completed: 'bool',
      status: 'text',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  assignments: {
    columns: {
      id: 'uuid',
      organization_id: 'uuid',
      course_id: 'uuid',
      user_id: 'uuid',
      due_at: 'timestamptz',
      active: 'bool',
      note: 'text',
      assigned_by: 'uuid',
      metadata: 'jsonb',
      idempotency_key: 'text',
      client_request_id: 'text',
      created_at: 'timestamptz',
      updated_at: 'timestamptz',
    },
  },
  course_assignments: {
    optional: true,
    columns: {
      id: 'uuid',
      course_id: 'uuid',
      organization_id: 'uuid',
      user_id: 'uuid',
      assigned_by: 'uuid',
      status: 'text',
      metadata: 'jsonb',
      assigned_at: 'timestamptz',
    },
  },
};

const client = new Client({ connectionString: DATABASE_URL });

const issues = [];

function matchesType(actual, expectedKey) {
  const expected = canonicalTypes[expectedKey];
  if (!expected) return true;
  return expected.includes(actual);
}

async function fetchColumns(table) {
  const { rows } = await client.query(
    `
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = $1
    `,
    [table],
  );
  const map = new Map();
  rows.forEach((row) => map.set(row.column_name, row.data_type));
  return map;
}

async function ensureTableExists(table) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function run() {
  await client.connect();
  for (const [table, config] of Object.entries(schemaContract)) {
    const tableConfig = config.columns ? config : { columns: config };
    const { columns, optional } = tableConfig;
    const exists = await ensureTableExists(table);
    if (!exists) {
      if (optional) {
        continue;
      }
      issues.push({ table, column: '*', issue: 'table_missing' });
      continue;
    }
    const actualColumns = await fetchColumns(table);
    for (const [column, expectedTypeKey] of Object.entries(columns)) {
      if (!actualColumns.has(column)) {
        issues.push({ table, column, issue: 'missing' });
        continue;
      }
      const actualType = actualColumns.get(column);
      if (!matchesType(actualType, expectedTypeKey)) {
        issues.push({ table, column, issue: `type_mismatch (${actualType} != ${expectedTypeKey})` });
      }
    }
  }
  await client.end();

  if (issues.length) {
    console.error('❌ Schema doctor detected drift:');
    issues.forEach((issue) => {
      console.error(`   - ${issue.table}.${issue.column}: ${issue.issue}`);
    });
    console.error('   Fix the schema or update scripts/schema_doctor.mjs if the contract changed intentionally.');
    process.exit(1);
  }

  console.log('✅ Schema doctor passed — core LMS tables match the contract.');
}

run().catch((error) => {
  console.error('❌ Schema doctor failed to run:', error);
  process.exit(1);
});
