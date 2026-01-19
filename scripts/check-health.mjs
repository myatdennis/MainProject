#!/usr/bin/env node
import { execSync } from 'child_process';

const baseUrl = process.env.HEALTH_BASE_URL || 'http://localhost:8888';
const normalizeBase = (value) => value.replace(/\/$/, '');
const normalizedBase = normalizeBase(baseUrl);

function curlJson(pathname) {
  const url = `${normalizedBase}${pathname}`;
  const output = execSync(`curl -fsS ${url}`, { encoding: 'utf8' });
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${url}: ${error.message}`);
  }
}

try {
  const root = curlJson('/health');
  if (!root?.ok) {
    console.error('Root /health endpoint did not return ok=true');
    process.exit(1);
  }
  console.log('✓ /health OK');

  const api = curlJson('/api/health');
  if (!api?.ok) {
    console.error('/api/health did not return ok=true');
    process.exit(1);
  }
  if (!api?.version) {
    console.error('/api/health payload missing version');
    process.exit(1);
  }
  console.log(`✓ /api/health OK (env=${api.env}, version=${api.version})`);

  const db = curlJson('/api/health/db');
  if (!db?.ok) {
    console.error(`/api/health/db reported status=${db?.status}`);
    process.exit(1);
  }
  console.log(`✓ /api/health/db OK (latencyMs=${db.latencyMs ?? 'n/a'})`);
} catch (error) {
  console.error('Health check failed:', error.message);
  process.exit(1);
}
