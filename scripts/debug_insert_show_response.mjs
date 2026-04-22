#!/usr/bin/env node
try { await import('../server/env/loadEnv.js'); } catch {}
const { supabaseAdminClient } = await import('../server/lib/supabaseClient.js');
const { randomBytes } = await import('node:crypto');
(async ()=>{
  if (!supabaseAdminClient) {
    console.error('no admin client'); process.exit(2);
  }
  const stamp = randomBytes(3).toString('hex');
  const id = `dbg-${Date.now()}-${stamp}`;
  const orgId = process.env.TEST_ORG_ID || process.env.DEMO_SANDBOX_ORG_ID || process.env.DEFAULT_SANDBOX_ORG_ID || 'demo-sandbox-org';
  const row = { id, course_id: `dbg-${stamp}`, survey_id: null, organization_id: orgId, user_id: null, assignment_type: 'course', status: 'assigned', active: true };
  console.log('inserting row', row);
  // Create a minimal course so the assignment references a real DB record
  try {
    const { randomUUID } = await import('node:crypto');
    const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let targetOrgId = row.organization_id;
    if (!isUuid(row.organization_id)) {
      try {
        const { data: createdOrg } = await supabaseAdminClient.from('organizations').insert({ id: randomUUID(), name: `dbg-org-${Date.now()}`, slug: `dbg-org-${Date.now()}` }).select('id').maybeSingle();
        if (createdOrg && createdOrg.id) targetOrgId = createdOrg.id;
      } catch (_) {}
    }
  const newCourse = { id: randomUUID(), organization_id: targetOrgId, title: `dbg course ${Date.now()}`, slug: `dbg-course-${Date.now()}`, status: 'draft' };
    const { data: created, error: createErr } = await supabaseAdminClient.from('courses').insert(newCourse).select('id').maybeSingle();
    if (!createErr && created && created.id) {
      row.course_id = created.id;
    }
  } catch (e) {}
  const res = await supabaseAdminClient.from('assignments').insert([row]).select('*');
  console.log('resp', JSON.stringify(res, null, 2));
  process.exit(0);
})();
