import supabase, { supabaseAdminClient, supabaseAuthClient } from './supabaseClient.js';

// Safe write helper: prefer admin client for writes, fall back to server supabase.
export async function safeInsert(table, rows = [], { logger = console, requestId = null, select = false, verify = false, verifyTimeoutMs = 5000, verifyPredicate = null } = {}) {
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
    let res;
    if (select) {
      const sel = typeof select === 'string' ? select : '*';
      res = await client.from(table).insert(rows).select(sel);
    } else {
      res = await client.from(table).insert(rows);
    }

    // Optional read-after-write verification. Callers opt into this to get
    // deterministic guarantees that the inserted rows are visible to subsequent reads.
    if (verify) {
      try {
        // If the response returned selected rows, extract ids from the response.
        const insertedIds = Array.isArray(res?.data) && res.data.length > 0 && res.data.every((r) => r && r.id)
          ? res.data.map((r) => r.id)
          : // otherwise, fall back to provided row ids
            rows && Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && r.id)
          ? rows.map((r) => r.id)
          : null;

        const verifyFn = typeof verifyPredicate === 'function'
          ? () => verifyPredicate(client, res?.data || rows)
          : insertedIds && insertedIds.length > 0
          ? async () => {
              const { data: found, error: findError } = await client.from(table).select('id').in('id', insertedIds);
              if (findError) return false;
              return Array.isArray(found) && found.length === insertedIds.length;
            }
          : null;

        if (!verifyFn) {
          logger.warn('safe_insert_verify_skipped', { requestId, table, reason: 'no_ids_or_predicate' });
        } else {
          const start = Date.now();
          const intervalMs = 200;
          let ok = false;
          while (Date.now() - start < verifyTimeoutMs) {
            try {
              // evaluate predicate; it should return boolean
              // eslint-disable-next-line no-await-in-loop
              ok = await verifyFn();
              if (ok) break;
            } catch (e) {
              // swallow and retry until timeout
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          if (!ok) {
            const err = new Error('write_verification_failed');
            err.code = 'assignment_persistence_verification_failed';
            logger.error('safe_insert_verification_failed', { requestId, table, timeoutMs: verifyTimeoutMs });
            throw err;
          }
        }
      } catch (verifyErr) {
        logger.error('safe_insert_verify_error', { requestId, table, message: verifyErr?.message ?? String(verifyErr) });
        throw verifyErr;
      }
    }

    return res;
  } catch (error) {
    logger.error('safe_insert_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export async function safeUpsert(table, payload, { logger = console, requestId = null, select = false, verify = false, verifyTimeoutMs = 5000, verifyPredicate = null } = {}) {
  if (!supabaseAdminClient) {
    const err = new Error('safeUpsert: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    err.code = 'missing_service_role_key';
    logger.error('safe_upsert_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  const client = supabaseAdminClient;
  try {
    let res;
    if (select) {
      const sel = typeof select === 'string' ? select : '*';
      res = await client.from(table).upsert(payload).select(sel);
    } else {
      res = await client.from(table).upsert(payload);
    }

    // Optional verification similar to safeInsert
    if (verify) {
      try {
        const returnedRows = Array.isArray(res?.data) && res.data.length > 0 ? res.data : null;
        const payloadIds = Array.isArray(payload) && payload.length > 0 && payload.every((p) => p && p.id) ? payload.map((p) => p.id) : null;

        const verifyFn = typeof verifyPredicate === 'function'
          ? () => verifyPredicate(client, returnedRows || payload)
          : returnedRows && returnedRows.length > 0 && returnedRows.every((r) => r && r.id)
          ? async () => {
              const ids = returnedRows.map((r) => r.id);
              const { data: found, error: findError } = await client.from(table).select('id').in('id', ids);
              if (findError) return false;
              return Array.isArray(found) && found.length === ids.length;
            }
          : payloadIds && payloadIds.length > 0
          ? async () => {
              const { data: found, error: findError } = await client.from(table).select('id').in('id', payloadIds);
              if (findError) return false;
              return Array.isArray(found) && found.length === payloadIds.length;
            }
          : null;

        if (!verifyFn) {
          logger.warn('safe_upsert_verify_skipped', { requestId, table, reason: 'no_ids_or_predicate' });
        } else {
          const start = Date.now();
          const intervalMs = 200;
          let ok = false;
          while (Date.now() - start < verifyTimeoutMs) {
            try {
              // eslint-disable-next-line no-await-in-loop
              ok = await verifyFn();
              if (ok) break;
            } catch (e) {}
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          if (!ok) {
            const err = new Error('write_verification_failed');
            err.code = 'assignment_persistence_verification_failed';
            logger.error('safe_upsert_verification_failed', { requestId, table, timeoutMs: verifyTimeoutMs });
            throw err;
          }
        }
      } catch (verifyErr) {
        logger.error('safe_upsert_verify_error', { requestId, table, message: verifyErr?.message ?? String(verifyErr) });
        throw verifyErr;
      }
    }

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
