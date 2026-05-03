import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('TEST_EMAIL and TEST_PASSWORD must be provided in env');
  process.exit(1);
}

const buildCookieHeader = (headers) => {
  const rawCookies =
    typeof headers.raw === 'function'
      ? headers.raw()['set-cookie'] || []
      : [headers.get('set-cookie')].filter(Boolean);
  return rawCookies.map((entry) => String(entry).split(';')[0]).filter(Boolean).join('; ');
};

async function test() {
  // Step 1: login to obtain session cookie
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (loginRes.status !== 200) {
    const text = await loginRes.text().catch(() => null);
    console.error('Login failed', loginRes.status, text);
    process.exit(2);
  }

  const cookieHeader = buildCookieHeader(loginRes.headers);
  if (!cookieHeader) {
    console.error('Login did not return set-cookie header. Full headers:', Array.from(loginRes.headers.entries()));
    process.exit(3);
  }

  // Step 2: call admin endpoint with the session cookie
  const res = await fetch(`${BASE_URL}/api/admin/organizations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
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

  console.log('✅ Admin API OK - organizations:', payload.length);
}

test().catch((err) => {
  console.error('Admin API smoke test failed:', err);
  process.exit(1);
});
