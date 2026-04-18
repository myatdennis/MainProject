const KNOWN_INVALID_ADMIN_COLUMNS = Object.freeze({
  user_profiles: new Set(['status', 'last_login_at', 'active_organization_id']),
  survey_assignments: new Set(['organization_id', 'user_id', 'org_id']),
});

const DEV_ONLY_GUARD = process.env.NODE_ENV !== 'production';

const normalizeColumns = (columns) => {
  if (!columns) return [];
  if (Array.isArray(columns)) {
    return columns
      .flatMap((value) => normalizeColumns(value))
      .filter(Boolean);
  }
  if (typeof columns === 'string') {
    return columns
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const aliasSource = value.includes(':') ? value.split(':').pop() : value;
        const whitespaceSource = aliasSource?.split(/\s+as\s+/i).pop() ?? aliasSource;
        return whitespaceSource?.replace(/[^\w.]/g, '') ?? '';
      })
      .filter(Boolean);
  }
  if (typeof columns === 'object') {
    return Object.keys(columns);
  }
  return [];
};

export const assertAdminQueryColumns = ({ table, columns, label = table } = {}) => {
  if (!DEV_ONLY_GUARD || !table) return;

  const invalidColumns = KNOWN_INVALID_ADMIN_COLUMNS[table];
  if (!invalidColumns || invalidColumns.size === 0) return;

  const referenced = normalizeColumns(columns);
  const mismatches = referenced.filter((column) => invalidColumns.has(column));
  if (mismatches.length === 0) return;

  const error = new Error(`[schema-guard] ${label} references invalid ${table} column(s): ${mismatches.join(', ')}`);
  error.code = 'admin_schema_guard_invalid_column';
  error.table = table;
  error.columns = mismatches;
  throw error;
};

export const logAdminQuery = (logger, detail = {}) => {
  if (!logger || typeof logger.info !== 'function') return;
  logger.info('admin_query_trace', detail);
};

export default {
  assertAdminQueryColumns,
  logAdminQuery,
};
