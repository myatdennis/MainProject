#!/usr/bin/env node
const inferredPort = Number(process.env.PORT) || 3000;
const baseUrl = process.env.HEALTH_BASE_URL || `http://localhost:${inferredPort}`;
const normalizeBase = (value) => value.replace(/\/$/, '');
const normalizedBase = normalizeBase(baseUrl);

async function fetchJson(pathname) {
  const url = `${normalizedBase}${pathname}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const output = await response.text();
  let payload = null;
  try {
    payload = output ? JSON.parse(output) : null;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${url}: ${error.message}`);
  }
  return { url, response, payload };
}

try {
  const rootResult = await fetchJson('/health');
  const root = rootResult.payload;
  if (!root?.ok) {
    console.error('Root /health endpoint did not return ok=true');
    process.exit(1);
  }
  console.log('✓ /health OK');

  const apiResult = await fetchJson('/api/health');
  const api = apiResult.payload;
  if (!api?.ok) {
    console.error('/api/health did not return ok=true');
    process.exit(1);
  }
  if (!api?.version) {
    console.error('/api/health payload missing version');
    process.exit(1);
  }
  console.log(`✓ /api/health OK (env=${api.env}, version=${api.version})`);

  const dbResult = await fetchJson('/api/health/db');
  const db = dbResult.payload;
  const strictWritable = String(process.env.HEALTH_REQUIRE_DB_WRITABLE || '').toLowerCase() === 'true';
  const dbReachable = db?.ok === true || String(db?.status || '').toLowerCase() === 'ok';
  if (!dbReachable) {
    console.error(`/api/health/db reported unreachable status=${db?.status} (http=${dbResult.response.status})`);
    process.exit(1);
  }
  if (strictWritable && db?.writable === false) {
    console.error('/api/health/db is reachable but not writable (HEALTH_REQUIRE_DB_WRITABLE=true)');
    process.exit(1);
  }
  console.log(`✓ /api/health/db reachable (writable=${db?.writable === true}, latencyMs=${db.latencyMs ?? 'n/a'})`);
} catch (error) {
  console.error('Health check failed:', error.message);
  process.exit(1);
}
