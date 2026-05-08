#!/usr/bin/env node
/**
 * Query the DB using the admin/service-role client to return authoritative
 * organization counts and sample IDs. Non-destructive read-only helper.
 *
 * Usage: DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/admin_orgs_truth.mjs
 */
import { getSupabaseAdminClient } from '../server/lib/supabaseClient.js';

const client = getSupabaseAdminClient();
if (!client) {
  console.error('Admin client not available. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.');
  process.exit(1);
}

(async () => {
  try {
    const { data, error, count } = await client.from('organizations').select('id,name,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    console.log('authoritative_total:', typeof count === 'number' ? count : (Array.isArray(data) ? data.length : 0));
    console.log('sample_ids:', (Array.isArray(data) ? data.map((r) => r.id) : []).slice(0, 20));
  } catch (err) {
    console.error('query failed:', err?.message || err);
    process.exit(2);
  }
})();
