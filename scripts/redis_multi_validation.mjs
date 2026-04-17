#!/usr/bin/env node
import fetch from 'node-fetch';

const serverA = process.env.SERVER_A || 'http://127.0.0.1:8888';
const serverB = process.env.SERVER_B || 'http://127.0.0.1:8889';
const devKey = process.env.DEV_TOOLS_KEY || 'devkey';
const userId = process.env.TEST_USER_ID || '00000000-0000-0000-0000-00000000aaa1';

const headers = { 'x-dev-tools-key': devKey, 'content-type': 'application/json' };

const log = (...args) => console.log(new Date().toISOString(), ...args);

const setCache = async (base, value, ttlMs) => {
  const res = await fetch(`${base}/api/dev/diagnostics/cache`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, value, ttlMs }),
  });
  return res.json();
};

const getCache = async (base) => {
  const res = await fetch(`${base}/api/dev/diagnostics/cache?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { 'x-dev-tools-key': devKey },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

const delCache = async (base) => {
  const res = await fetch(`${base}/api/dev/diagnostics/cache?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { 'x-dev-tools-key': devKey },
  });
  return res.json();
};

const assertEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const run = async () => {
  log('Starting Redis multi-instance validation');
  try {
    // A: write cache from server A
    const initial = [{ orgId: 'org-123', role: 'learner', status: 'active' }];
    log('Setting initial cache on A');
    await setCache(serverA, initial, 60000);

    // B: read cache from server B
    log('Reading cache from B');
    const read1 = await getCache(serverB);
    log('B read result:', JSON.stringify(read1));

    if (!read1 || !read1.value) {
      log('FAIL: B did not return cached value (initial)');
      process.exitCode = 2; return;
    }

    // C: update cache from A
    const updated = [{ orgId: 'org-123', role: 'admin', status: 'active' }];
    log('Updating cache on A');
    await setCache(serverA, updated, 60000);

    // D: confirm B sees update
    log('Reading cache from B after update');
    const read2 = await getCache(serverB);
    log('B read after update:', JSON.stringify(read2));
    if (!read2 || !read2.value || !assertEqual(read2.value, updated)) {
      log('FAIL: B did not reflect updated value');
      process.exitCode = 3; return;
    }

    // E: delete cache from A
    log('Deleting cache on A');
    await delCache(serverA);

    // F: confirm B reflects deletion
    log('Reading cache from B after delete');
    const read3 = await getCache(serverB);
    log('B read after delete:', JSON.stringify(read3));
    if (read3 && read3.value) {
      log('FAIL: B still has value after delete');
      process.exitCode = 4; return;
    }

    log('PASS: Redis multi-instance validation succeeded');
    process.exitCode = 0;
  } catch (err) {
    log('ERROR', err.stack || err);
    process.exitCode = 1;
  }
};

run();
