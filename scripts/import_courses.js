#!/usr/bin/env node
/*
  Import courses into the local API.
  Usage:
    node scripts/import_courses.js [path/to/file.json] [--publish]

  - File shape supported:
    {
      "courses": [ { title, description, status, modules: [...] }, ... ]
    }

  This script calls POST /api/admin/courses for each course.
*/

import fs from 'fs';
import path from 'path';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('Missing ADMIN_TOKEN environment variable. Set it (e.g., ADMIN_TOKEN=your_admin_jwt) before running this script.');
  process.exit(1);
}

const API_BASE = process.env.API_URL || 'http://localhost:8888';
const INPUT = process.argv[2] || 'import/courses-template.json';
const PUBLISH = process.argv.includes('--publish');
const DEDUPE = process.argv.includes('--dedupe') || process.argv.includes('--upsert-by=slug');
const PRUNE = process.argv.includes('--prune-duplicates') || process.argv.includes('--prune');
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const WAIT = process.argv.includes('--wait');
const WAIT_TIMEOUT_MS = (() => {
  const idx = process.argv.findIndex((a) => a === '--wait-timeout');
  if (idx !== -1 && process.argv[idx + 1]) {
    const v = parseInt(process.argv[idx + 1], 10);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 10000; // 10s default
})();

function readJson(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (input.courses && Array.isArray(input.courses)) return input.courses;
  return [input];
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    ...extra,
  };
}

async function postJson(url, body) {
  if (DRY_RUN) {
    console.log(`[dry-run] POST ${url}`);
    return { data: { id: body?.course?.id || '(dry-run-id)' } };
  }
  // For demo/dev we attempt without CSRF first; if blocked we fetch token and retry
  const headers = authHeaders({ 'Content-Type': 'application/json' });
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 403) {
    // Try to obtain CSRF token via cookie pattern endpoint (if exposed)
    try {
      const tokenRes = await fetch(`${API_BASE}/api/auth/csrf`, { headers: authHeaders() });
      if (tokenRes.ok) {
        const json = await tokenRes.json().catch(() => ({}));
        if (json?.csrfToken) {
          headers['x-csrf-token'] = json.csrfToken;
          res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        }
      }
    } catch {}
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = data?.error || data?.message || res.statusText;
    throw new Error(`${res.status} ${message}`);
  }
  return data;
}

async function getJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.json();
}

async function deleteReq(url) {
  if (DRY_RUN) {
    console.log(`[dry-run] DELETE ${url}`);
    return;
  }
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => '');
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} ${txt}`);
  }
}

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  const url = `${API_BASE}/api/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function normalizeCourseForPayload(c) {
  const slugify = (s = '') =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);

  const course = {
    id: c.id,
    slug: c.slug || slugify(c.title || c.id || ''),
    title: c.title,
    description: c.description ?? null,
    status: c.status || 'draft',
    version: c.version || 1,
    // Store misc attributes inside meta so the server preserves them in demo mode
    meta: {
      difficulty: c.difficulty ?? null,
      estimated_duration: c.estimatedDuration ?? null,
      tags: c.tags ?? [],
      key_takeaways: c.keyTakeaways ?? [],
      thumbnail: c.thumbnail ?? null,
    },
  };

  const modules = (c.modules || []).map((m, mi) => ({
    id: m.id,
    title: m.title || `Module ${mi + 1}`,
    description: m.description ?? null,
    order: Number.isFinite(m.order) ? m.order : mi + 1,
    lessons: (m.lessons || []).map((l, li) => ({
      id: l.id,
      title: l.title || `Lesson ${li + 1}`,
      description: l.description ?? null,
      // Map unsupported 'document' -> 'resource' for server validator
      type: l.type === 'document' ? 'resource' : l.type,
      order: Number.isFinite(l.order) ? l.order : li + 1,
      duration_s: l.duration_s ?? null,
      // server supports content_json; we pass as 'content' and server normalizes
      content: l.content || {},
      // Optional completion rule passthrough
      completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
    })),
  }));

  return { course, modules };
}

