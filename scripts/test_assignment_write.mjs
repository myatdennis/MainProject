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

import { randomBytes } from 'node:crypto';
import { safeInsert } from '../server/lib/safeWrites.js';

(async function main() {
  try {
    const stamp = randomBytes(3).toString('hex');
    const id = `smoke-${Date.now()}-${stamp}`;
    const orgId = process.env.TEST_ORG_ID || process.env.DEMO_SANDBOX_ORG_ID || process.env.DEFAULT_SANDBOX_ORG_ID || 'demo-sandbox-org';

    const row = {
      id,
      course_id: `smoke-course-${stamp}`,
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
    process.exit(0);
  } catch (err) {
    console.error('[smoke] insert failed', err instanceof Error ? err.message : err, err);
    process.exit(2);
  }
})();
