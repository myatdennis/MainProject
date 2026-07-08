import { getSupabaseAdminClient } from './supabaseClient.js';
import sql from '../db.js';

// Local helper: wrap a promise and reject if it doesn't settle within `ms` ms
const withTimeout = (promise, ms = 3000, label = 'operation') => {
  if (!promise || typeof promise.then !== 'function') return promise;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'ETIMEDOUT_SAFEWRITE';
      reject(err);
    }, ms);
  });
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(timer)), timeout]);
};

const SUPABASE_CALL_TIMEOUT_MS = Number(process.env.SUPABASE_CALL_TIMEOUT_MS || 3000);
const SAFEWRITE_VERIFY_MAX_ATTEMPTS = Number(process.env.SAFEWRITE_VERIFY_MAX_ATTEMPTS || 3);

// Tables allowed for SQL fallback verification. This prevents SQL injection
// and limits direct SQL checks to known safe tables.
const SQL_FALLBACK_ALLOWED = new Set(['assignments', 'courses', 'surveys', 'organizations']);

// Safe write helper: prefer admin client for writes, fall back to server supabase.
export async function safeInsert(table, rows = [], { logger = console, requestId = null, select = false, verify = false, verifyTimeoutMs = 15000, verifyPredicate = null } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null };

  // ALWAYS require admin client for writes on the server. Do not fall back to anon client.
  const client = getSupabaseAdminClient();
  if (!client) {
    const err = new Error('safeInsert: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    // provide a consistent shape for error handling
    err.code = 'missing_service_role_key';
    logger.error('safe_insert_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
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
      res = await withTimeout(client.from(table).insert(rows).select(sel), SUPABASE_CALL_TIMEOUT_MS, 'safeInsert.insert.select');
    } else {
      res = await withTimeout(client.from(table).insert(rows), SUPABASE_CALL_TIMEOUT_MS, 'safeInsert.insert');
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
          let ok = false;
          let attempt = 0;
          const backoffs = [100, 250, 500];
          while (attempt < SAFEWRITE_VERIFY_MAX_ATTEMPTS) {
            attempt += 1;
            try {
              ok = await withTimeout(verifyFn(), SUPABASE_CALL_TIMEOUT_MS, `safeInsert.verify.attempt${attempt}`);
              if (ok) break;
            } catch (e) {
              logger.warn('safe_insert_verify_attempt_error', { requestId, table, attempt, message: e?.message || String(e) });
            }
            const delay = backoffs[Math.min(attempt - 1, backoffs.length - 1)];
             
            await new Promise((r) => setTimeout(r, delay));
          }

          if (!ok) {
            // Primary supabase-js verification failed within timeout. Log and attempt SQL fallback.
            logger.warn('safe_insert_verify_primary_failed', { requestId, table, timeoutMs: verifyTimeoutMs });

            // Attempt SQL fallback verification when we have inserted IDs
            const insertedIds = Array.isArray(res?.data) && res.data.length > 0 && res.data.every((r) => r && r.id)
              ? res.data.map((r) => r.id)
              : rows && Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && r.id)
              ? rows.map((r) => r.id)
              : null;

            if (insertedIds && insertedIds.length > 0) {
              try {
                logger.info('safe_insert_sql_fallback_attempt', { requestId, table, idsCount: insertedIds.length });
                // Use direct SQL client to confirm persisted rows. Prefer public schema qualification.
                // Validate table name against allowlist first to avoid SQL injection risk.
                const rawTable = String(table || '').trim();
                const tableName = rawTable.replace(/^public\./i, '').toLowerCase();
                if (!SQL_FALLBACK_ALLOWED.has(tableName)) {
                  const err = new Error(`sql_fallback_table_not_allowed: ${tableName}`);
                  err.code = 'sql_fallback_table_not_allowed';
                  logger.error('safe_insert_sql_fallback_table_denied', { requestId, table: rawTable });
                  throw err;
                }

                // Use uuid[] parameter type for correct typing in Postgres.
                const query = `select id from public.${tableName} where id = any($1::uuid[])`;
                const sqlRes = await withTimeout(sql.unsafe(query, [insertedIds]), SUPABASE_CALL_TIMEOUT_MS, 'safeInsert.sql_fallback');
                const rowsFound = Array.isArray(sqlRes) ? sqlRes : (sqlRes && sqlRes.rows) ? sqlRes.rows : [];
                if (rowsFound && rowsFound.length > 0) {
                  logger.info('safe_insert_sql_fallback_success', { requestId, table, found: rowsFound.length });
                  ok = true;
                } else {
                  logger.warn('safe_insert_sql_fallback_no_rows', { requestId, table, idsCount: insertedIds.length });
                }
              } catch (sqlErr) {
                logger.error('safe_insert_sql_fallback_error', { requestId, table, error: sqlErr?.message || String(sqlErr) });
              }
            }

            if (!ok) {
              const err = new Error('write_verification_failed');
              err.code = 'assignment_persistence_verification_failed';
              logger.error('safe_insert_final_failure', { requestId, table, timeoutMs: verifyTimeoutMs });
              throw err;
            }
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

export async function safeUpsert(table, payload, { logger = console, requestId = null, select = false, verify = false, verifyTimeoutMs = 5000, verifyPredicate = null, onConflict = null } = {}) {
  const client = getSupabaseAdminClient();
  if (!client) {
    const err = new Error('safeUpsert: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    err.code = 'missing_service_role_key';
    logger.error('safe_upsert_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  try {
    let res;
    const options = onConflict ? { onConflict } : undefined;
    if (select) {
      const sel = typeof select === 'string' ? select : '*';
      res = await client.from(table).upsert(payload, options).select(sel);
    } else {
      res = await client.from(table).upsert(payload, options);
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
               
              ok = await verifyFn();
              if (ok) break;
            } catch (e) {}
             
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
  const client = getSupabaseAdminClient();
  if (!client) {
    const err = new Error('safeDelete: SUPABASE_SERVICE_ROLE_KEY (admin client) is required for server-side writes');
    err.code = 'missing_service_role_key';
    logger.error('safe_delete_no_admin_client', { requestId, table, message: err.message });
    throw err;
  }
  try {
    // predicateBuilder should be a function that accepts a query and returns a
    // query, e.g. (q) => q.eq('user_id', id). PostgREST's filter methods
    // (.eq/.contains/etc.) only exist on the builder returned by .delete()
    // (or .select()/.update()), not on the bare .from(table) result — so
    // .delete() must be called BEFORE handing the builder to predicateBuilder,
    // not after. Every caller of safeDelete relies on this filter-after-delete
    // chain (e.g. (q) => q.eq(...)), so getting this order backwards broke
    // every safeDelete call in the app with "q.eq is not a function".
    const base = client.from(table).delete();
    const query = typeof predicateBuilder === 'function' ? predicateBuilder(base) : base;
    const res = await query;
    return res;
  } catch (error) {
    logger.error('safe_delete_failed', { requestId, table, code: error?.code ?? null, message: error?.message ?? String(error) });
    throw error;
  }
}

export default { safeInsert, safeUpsert, safeDelete };
