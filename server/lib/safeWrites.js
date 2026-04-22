import { supabaseAdminClient, supabase, supabaseAuthClient } from './supabaseClient.js';

// Safe write helper: prefer admin client for writes, fall back to server supabase.
export async function safeInsert(table, rows = [], { logger = console, requestId = null } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null };

  const client = supabaseAdminClient || supabase || supabaseAuthClient;
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

    const res = await client.from(table).insert(rows);
    return res;
  } catch (error) {
    logger.error('safe_insert_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export default { safeInsert };
