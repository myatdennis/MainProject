#!/usr/bin/env node
import '../env/loadEnv.js';
import { createClient } from '@supabase/supabase-js';

function isValidSupabaseKey(key) {
  return typeof key === 'string' && key.startsWith('eyJ');
}

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const missing = [];
if (!url) missing.push('SUPABASE_URL');
if (!anon) missing.push('SUPABASE_ANON_KEY');
if (!service) missing.push('SUPABASE_SERVICE_ROLE_KEY');

if (missing.length > 0) {
  console.error('[validate_supabase_env] Missing env vars:', missing.join(', '));
  process.exit(2);
}

if (!isValidSupabaseKey(anon) || !isValidSupabaseKey(service)) {
  console.error('[validate_supabase_env] Supabase key format looks invalid (expecting JWT-like prefix)');
  process.exit(3);
}

let hostSafe = null;
try { hostSafe = url ? new URL(url).host : null; } catch (e) { hostSafe = null; }
console.log('[validate_supabase_env] Supabase URL host:', hostSafe);

(async () => {
  try {
    const client = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Minimal check: HEAD-like select against organizations (no data printed)
    const { error } = await client.from('organizations').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) {
      console.error('[validate_supabase_env] Supabase query failed:', error.message || error);
      process.exit(4);
    }

    console.log('[validate_supabase_env] Supabase connection verified — ok');
    process.exit(0);
  } catch (err) {
    console.error('[validate_supabase_env] Unexpected error:', err?.message || err);
    process.exit(5);
  }
})();
