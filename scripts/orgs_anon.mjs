#!/usr/bin/env node
/**
 * Query the DB using the anon/anon-key client (request-scoped fallback)
 * to illustrate RLS or anon-scoped visibility differences.
 *
 * Usage: ensure SUPABASE_URL and SUPABASE_ANON_KEY are available in env
 */
import { getSupabaseUserClient } from '../server/lib/supabaseClient.js';

const client = getSupabaseUserClient();
if (!client) {
  console.error('Anon client not available. Ensure SUPABASE_ANON_KEY is configured.');
  process.exit(1);
}

(async () => {
  try {
    const { data, error, count } = await client.from('organizations').select('id', { count: 'exact' }).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    console.log('anon_total:', typeof count === 'number' ? count : (Array.isArray(data) ? data.length : 0));
    console.log('anon_sample_ids:', (Array.isArray(data) ? data.map((r) => r.id) : []).slice(0, 20));
  } catch (err) {
    console.error('anon query failed:', err?.message || err);
    process.exit(2);
  }
})();
