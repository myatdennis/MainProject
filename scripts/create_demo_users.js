#!/usr/bin/env node
/*
  create_demo_users.js

  Usage (run locally):
    SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/create_demo_users.js

  This script uses the Supabase service role key to create demo users (admin and lms user).
  It intentionally does minimal checks and is meant to be run locally by a developer/maintainer.
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const users = [
  {
    email: 'admin@thehuddleco.com',
    password: 'admin123',
    role: 'admin',
    name: 'Mya Dennis'
  },
  {
    email: 'user@pacificcoast.edu',
    password: 'user123',
    role: 'user',
    name: 'Sarah Chen'
  }
];

async function createUser(u) {
  const url = `${SUPABASE_URL.replace(/\/+$/,'')}/auth/v1/admin/users`;

  const body = {
    email: u.email,
    password: u.password,
    user_metadata: { name: u.name, role: u.role }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`Failed to create user ${u.email}:`, res.status, txt);
    return false;
  }

  const data = await res.json();
  console.log('Created or returned user:', data.id || data.user?.id || data.email || u.email);
  // Try to create a user profile row (if your Supabase project has a 'user_profiles' table)
  try {
    const profileRes = await fetch(`${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ user_id: data.id || data.user?.id || null, name: u.name, email: u.email, role: u.role })
    });
    if (!profileRes.ok) {
      const txt = await profileRes.text();
      console.warn('Profile insert failed:', profileRes.status, txt);
    } else {
      console.log('Profile upserted for', u.email);
    }
  } catch (err) {
    console.warn('Profile insert exception:', err);
  }

  return true;
}

(async () => {
  for (const u of users) {
    try {
      await createUser(u);
    } catch (err) {
      console.error('Error creating user', u.email, err);
    }
  }
})();