async function importCourses() {
  if (WAIT) {
    const ok = await waitForHealth(WAIT_TIMEOUT_MS);
    if (!ok) {
      console.error(`Server not healthy at ${API_BASE} within ${WAIT_TIMEOUT_MS}ms`);
      process.exit(1);
    }
  }
  const slugify = (s = '') =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);

  const input = readJson(INPUT);
  const items = toArray(input);
  if (items.length === 0) {
    console.error('No courses found in input file. Expected { "courses": [ ... ] }');
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  const createdIds = [];
  const importedSlugs = [];

  // Preload existing courses when dedupe is enabled
  let existing = [];
  if (DEDUPE) {
    try {
      const res = await getJson(`${API_BASE}/api/admin/courses`);
      existing = Array.isArray(res?.data) ? res.data : [];
    } catch (e) {
      console.warn('Warning: failed to fetch existing courses for dedupe:', e.message);
    }
  }

  for (const item of items) {
    try {
      const payload = normalizeCourseForPayload(item);
      const desiredSlug = payload.course.slug || slugify(payload.course.title || payload.course.id || '');

      // Dedupe/upsert by slug: if an existing course has the same slug, reuse its id
      if (DEDUPE && existing.length > 0 && desiredSlug) {
        const matches = existing.filter((c) => String(c.slug || '').toLowerCase() === desiredSlug.toLowerCase());
        if (matches.length > 0) {
          // Reuse first match id for upsert
          payload.course.id = matches[0].id;
          // If version present, bump it optimistically
          const currentVersion = typeof matches[0].version === 'number' ? matches[0].version : 0;
          payload.course.version = Math.max(currentVersion + 1, payload.course.version || 1);
          console.log(`↻ Upserting into existing course id=${matches[0].id} (slug=${desiredSlug})`);
        }
      }
      const result = await postJson(`${API_BASE}/api/admin/courses`, payload);
      const newId = result?.data?.id || payload.course.id || '(no-id)';
      createdIds.push(newId);
      importedSlugs.push(desiredSlug);
      console.log(`✔ Imported course: ${payload.course.title} (${newId})`);
      ok++;
    } catch (err) {
      console.error(`✖ Failed to import course "${item?.title || item?.course?.title || 'unknown'}":`, err.message);
      fail++;
    }
  }

  if (PUBLISH && createdIds.length > 0) {
    console.log(`Publishing ${createdIds.length} course(s)...`);
    for (const id of createdIds) {
      try {
        await postJson(`${API_BASE}/api/admin/courses/${id}/publish`, {});
        console.log(`  • Published ${id}`);
      } catch (err) {
        console.warn(`  • Publish failed for ${id}: ${err.message}`);
      }
    }
  }

  // Optionally prune duplicate courses with the same slug, keeping the most recently imported id
  if (PRUNE && DEDUPE && importedSlugs.length > 0) {
    try {
      const res = await getJson(`${API_BASE}/api/admin/courses`);
      const all = Array.isArray(res?.data) ? res.data : [];
      for (let i = 0; i < importedSlugs.length; i++) {
        const slug = importedSlugs[i];
        if (!slug) continue;
        const group = all.filter((c) => String(c.slug || '').toLowerCase() === slug.toLowerCase());
        if (group.length <= 1) continue;
        // Keep the id we just created/upserted for this slug
        const keepId = createdIds[i];
        for (const c of group) {
          if (String(c.id) === String(keepId)) continue;
          try {
            await deleteReq(`${API_BASE}/api/admin/courses/${c.id}`);
            console.log(`  • Deleted duplicate course ${c.id} (slug=${slug})`);
          } catch (e) {
            console.warn(`  • Failed to delete duplicate ${c.id}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.warn('Warning: prune step failed:', e.message);
    }
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

// Node 18+ has fetch globally. If not available, instruct user to upgrade.
if (typeof fetch !== 'function') {
  console.error('This script requires Node 18+ (global fetch). Please upgrade Node or add a fetch polyfill.');
  process.exit(1);
}

importCourses().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
