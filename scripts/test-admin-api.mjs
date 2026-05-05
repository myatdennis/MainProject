import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!EMAIL || !PASSWORD || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('TEST_EMAIL, TEST_PASSWORD, SUPABASE_URL, and SUPABASE_ANON_KEY must be provided in env');
  process.exit(1);
}

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error || !data.session?.access_token) {
    console.error('Supabase login failed', error?.message || 'missing session');
    process.exit(2);
  }

  const token = data.session.access_token;
  const res = await fetch(`${BASE_URL}/api/admin/organizations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status !== 200) {
    console.error('Admin API failed status:', res.status);
    const text = await res.text().catch(() => null);
    console.error('Response body:', text);
    process.exit(4);
  }

  const json = await res.json().catch(() => null);
  const payload = Array.isArray(json) ? json : json?.data ?? json;
  if (!Array.isArray(payload)) {
    console.error('Invalid organizations payload:', json);
    process.exit(5);
  }

  console.log('Admin API OK - organizations:', payload.length);
}

test().catch((err) => {
  console.error('Admin API smoke test failed:', err);
  process.exit(1);
});
