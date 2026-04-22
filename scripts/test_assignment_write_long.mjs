#!/usr/bin/env node

// One-off smoke that uses a longer verification timeout to tolerate replication/visibility lag.
try {
  await import('../server/env/loadEnv.js');
} catch (e) {}

import { randomBytes } from 'node:crypto';
// Use dynamic import for safeWrites to avoid static import ordering issues when env is loaded
const { safeInsert } = await import('../server/lib/safeWrites.js');
const { supabaseAdminClient } = await import('../server/lib/supabaseClient.js');
import { randomUUID } from 'node:crypto';

(async function main() {
  try {
    const stamp = randomBytes(3).toString('hex');
    const id = `smoke-long-${Date.now()}-${stamp}`;
    const orgId = process.env.TEST_ORG_ID || process.env.DEMO_SANDBOX_ORG_ID || process.env.DEFAULT_SANDBOX_ORG_ID || 'demo-sandbox-org';

    // Ensure we have a real course (or survey) to reference: create a minimal course record
    let courseId = null;
    let surveyId = null;
    let assignmentType = 'course';
    try {
      if (supabaseAdminClient) {
        const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        let targetOrgId = orgId;
        if (!isUuid(orgId)) {
          const { data: createdOrg, error: orgErr } = await supabaseAdminClient.from('organizations').insert({ id: randomUUID(), name: `smoke-org-${stamp}`, slug: `smoke-org-${stamp}` }).select('id').maybeSingle();
          if (orgErr) throw orgErr;
          targetOrgId = createdOrg && createdOrg.id ? createdOrg.id : null;
        }
  // create a new course to guarantee a valid UUID
  const newCourse = { id: randomUUID(), organization_id: targetOrgId, title: `smoke course ${stamp}`, slug: `smoke-course-${stamp}`, status: 'draft' };
        const { data: created, error: createErr } = await supabaseAdminClient.from('courses').insert(newCourse).select('id').maybeSingle();
        if (createErr) throw createErr;
        courseId = created && created.id ? created.id : newCourse.id;
      }
    } catch (e) {
      // ignore and fall back to nulls
    }

    const row = {
      id,
      course_id: courseId,
      survey_id: surveyId,
      organization_id: orgId,
      user_id: null,
      assignment_type: assignmentType,
      status: 'assigned',
      due_at: null,
  note: 'smoke test long',
      assigned_by: null,
      metadata: { smoke: true },
      active: true,
    };

    console.log('[smoke-long] inserting assignment', { id, orgId });
    const res = await safeInsert('assignments', [row], { select: '*', requestId: 'smoke_test_long', verify: true, verifyTimeoutMs: 20000 });
    console.log('[smoke-long] insert complete', JSON.stringify(res?.data || res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[smoke-long] insert failed', err instanceof Error ? err.message : err, err);
    process.exit(2);
  }
})();
