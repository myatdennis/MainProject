/*
  create_demo_users.ts

  Usage (run locally):
    SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node ./dist/scripts/create_demo_users.js

  This script uses the Supabase service role key to create demo users (admin and lms user).
  It intentionally does minimal checks and is meant to be run locally by a developer/maintainer.
*/

export {};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const users = [
  {
    email: 'mya@the-huddle.co',
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

async function createUser(u: { email: string; password: string; role: string; name: string }) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`; // admin users endpoint

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
    credentials: 'include',
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`Failed to create user ${u.email}:`, res.status, txt);
    return false;
  }

  const data = await res.json();
  console.log('Created user:', data.id, u.email);
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
