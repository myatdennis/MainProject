import fetch from 'node-fetch';

const BASE = process.env.ANALYTICS_SMOKE_BASE || 'http://127.0.0.1:3000';

// Minimal double-submit CSRF helpers (borrowed from survey smoke script)
const mergeSetCookie = (existingCookie, response) => {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  if (!Array.isArray(setCookies) || setCookies.length === 0) {
    return existingCookie || null;
  }
  const cookieMap = new Map();
  const existingParts = String(existingCookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  existingParts.forEach((pair) => {
    const [name, ...rest] = pair.split('=');
    if (!name || rest.length === 0) return;
    cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=').trim()}`);
  });
  setCookies.forEach((entry) => {
    const [pair] = String(entry || '').split(';');
    const [name, ...rest] = pair.split('=');
    if (!name || rest.length === 0) return;
    cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=').trim()}`);
  });
  return Array.from(cookieMap.values()).join('; ');
};

const readCookieValue = (cookieHeader, name) => {
  const pairs = String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    if (!key || rest.length === 0) continue;
    if (key.trim() === name) return rest.join('=').trim();
  }
  return null;
};

const csrfState = { token: null, cookie: null };

const primeCsrf = async () => {
  const response = await fetch(`${BASE}/api/auth/csrf`, { method: 'GET' });
  const text = await response.text();
  if (!response.ok) throw new Error(`csrf bootstrap failed (${response.status}): ${text}`);
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  const cookie = mergeSetCookie(csrfState.cookie || null, response);
  const cookieToken = readCookieValue(cookie, 'csrf_token');
  const token = cookieToken || parsed?.csrfToken || parsed?.data?.csrfToken || parsed?.token || null;
  if (!token) throw new Error(`csrf bootstrap missing token: ${text}`);
  csrfState.token = token;
  csrfState.cookie = cookie;
};

const buildHeaders = (json = false) => {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (csrfState.token) headers['X-CSRF-Token'] = csrfState.token;
  if (csrfState.cookie) headers['Cookie'] = csrfState.cookie;
  return headers;
};

async function postEvent() {
  await primeCsrf();
  const res = await fetch(`${BASE}/api/analytics/events`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify({ id: `smoke-${Date.now()}`, event_type: 'smoke_test', payload: { email: 'smoke@example.com' } }),
  });
  console.log('/api/analytics/events', res.status);
  console.log(await res.text());
}

async function postBatch() {
  await primeCsrf();
  const res = await fetch(`${BASE}/api/analytics/events/batch`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify({ events: [ { clientEventId: `batch-${Date.now()}`, eventType: 'batch_test', payload: { email: 'batch@example.com' } } ] }),
  });
  console.log('/api/analytics/events/batch', res.status);
  console.log(await res.text());
}

async function getEvents() {
  const res = await fetch(`${BASE}/api/analytics/events`, { headers: buildHeaders(false) });
  console.log('/api/analytics/events (GET)', res.status);
  console.log(await res.text());
}

(async () => {
  try {
    await postEvent();
    await postBatch();
    await getEvents();
  } catch (err) {
    console.error('smoke test failed', err);
    process.exit(2);
  }
})();
