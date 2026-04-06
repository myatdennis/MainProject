import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminRoles = new Set(['owner', 'admin', 'manager']);

const { data: orgs, error: orgError } = await supabase
  .from('organizations')
  .select('id,name,slug')
  .limit(25);

if (orgError) {
  console.error('ORG_QUERY_ERROR', orgError.message || orgError);
  process.exit(1);
}

console.log('ORGS_COUNT', orgs?.length || 0);

const orgIds = (orgs || []).map((o) => o.id).filter(Boolean);
if (!orgIds.length) {
  console.log('NO_ORGS_FOUND');
  process.exit(0);
}

const { data: memberships, error: memberError } = await supabase
  .from('organization_memberships')
  .select('organization_id,user_id,role,status')
  .in('organization_id', orgIds)
  .limit(5000);

if (memberError) {
  console.error('MEMBERSHIP_QUERY_ERROR', memberError.message || memberError);
  process.exit(1);
}

const byOrg = new Map();
for (const row of memberships || []) {
  const key = row.organization_id;
  if (!byOrg.has(key)) byOrg.set(key, []);
  byOrg.get(key).push(row);
}

let picked = null;
for (const org of orgs || []) {
  const rows = byOrg.get(org.id) || [];
  const admins = rows.filter((r) => adminRoles.has(String(r.role || '').toLowerCase()));
  const learners = rows.filter((r) => !adminRoles.has(String(r.role || '').toLowerCase()));

  console.log(
    'ORG_SUMMARY',
    JSON.stringify({
      id: org.id,
      slug: org.slug,
      name: org.name,
      totalMemberships: rows.length,
      adminCount: admins.length,
      learnerCount: learners.length,
      sampleAdmin: admins[0]?.user_id || null,
      sampleLearner: (learners[0]?.user_id || admins[1]?.user_id || null),
    }),
  );

  if (!picked && admins.length > 0 && (learners.length > 0 || admins.length > 1)) {
    picked = {
      orgId: org.id,
      adminUserId: admins[0].user_id,
      learnerUserId: (learners[0]?.user_id || admins[1]?.user_id),
    };
  }
}

if (!picked) {
  console.log('NO_VALID_ORG_WITH_ADMIN_AND_LEARNER');
  process.exit(0);
}

const userIds = [picked.adminUserId, picked.learnerUserId];
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('id,email,role')
  .in('id', userIds);

const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

console.log(
  'PICKED',
  JSON.stringify({
    ...picked,
    adminEmail: profileMap.get(picked.adminUserId)?.email || null,
    learnerEmail: profileMap.get(picked.learnerUserId)?.email || null,
  }),
);
