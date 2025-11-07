#!/usr/bin/env node
/*
  Prune duplicate courses by slug using the admin API.
  Usage:
    node scripts/prune_duplicates.js [--keep=first|last] [--dry-run]

  - Fetches /api/admin/courses, groups by slug, and deletes all but one per slug.
  - Keep policy:
      --keep=first (default): keep the first occurrence in the list
      --keep=last: keep the last occurrence in the list
  - --dry-run: Print planned deletions without making changes
  - API base may be overridden via API_URL env var (default http://localhost:8888)
*/

const API_BASE = process.env.API_URL || 'http://localhost:8888';
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dry');
const KEEP = (() => {
  const keepIdx = args.findIndex((a) => a.startsWith('--keep='));
  if (keepIdx !== -1) {
    const v = args[keepIdx].split('=')[1];
    if (v === 'first' || v === 'last') return v;
  }
  return 'first';
})();

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.json();
}

async function del(url) {
  if (DRY_RUN) {
    console.log(`[dry-run] DELETE ${url}`);
    return;
  }
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => '');
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} ${txt}`);
  }
}

function groupBySlug(courses) {
  const map = new Map();
  for (const c of courses) {
    const slug = String(c.slug || '').toLowerCase();
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug).push(c);
  }
  return map;
}

async function main() {
  const res = await getJson(`${API_BASE}/api/admin/courses`);
  const courses = Array.isArray(res?.data) ? res.data : [];
  const groups = groupBySlug(courses);
  let deletions = 0;

  for (const [slug, list] of groups.entries()) {
    if (list.length <= 1) continue;
    let keep;
    if (KEEP === 'last') keep = list[list.length - 1];
    else keep = list[0];

    console.log(`Slug ${slug} has ${list.length} entries; keeping ${keep.id}`);
    for (const c of list) {
      if (String(c.id) === String(keep.id)) continue;
      try {
        await del(`${API_BASE}/api/admin/courses/${c.id}`);
        console.log(`  • Deleted duplicate ${c.id}`);
        deletions++;
      } catch (e) {
        console.warn(`  • Failed to delete ${c.id}: ${e.message}`);
      }
    }
  }

  console.log(`Done. Deleted ${deletions} duplicate course(s).`);
}

if (typeof fetch !== 'function') {
  console.error('This script requires Node 18+ (global fetch).');
  process.exit(1);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
