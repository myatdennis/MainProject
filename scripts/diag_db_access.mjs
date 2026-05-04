import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseAdminClient } from '../server/lib/supabaseClient.js';

(async () => {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      console.error('admin client unavailable');
      process.exit(2);
    }
    const orgId = process.argv[2] || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
    const userId = process.argv[3] || '02db6ab9-a10b-44d6-acda-5b74b91b04e5';
    console.log('Using orgId=', orgId, 'userId=', userId);
    const sel = await admin.from('organization_memberships').select('id,role,status').eq('organization_id', orgId).eq('user_id', userId).limit(5);
    console.log('select result:', JSON.stringify(sel, null, 2));
    try {
      const rpc = await admin.rpc('is_org_admin_for', { target_organization_id: orgId });
      console.log('rpc result:', JSON.stringify(rpc, null, 2));
    } catch (e) {
      console.error('rpc error:', e?.message || String(e));
    }
  } catch (err) {
    console.error('fatal error:', err?.message || String(err));
    process.exit(1);
  }
})();
