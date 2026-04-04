import sql from '../server/db.js';

const requiredIndexes = [
  ['courses_org_slug_unique_idx'],
  ['user_course_progress_unique'],
  ['user_lesson_progress_unique'],
  ['organization_memberships_unique', 'organization_memberships_unique_organization_id_user_id'],
];

const requiredColumns = {
  organization_memberships: ['organization_id', 'user_id'],
  user_organizations_vw: ['organization_id', 'user_id', 'role', 'status'],
};

const requiredFunctions = ['upsert_course_graph'];

const fail = (message, details = {}) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        details,
      },
      null,
      2,
    ),
  );
  process.exit(1);
};

try {
  const columnRows = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
  `;
  const columnsByTable = new Map();
  columnRows.forEach((row) => {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set());
    }
    columnsByTable.get(row.table_name).add(row.column_name);
  });

  const missingColumns = Object.entries(requiredColumns).flatMap(([table, columns]) =>
    columns
      .filter((column) => !(columnsByTable.get(table)?.has(column)))
      .map((column) => `${table}.${column}`),
  );

  const indexRows = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'public'
  `;
  const indexNames = new Set(indexRows.map((row) => row.indexname));
  const missingIndexGroups = requiredIndexes.filter((group) => group.every((name) => !indexNames.has(name)));

  const functionRows = await sql`
    select proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  `;
  const functionNames = new Set(functionRows.map((row) => row.proname));
  const missingFunctions = requiredFunctions.filter((name) => !functionNames.has(name));

  if (missingColumns.length || missingIndexGroups.length || missingFunctions.length) {
    fail('Launch-readiness schema verification failed.', {
      missingColumns,
      missingIndexes: missingIndexGroups.map((group) => group.join(' | ')),
      missingFunctions,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: 'Launch-readiness schema verification passed.',
        checked: {
          tables: Object.keys(requiredColumns),
          indexes: requiredIndexes,
          functions: requiredFunctions,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (error) {
  fail('Schema verification query failed.', {
    message: error instanceof Error ? error.message : String(error),
  });
}
