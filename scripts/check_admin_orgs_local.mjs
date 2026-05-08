#!/usr/bin/env node
// Simple smoke check for local dev admin orgs endpoint.
import process from 'process';

const PORT = process.env.PORT || process.env.SERVER_PORT || '3000';
const url = `http://127.0.0.1:${PORT}/api/dev/diagnostics/admin-orgs-local`;

console.info('[check_admin_orgs_local] checking', { url });

try {
  const res = await fetch(url, { method: 'GET' });
  if (!res) {
    console.error('[check_admin_orgs_local] no response');
    process.exit(2);
  }
  if (res.status !== 200) {
    console.error('[check_admin_orgs_local] unexpected status', res.status);
    const body = await res.text().catch(() => '<no-body>');
    console.error(body);
    process.exit(3);
  }
  const json = await res.json().catch(() => null);
  if (!json || !json.ok) {
    console.error('[check_admin_orgs_local] invalid json or ok=false', json);
    process.exit(4);
  }
  const total = typeof json.total === 'number' ? json.total : (Array.isArray(json.organizations) ? json.organizations.length : 0);
  if (total <= 0) {
    console.error('[check_admin_orgs_local] no organizations returned', { total, sample: json.organizations?.slice(0,3) });
    process.exit(5);
  }
  console.info('[check_admin_orgs_local] ok', { total });
  process.exit(0);
} catch (err) {
  console.error('[check_admin_orgs_local] failed', err instanceof Error ? err.message : String(err));
  process.exit(10);
}
