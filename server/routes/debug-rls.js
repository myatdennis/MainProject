import express from 'express';
import { getActiveSupabaseClient } from '../lib/supabaseClient.js';
const router = express.Router();

// GET /api/debug/rls-claims
// Returns an attempt to read the request.jwt.claims (via RPC if available)
// and a simple organizations count using the active request-scoped client.
router.get('/rls-claims', async (req, res) => {
  try {
    const results = {};
    // Try RPC first (some deployments include a helper RPC)
    try {
      const supabase = getActiveSupabaseClient();
      if (!supabase) throw new Error('Supabase client unavailable');
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_platform_role_claims');
      results.rpc = rpcErr ? { error: rpcErr.message } : rpcData;
    } catch (err) {
      results.rpc = { error: String(err) };
    }

    // Try a count from organizations (this will be subject to RLS)
    try {
      const supabase = getActiveSupabaseClient();
      if (!supabase) throw new Error('Supabase client unavailable');
      const { data: orgs, error: orgErr, count } = await supabase.from('organizations').select('id', { count: 'exact' }).limit(1);
      if (orgErr) results.organizations = { error: orgErr.message };
      else results.organizations = { rowSample: orgs, count };
    } catch (err) {
      results.organizations = { error: String(err) };
    }

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

export default router;
