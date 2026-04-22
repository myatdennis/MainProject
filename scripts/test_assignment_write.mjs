#!/usr/bin/env node

/**
 * One-off smoke to exercise server/lib/safeWrites.js safeInsert with verify:true
 * Uses admin service role client configured in .env.local; we import the
 * central env loader to ensure consistent behavior.
 */

try {
  await import('../server/env/loadEnv.js');
} catch (e) {
  // ignore
}

import { randomBytes, randomUUID } from 'node:crypto';
// dynamic import so env loader ran first
const { safeInsert } = await import('../server/lib/safeWrites.js');
const { supabaseAdminClient } = await import('../server/lib/supabaseClient.js');

(async function main() {
  try {
    const stamp = randomBytes(3).toString('hex');
    const id = `smoke-${Date.now()}-${stamp}`;
    const orgId = process.env.TEST_ORG_ID || process.env.DEMO_SANDBOX_ORG_ID || process.env.DEFAULT_SANDBOX_ORG_ID || 'demo-sandbox-org';

    // Create a real course record first so assignment references an existing UUID
    let courseId = null;
    try {
      const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      let targetOrgId = orgId;
      if (!isUuid(orgId)) {
        // create a temporary organization so course can reference a real org UUID
  const { data: createdOrg, error: orgErr } = await supabaseAdminClient.from('organizations').insert({ id: randomUUID(), name: `smoke-org-${stamp}`, slug: `smoke-org-${stamp}` }).select('id').maybeSingle();
        if (orgErr) throw orgErr;
        targetOrgId = createdOrg && createdOrg.id ? createdOrg.id : null;
      }
      const newCourse = {
        id: randomUUID(),
        organization_id: targetOrgId,
        title: `smoke course ${stamp}`,
        slug: `smoke-course-${stamp}`,
        status: 'draft',
      };
      if (!supabaseAdminClient) throw new Error('admin_client_missing');
      const { data: created, error: createErr } = await supabaseAdminClient.from('courses').insert(newCourse).select('id').maybeSingle();
      if (createErr) throw createErr;
      courseId = created && created.id ? created.id : newCourse.id;
      console.log('[smoke] created course', { courseId });
    } catch (e) {
      console.error('[smoke] failed to create course for assignment smoke', e?.message || String(e));
      throw e;
    }

    const row = {
      id,
      course_id: courseId,
      survey_id: null,
      organization_id: orgId,
      user_id: null,
      assignment_type: 'course',
      status: 'assigned',
      due_at: null,
      note: 'smoke test',
      assigned_by: null,
      metadata: { smoke: true },
      active: true,
    };

    console.log('[smoke] inserting assignment', { id, orgId });
    const res = await safeInsert('assignments', [row], { select: '*', requestId: 'smoke_test', verify: true, verifyTimeoutMs: 5000 });
    console.log('[smoke] insert complete', JSON.stringify(res?.data || res, null, 2));
    // teardown: delete created course, org and inserted assignment (best-effort)
    try {
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        const asnIds = res.data.map((r) => r.id).filter(Boolean);
        if (asnIds.length > 0) {
          await supabaseAdminClient.from('assignments').delete().in('id', asnIds);
        }
      }
      if (courseId) {
        await supabaseAdminClient.from('courses').delete().eq('id', courseId);
      }
      if (typeof targetOrgId !== 'undefined' && targetOrgId && !isUuid(orgId)) {
        try {
          await supabaseAdminClient.from('organizations').delete().eq('id', targetOrgId);
        } catch (e) {}
      }
    } catch (te) {
      console.warn('[smoke] teardown failed', te?.message || String(te));
    }
    process.exit(0);
  } catch (err) {
    console.error('[smoke] insert failed', err instanceof Error ? err.message : err, err);
    process.exit(2);
  }
})();
