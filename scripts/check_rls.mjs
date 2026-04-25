#!/usr/bin/env node
// One-shot runtime verifier for Supabase RLS and platform_admin access.
// Usage:
// export PLATFORM_ADMIN_TOKEN="<token>"
// export BASE_URL="https://your-app.example.com"  # optional, defaults to http://localhost:54321
// node scripts/check_rls.mjs

const BASE = process.env.BASE_URL || 'http://localhost:54321';
const TOKEN = process.env.PLATFORM_ADMIN_TOKEN;

if (!TOKEN) {
  console.error('ERROR: PLATFORM_ADMIN_TOKEN env var is required');
  process.exit(2);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function call(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, { headers, ...opts });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch (_e) { return { status: res.status, body: text }; }
}

function printResult(name, result) {
  console.log('\n===', name, 'status=', result.status);
  console.log(JSON.stringify(result.body, null, 2));
}

(async () => {
  try {
    console.log('Base URL:', BASE);

    const debug = await call('/api/debug/rls-check');
    printResult('/api/debug/rls-check', debug);

    const courses = await call('/api/admin/courses');
    printResult('/api/admin/courses', courses);

    const orgs = await call('/api/admin/organizations');
    printResult('/api/admin/organizations', orgs);

    const users = await call('/api/admin/users');
    printResult('/api/admin/users', users);

    // Evaluate success criteria
    const debugCounts = (debug.body && debug.body.counts) || {};
    const coursesCount = debugCounts.courses ?? (Array.isArray(courses.body?.data) ? courses.body.data.length : null);
    const orgsCount = debugCounts.organizations ?? (Array.isArray(orgs.body?.data) ? orgs.body.data.length : null);
    const usersCount = debugCounts.user_profiles ?? (Array.isArray(users.body?.data) ? users.body.data.length : null);

    console.log('\nSummary:');
    console.log(' courses (debug):', coursesCount);
    console.log(' organizations (debug):', orgsCount);
    console.log(' user_profiles (debug):', usersCount);

    if ((coursesCount || 0) > 0 && (orgsCount || 0) > 0 && (usersCount || 0) > 0) {
      console.log('\nRESULT: OK — platform_admin can see rows across tables');
      process.exit(0);
    }

    console.error('\nRESULT: FAIL — some counts are zero, inspect outputs above and server logs');
    process.exit(3);
  } catch (err) {
    console.error('Unexpected error running checks', err);
    process.exit(4);
  }
})();
