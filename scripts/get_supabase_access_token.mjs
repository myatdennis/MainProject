#!/usr/bin/env node

const requiredEnv = [
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const { ADMIN_EMAIL, ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

const tokenUrl = new URL('/auth/v1/token', SUPABASE_URL);
tokenUrl.searchParams.set('grant_type', 'password');

async function main() {
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      credentials: 'include',
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = payload?.error_description || payload?.error || response.statusText;
      console.error(`Supabase auth failed: ${reason || 'Unknown error'}`);
      process.exit(1);
    }

    const token = payload?.access_token;
    if (!token) {
      console.error('Supabase did not return an access_token.');
      process.exit(1);
    }

    // Success: print only the token so the caller can capture/export it safely.
    process.stdout.write(token);
  } catch (error) {
    const message = error?.message || 'Unknown error';
    console.error(`Supabase auth request failed: ${message}`);
    process.exit(1);
  }
}

main();
