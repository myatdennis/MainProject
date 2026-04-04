/**
 * verify-data-load.mjs
 * End-to-end verification: courses, organizations, users load via live API.
 * Obtains a real mya session token via magic-link action_link redirect (no password needed).
 * Run: node scripts/verify-data-load.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eprsgmfzqjptfywoecuy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwcnNnbWZ6cWpwdGZ5d29lY3V5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU0MzYzNywiZXhwIjoyMDg3MTE5NjM3fQ.vMSCmzqi9pJHTXcZjZYlLiNq4J6wIcJWxwhKbzEiPs8';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwcnNnbWZ6cWpwdGZ5d29lY3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDM2MzcsImV4cCI6MjA4NzExOTYzN30.lbvywGKDcBJM2ZU9n_-9l4kcRcZNxSExsGv2CphS56o';
const API_BASE = 'https://api.the-huddle.co';
const MYA_EMAIL = 'mya@the-huddle.co';

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let passed = 0; let failed = 0; const failures = [];
const ok  = (l, d = '') => { console.log(`  ✅ ${l}${d ? ' — ' + d : ''}`); passed++; };
const fail = (l, d = '') => { console.log(`  ❌ ${l}${d ? ' — ' + d : ''}`); failed++; failures.push(`${l}: ${d}`); };
const section = (t) => console.log(`\n── ${t} ──`);

// ── Step 1: Get a real session token via magic-link action_link redirect ──
section('Auth — obtain mya session token');

async function getMyaToken() {
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: MYA_EMAIL,
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(`generateLink failed: ${error?.message || 'no action_link'}`);
  }
  // Follow the redirect (manual) — Supabase 303 → location has #access_token=... in fragment
  const res = await fetch(data.properties.action_link, { redirect: 'manual' });
  const location = res.headers.get('location') || '';
  const fragment = location.slice(location.indexOf('#') + 1);
  const params = new URLSearchParams(fragment);
  const token = params.get('access_token');
  if (!token) throw new Error(`No access_token in redirect: ${location.slice(0, 200)}`);
  return token;
}

let token = null;
try {
  token = await getMyaToken();
  ok('Session token for mya', `length=${token.length}`);
} catch (e) {
  fail('Session token for mya', e.message);
}

// ── Helper: authenticated API call ──
async function api(path) {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://admin.the-huddle.co' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// ══════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════
section('Users');

// DB: mya's profile
const { data: myaProfile, error: myaErr } = await service
  .from('user_profiles').select('role,is_admin,email').eq('email', MYA_EMAIL).single();
if (myaErr || !myaProfile) {
  fail("mya's user_profile", myaErr?.message || 'not found');
} else if (!['admin','platform_admin'].includes(myaProfile.role)) {
  fail("mya's role", `got role=${myaProfile.role}`);
} else {
  ok("mya's user_profile", `role=${myaProfile.role}, is_admin=${myaProfile.is_admin}`);
}

// API: GET /api/admin/users
const { status: usersStatus, json: usersJson } = await api('/api/admin/users');
if (usersStatus === 200) {
  const users = Array.isArray(usersJson) ? usersJson : (usersJson?.users || usersJson?.data || []);
  ok('GET /api/admin/users', `${users.length} users`);
  if (users.length > 0) {
    const u = users[0];
    const hasShape = !!(u.email || u.user?.email) && !!(u.id || u.user_id);
    hasShape ? ok('User record shape', `email=${u.email || u.user?.email}`) : fail('User record shape', JSON.stringify(u).slice(0,100));
  }
} else {
  fail('GET /api/admin/users', `HTTP ${usersStatus} — ${JSON.stringify(usersJson).slice(0,150)}`);
}

// API: GET /api/admin/me
const { status: meStatus, json: meJson } = await api('/api/admin/me');
if (meStatus === 200) {
  ok('GET /api/admin/me', `email=${meJson?.email || meJson?.user?.email}, role=${meJson?.role || meJson?.user?.role}`);
} else {
  fail('GET /api/admin/me', `HTTP ${meStatus} — ${JSON.stringify(meJson).slice(0,120)}`);
}

// ══════════════════════════════════════════════
// ORGANIZATIONS
// ══════════════════════════════════════════════
section('Organizations');

// DB
const { data: orgsDb, error: orgsDbErr } = await service
  .from('organizations').select('id,name,slug').limit(5);
if (orgsDbErr) {
  fail('organizations table (DB)', orgsDbErr.message);
} else {
  ok('organizations table (DB)', `${orgsDb.length} orgs: ${orgsDb.map(o=>o.name||o.slug).join(', ').slice(0,80)}`);
}

// API
const { status: orgsStatus, json: orgsJson } = await api('/api/admin/organizations');
if (orgsStatus === 200) {
  const orgs = Array.isArray(orgsJson) ? orgsJson : (orgsJson?.organizations || orgsJson?.data || []);
  ok('GET /api/admin/organizations', `${orgs.length} orgs`);
  if (orgs.length > 0) ok('Org shape', `id=${orgs[0].id}, name="${orgs[0].name || orgs[0].slug}"`);
} else {
  fail('GET /api/admin/organizations', `HTTP ${orgsStatus} — ${JSON.stringify(orgsJson).slice(0,150)}`);
}

// ══════════════════════════════════════════════
// COURSES
// ══════════════════════════════════════════════
section('Courses');

// DB
const { data: coursesDb, error: coursesDbErr } = await service
  .from('courses').select('id,title,status,organization_id').limit(5);
if (coursesDbErr) {
  fail('courses table (DB)', coursesDbErr.message);
} else if (!coursesDb?.length) {
  fail('courses table (DB)', 'table is empty');
} else {
  ok('courses table (DB)', `${coursesDb.length} courses: ${coursesDb.map(c=>c.title||c.id).join(', ').slice(0,100)}`);
}

// DB: lessons
const { data: lessonsDb, error: lessonsDbErr } = await service
  .from('lessons').select('id,title,course_id').limit(5);
if (lessonsDbErr) fail('lessons table (DB)', lessonsDbErr.message);
else ok('lessons table (DB)', `${lessonsDb.length} lessons sampled`);

// API: GET /api/admin/courses
const { status: coursesStatus, json: coursesJson } = await api('/api/admin/courses');
if (coursesStatus === 200) {
  const courses = Array.isArray(coursesJson) ? coursesJson : (coursesJson?.courses || coursesJson?.data || []);
  ok('GET /api/admin/courses', `${courses.length} courses`);

  if (courses.length > 0) {
    const c = courses[0];
    const hasShape = !!(c.title || c.name) && !!(c.id || c.identifier);
    hasShape ? ok('Course shape', `title="${c.title||c.name}", id=${c.id||c.identifier}`) : fail('Course shape', JSON.stringify(c).slice(0,100));

    // GET single course
    const id = c.id || c.identifier;
    const { status: s1, json: j1 } = await api(`/api/admin/courses/${id}`);
    s1 === 200
      ? ok('GET /api/admin/courses/:id', `"${c.title || id}"`)
      : fail('GET /api/admin/courses/:id', `HTTP ${s1} — ${JSON.stringify(j1).slice(0,120)}`);
  }
} else {
  fail('GET /api/admin/courses', `HTTP ${coursesStatus} — ${JSON.stringify(coursesJson).slice(0,150)}`);
}

// ══════════════════════════════════════════════
// CROSS-CHECKS
// ══════════════════════════════════════════════
section('Cross-checks');

// No orphaned courses
if (coursesDb?.length && orgsDb?.length) {
  const orgIds = new Set(orgsDb.map(o => o.id));
  const orphaned = coursesDb.filter(c => c.organization_id && !orgIds.has(c.organization_id));
  orphaned.length === 0
    ? ok('No orphaned courses', 'all sampled courses belong to a known org')
    : fail('No orphaned courses', `${orphaned.length} courses have unrecognised org_id`);
}

// Mya org membership
const { data: myaId } = await service.from('user_profiles').select('id').eq('email', MYA_EMAIL).single();
if (myaId?.id) {
  const { data: mems, error: memErr } = await service
    .from('organization_memberships').select('id,status,role').eq('user_id', myaId.id).limit(5);
  if (memErr) fail("mya's memberships", memErr.message);
  else if (!mems?.length) fail("mya's memberships", 'none found');
  else ok("mya's memberships", `${mems.length} membership(s): ${mems.map(m=>`status=${m.status} role=${m.role}`).join(', ')}`);
}

// ══════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════');
console.log(`Results: ${passed} passed / ${failed} failed`);
if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log(`  ❌ ${f}`)); }
console.log('══════════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
