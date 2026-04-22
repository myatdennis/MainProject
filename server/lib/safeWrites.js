import supabase, { supabaseAdminClient, supabaseAuthClient } from './supabaseClient.js';

// Safe write helper: prefer admin client for writes, fall back to server supabase.
export async function safeInsert(table, rows = [], { logger = console, requestId = null, select = false } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null };

  // ALWAYS require admin client for writes on the server. Do not fall back to anon client.
  if (!supabaseAdminClient) {
    const err = new Error('safeInsert: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    // provide a consistent shape for error handling
    err.code = 'missing_service_role_key';
    logger.error('safe_insert_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  const client = supabaseAdminClient;
  try {
    // Invariant checks: ensure required fields for assignments-like tables
    if (String(table).toLowerCase().includes('assign')) {
      const preview = rows.slice(0, 5);
      for (const r of rows) {
        const hasOrg = r.organization_id || r.org_id || r.organizationId || r.orgId;
        const hasAssignmentType = r.assignment_type || r.assignmentType;
        const hasActive = Object.prototype.hasOwnProperty.call(r, 'active');
        if (!hasOrg || !hasAssignmentType || !hasActive) {
          logger.error('[ASSIGNMENT INSERT INVARIANT FAILED]', {
            requestId,
            table,
            insertPreview: preview,
            missingOrg: !hasOrg,
            missingAssignmentType: !hasAssignmentType,
            missingActive: !hasActive,
          });
          throw new Error('Assignment insert invariant failed: missing required fields');
        }
      }
      try {
        logger.info('[ASSIGNMENT INSERT]', { requestId, table, orgId: rows[0].organization_id ?? rows[0].org_id ?? null, count: rows.length });
      } catch (e) {}
    }

    // Allow caller to request select of inserted rows (default: no select)
    if (select) {
      const sel = typeof select === 'string' ? select : '*';
      const res = await client.from(table).insert(rows).select(sel);
      return res;
    }
    const res = await client.from(table).insert(rows);
    return res;
  } catch (error) {
    logger.error('safe_insert_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export async function safeUpsert(table, payload, { logger = console, requestId = null, select = false } = {}) {
  if (!supabaseAdminClient) {
    const err = new Error('safeUpsert: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    err.code = 'missing_service_role_key';
    logger.error('safe_upsert_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  const client = supabaseAdminClient;
  try {
    if (select) {
      const sel = typeof select === 'string' ? select : '*';
      const res = await client.from(table).upsert(payload).select(sel);
      return res;
    }
    const res = await client.from(table).upsert(payload);
    return res;
  } catch (error) {
    logger.error('safe_upsert_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export async function safeDelete(table, predicateBuilder, { logger = console, requestId = null } = {}) {
  if (!supabaseAdminClient) {
    const err = new Error('safeDelete: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    err.code = 'missing_service_role_key';
    logger.error('safe_delete_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  const client = supabaseAdminClient;
  try {
    // predicateBuilder should be a function that accepts a query and returns a query
    const base = client.from(table);
    const query = typeof predicateBuilder === 'function' ? predicateBuilder(base) : base;
    const res = await query.delete();
    return res;
  } catch (error) {
    logger.error('safe_delete_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export default { safeInsert, safeUpsert, safeDelete };
