import fetch from 'node-fetch';

// Demo login smoke script
// Usage: ALLOW_DEBUG_LOGIN=true PORT=8888 node scripts/demo_login_smoke.mjs

const PORT = process.env.PORT || '8888';
const HOST = `http://127.0.0.1:${PORT}`;
const URL = `${HOST}/api/auth/_debug/demo-login`;

const email = process.env.DEMO_SMOKE_EMAIL || 'mya@the-huddle.co';
const password = process.env.DEMO_SMOKE_PASSWORD || 'admin123';

(async () => {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.error('Refusing to run smoke script in production NODE_ENV');
    process.exit(2);
  }

  console.log('Posting to', URL, 'with', email);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const status = res.status;
    const bodyText = await res.text();
    let body = null;
    try { body = JSON.parse(bodyText); } catch (e) { body = bodyText; }

    const setCookie = res.headers.raw()['set-cookie'] || [];

    const okStatus = status === 200;
    const hasCookies = Array.isArray(setCookie) && setCookie.length > 0;
    const hasSessionPayload = body && (body.user || body.accessToken || body.refreshToken || body.expiresAt || body.refreshExpiresAt);

    console.log('--- RESPONSE ---');
    console.log('status:', status);
    console.log('body:', JSON.stringify(body, null, 2));
    console.log('set-cookie headers:', setCookie);

    if (okStatus && hasCookies && hasSessionPayload) {
      console.log('\nPASS: demo login smoke succeeded');
      process.exit(0);
    }

    console.error('\nFAIL: smoke assertions failed');
    if (!okStatus) console.error('unexpected status', status);
    if (!hasCookies) console.error('no Set-Cookie headers present');
    if (!hasSessionPayload) console.error('no user/session payload in response body');
    process.exit(3);
  } catch (err) {
    console.error('ERROR contacting debug endpoint', err);
    process.exit(4);
  }
})();
