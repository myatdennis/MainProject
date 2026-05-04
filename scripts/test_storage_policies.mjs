#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseAdminClient, createSupabaseClientForToken } from '../server/lib/supabaseClient.js';
import { randomUUID } from 'crypto';

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
      args[k] = v;
    }
  }
  return args;
}

async function tryInsert(client, payload) {
  try {
    const res = await client.from('storage.objects').insert([payload]);
    return { ok: true, res };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function run() {
  const args = parseArgs();
  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error('Admin client unavailable. Ensure SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are set in env.');
    process.exit(2);
  }

  const userJwt = args.userJwt || process.env.TEST_USER_JWT;
  const userId = args.userId || process.env.TEST_USER_ID;
  const orgId = args.orgId || process.env.TEST_ORG_ID;
  const otherUserId = args.otherUserId || process.env.TEST_OTHER_USER_ID;

  if (!userJwt) {
    console.warn('No --userJwt provided and TEST_USER_JWT not set. You can still run admin checks.');
  }

  console.log('Configuration:');
  console.log('  userId:', userId);
  console.log('  orgId:', orgId);
  console.log('  have userJwt:', Boolean(userJwt));

  const requestClient = userJwt ? createSupabaseClientForToken(userJwt) : null;

  // Prepare test payloads
  const baseName = `test-storage-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const avatarPayloadGood = {
    name: `${baseName}-avatar-good`,
    bucket_id: 'avatars',
    metadata: { user_id: userId },
  };
  const avatarPayloadBad = {
    name: `${baseName}-avatar-bad`,
    bucket_id: 'avatars',
    metadata: { user_id: otherUserId || '00000000-0000-0000-0000-000000000000' },
  };
  const orgPayloadMember = {
    name: `${baseName}-org-member`,
    bucket_id: 'org-assets',
    metadata: { organization_id: orgId },
  };
  const orgPayloadNoOrg = {
    name: `${baseName}-org-nomember`,
    bucket_id: 'org-assets',
    metadata: { organization_id: '00000000-0000-0000-0000-000000000000' },
  };

  // Helper to pretty print result
  function printResult(label, result) {
    console.log('\n==', label, '==');
    if (!result) {
      console.log('  <no result>');
      return;
    }
    if (result.ok) {
      console.log('  admin/client response:', JSON.stringify(result.res, null, 2));
    } else {
      console.log('  error:', (result.error && result.error.message) || result.error);
    }
  }

  // 0) Admin checks: try to insert each payload as admin (should succeed)
  console.log('\n[ADMIN] Creating test rows (admin client)');
  const adminResults = {};
  for (const [label, p] of Object.entries({ avatarGood: avatarPayloadGood, avatarBad: avatarPayloadBad, orgMember: orgPayloadMember, orgNoMember: orgPayloadNoOrg })) {
    try {
      const r = await admin.from('storage.objects').insert([p]);
      adminResults[label] = { ok: true, res: r };
    } catch (e) {
      adminResults[label] = { ok: false, error: e };
    }
  }
  Object.entries(adminResults).forEach(([k, v]) => printResult('[ADMIN] ' + k, v));

  // 1) If we have a request-scoped client (user JWT), attempt inserts as the user
  if (requestClient) {
    console.log('\n[USER] Attempting inserts using the provided user JWT');
    const userResults = {};
    for (const [label, p] of Object.entries({ avatarGood: avatarPayloadGood, avatarBad: avatarPayloadBad, orgMember: orgPayloadMember, orgNoMember: orgPayloadNoOrg })) {
      try {
        const r = await requestClient.from('storage.objects').insert([p]);
        userResults[label] = { ok: true, res: r };
      } catch (e) {
        userResults[label] = { ok: false, error: e };
      }
    }
    Object.entries(userResults).forEach(([k, v]) => printResult('[USER] ' + k, v));
  } else {
    console.log('\nSkipping user requests because no JWT was supplied.');
  }

  // Cleanup: remove any rows we created (admin only)
  console.log('\n[ADMIN] Cleaning up test rows');
  try {
    const names = [avatarPayloadGood.name, avatarPayloadBad.name, orgPayloadMember.name, orgPayloadNoOrg.name];
    const del = await admin.from('storage.objects').delete().in('name', names);
    console.log('  cleanup result:', JSON.stringify(del, null, 2));
  } catch (e) {
    console.error('  cleanup error:', e?.message || e);
  }

  console.log('\nDone. Interpret results above:');
  console.log(' - For avatars: only avatarGood (metadata.user_id == auth.uid()) should succeed for the user client. avatarBad should be denied.');
  console.log(' - For org-assets: orgMember should succeed for a member JWT, orgNoMember should be denied.');
  console.log('\nIf you see unexpected allow/deny, adjust the policy migration or ensure metadata keys match your schema.');
}

run().catch((e) => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});
