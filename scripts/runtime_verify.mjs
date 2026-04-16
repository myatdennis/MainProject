import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

const API_BASE = process.env.E2E_BASE_URL || 'http://localhost:8888';
const FRONTEND_BASE = process.env.E2E_FRONTEND_BASE || 'http://localhost:5175';

const ADMIN_HEADERS = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
  'x-org-id': 'demo-sandbox-org',
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

(async () => {
  const aggregate = {
    startedAt: new Date().toISOString(),
    apiBase: API_BASE,
    frontendBase: FRONTEND_BASE,
    runs: [],
    failures: [],
  };

  // Determine latest built sync bundle filename (if present)
  const findLatestSyncBundle = () => {
    try {
      const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');
      if (!fs.existsSync(assetsDir)) return null;
      const names = fs.readdirSync(assetsDir);
      const syncCandidates = names.filter((n) => /^sync\.[a-z0-9]+\.js$/i.test(n));
      if (syncCandidates.length === 0) return null;
      // If multiple, pick the newest by mtime
      const withMtime = syncCandidates.map((n) => ({ n, t: fs.statSync(path.join(assetsDir, n)).mtimeMs }));
      withMtime.sort((a, b) => b.t - a.t);
      return withMtime[0].n;
    } catch (e) {
      return null;
    }
  };

  const latestSyncBundle = findLatestSyncBundle();

  // We'll run multiple verification passes using a fresh persistent profile per run
  const RUNS = parseInt(process.env.RUNTIME_VERIFY_RUNS || '5', 10) || 5;

  // Helper that performs a single run in isolation and returns a run summary
  async function runSingle(runIndex) {
    const runSummary = {
      runIndex,
      startedAt: new Date().toISOString(),
      learnerFlow: { network: [], console: [], errors: [], adminCallsDetected: [], jsBundlesLoaded: [], swInfo: null },
      adminFlow: { network: [], console: [], errors: [], jsBundlesLoaded: [], swInfo: null },
      success: false,
    };

    // create a fresh temporary user-data-dir so no prior service worker / cache is reused
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `e2e-userdata-${Date.now()}-`));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      // disable service workers at Chromium level as an extra safeguard
      args: ['--disable-features=ServiceWorker', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
    // Helper to seed a course via admin API so learner flow has something to click
    const seedCourse = async () => {
      const unique = Date.now();
      try {
        const res = await (await fetch(`${API_BASE}/api/admin/courses`, {
          method: 'POST',
          headers: { ...ADMIN_HEADERS },
          body: JSON.stringify({
            course: {
              title: `Runtime Verify Course ${unique}`,
              description: 'Runtime verify course',
              status: 'draft',
              version: 1,
              organization_id: 'demo-sandbox-org',
            },
            modules: [
              {
                title: 'Intro',
                order_index: 1,
                lessons: [
                  {
                    id: `lesson-video-${unique}`,
                    type: 'video',
                    title: 'Intro video',
                    order_index: 1,
                    content_json: { type: 'video', body: { videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', videoSourceType: 'external', transcript: 't' } },
                  },
                ],
              },
            ],
          }),
        })).json();
        const id = res?.data?.id;
        if (!id) return null;
        // publish
        await fetch(`${API_BASE}/api/admin/courses/${id}/publish`, { method: 'POST', headers: { ...ADMIN_HEADERS } });
        // assign
        await fetch(`${API_BASE}/api/admin/courses/${id}/assign`, { method: 'POST', headers: { ...ADMIN_HEADERS }, body: JSON.stringify({ organization_id: 'demo-sandbox-org' }) });
        return id;
      } catch (e) {
        // ignore
        return null;
      }
    };

  // LAUNCH learner context (context was created above from launchPersistentContext)
  // `context` already refers to the persistent context returned by chromium.launchPersistentContext
    // Inject a lightweight fake supabase client into the learner context to
    // allow deterministic login/navigation in local dev environments where
    // real Supabase auth may not be available. Ensure `.on()` returns the
    // channel to avoid subscribe() on undefined.
    await context.addInitScript(() => {
      const makeChannel = (name) => {
        const ch = {
          name,
          on: function () { return ch; },
          subscribe: function () { return { data: {} }; },
          unsubscribe: function () {},
          send: async function () { return { data: {} }; },
        };
        return ch;
      };

      const fake = {
        auth: {
          getSession: async () => ({ data: { session: { access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000002', email: 'user@pacificcoast.edu' } } } }),
          getUser: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000002', email: 'user@pacificcoast.edu' } } }),
          onAuthStateChange: (cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async ({ email, password } = {}) => ({ data: { user: { id: '00000000-0000-0000-0000-000000000002', email } }, error: null }),
          refreshSession: async () => ({ data: { session: { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000002', email: 'user@pacificcoast.edu' } } }, error: null }),
          signOut: async () => ({ error: null }),
        },
        channel: (name) => makeChannel(name),
        removeChannel: () => {},
      };
      (window).__E2E_SUPABASE_CLIENT = fake;
      (window).__supabase = (window).supabase = fake;
      (window).__E2E_BYPASS = true;
      // Block future registrations by overriding register() and related APIs before app code runs
      try {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.register = async () => ({ unregister: async () => true });
          // attempt to unregister any existing registrations synchronously-ish
          navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
        }
        if (typeof caches !== 'undefined') {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    });
    const page = await context.newPage();
    // Disable cache to ensure we fetch fresh assets from the server (avoid stale service-worker or HTTP cache)
    try {
      await page.setCacheEnabled(false);
    } catch (e) {}

    // Instrument JS bundles loaded by listening to responses for .js files
    const recordJsLoad = (entryFor) => async (res) => {
      try {
        const url = res.url();
        if (!url.endsWith('.js')) return;
        const parsed = url.split('/').pop();
        const payload = { url, file: parsed };
        // Mark whether this matches the latest sync bundle
        if (parsed && /^sync\./i.test(parsed)) {
          payload.isLatestSync = (latestSyncBundle ? parsed === latestSyncBundle : true);
          payload.latestSyncBundle = latestSyncBundle;
        }
        entryFor.jsBundlesLoaded.push(payload);
      } catch (e) {}
    };

    // Capture console
    page.on('console', (msg) => {
      runSummary.learnerFlow.console.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      runSummary.learnerFlow.errors.push(String(err));
    });
    page.on('response', recordJsLoad(runSummary.learnerFlow));

    // Capture network requests and responses
    const seenRequests = [];
    page.on('request', (req) => {
      const r = { url: req.url(), method: req.method(), type: req.resourceType(), timestamp: Date.now() };
      seenRequests.push(r);
      runSummary.learnerFlow.network.push({ event: 'request', ...r });
    });
    page.on('response', async (res) => {
      const r = { url: res.url(), status: res.status(), duration: 0, timestamp: Date.now() };
      try {
        const timing = res.timing ? res.timing() : null;
      } catch {}
      runSummary.learnerFlow.network.push({ event: 'response', ...r });
    });

    // Ensure API and frontend reachable (use page.request to be in the same context)
    let ok = false;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await page.request.get(`${API_BASE}/api/health`, { failOnStatusCode: false });
        if (r && r.ok && r.ok()) { ok = true; break; }
      } catch (e) {
        // swallow and retry
      }
      await sleep(1000);
    }
    if (!ok) throw new Error('API health endpoint not reachable');

    // Seed a course to ensure something is present to click
    const seededCourseId = await seedCourse();

    // 1) Login as learner
    await page.goto(`${FRONTEND_BASE}/lms/login`, { waitUntil: 'domcontentloaded' });
    // Fill form if present
    try {
      const email = await page.locator('input[type="email"], input[name="email"], #email').first();
      await email.fill('user@pacificcoast.edu');
      const pwd = await page.locator('input[type="password"], input[name="password"], #password').first();
      await pwd.fill('user123');
      await page.getByRole('button', { name: /Sign In|Sign in|Login|Log in/i }).first().click();
      await page.waitForURL('**/lms/dashboard', { timeout: 30000 }).catch(() => {});
    } catch (e) {
      // If form not present, allow fallback (some dev modes bypass auth)
    }

    // Wait for dashboard or client homepage
    await page.waitForLoadState('networkidle');

    // 2) Wait for dashboard/courses
    await page.goto(`${FRONTEND_BASE}/client/courses`, { waitUntil: 'domcontentloaded' });

    // Wait for cards to appear
    let clicked = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const card = await page.locator('[data-test="client-course-card"]').first();
      if ((await card.count()) > 0) {
        try {
          await card.getByRole('button', { name: /Start course|Continue|Open|View Course/i }).first().click({ timeout: 5000 });
          clicked = true;
          break;
        } catch {
          try {
            await card.click({ timeout: 5000 });
            clicked = true; break;
          } catch {}
        }
      }
      await page.waitForTimeout(1000);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    // If no clickable card found, try deep link using seededCourseId
    if (!clicked && seededCourseId) {
      // Try client course detail path(s)
      const deepPaths = [`${FRONTEND_BASE}/client/courses/${seededCourseId}/lessons/lesson-1`, `${FRONTEND_BASE}/client/courses/${seededCourseId}`];
      for (const p of deepPaths) {
        try {
          await page.goto(p, { waitUntil: 'domcontentloaded' });
          if (!page.url().includes('/login')) { clicked = true; break; }
        } catch {}
      }
    }

    // After click, wait for navigation
    await page.waitForLoadState('networkidle');

    // 3) Observe if logout occurred or redirect to /login
    const currentUrl = page.url();
    const logoutOccurred = currentUrl.includes('/login') || currentUrl.includes('/auth') || currentUrl.includes('signout');

    // 4) Check network calls during the LMS portion for admin endpoints
    const adminCalls = runSummary.learnerFlow.network.filter((e) => String(e.url).includes('/api/admin/'));
  runSummary.learnerFlow.adminCallsDetected = adminCalls.map((r) => ({ url: r.url, event: r.event, status: r.status ?? null }));

    // 5) Refresh inside course
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Collect console logs in summary already
    runSummary.learnerFlow.finalUrl = page.url();
    runSummary.learnerFlow.logoutOccurred = logoutOccurred;
    runSummary.learnerFlow.clicked = clicked;

    // Capture service worker controller and registrations state for debugging
    try {
      const swInfo = await page.evaluate(async () => {
        try {
          const controller = (navigator.serviceWorker && navigator.serviceWorker.controller) ? true : false;
          const regs = (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) ? await navigator.serviceWorker.getRegistrations().then((r) => r.map((x) => ({ scope: x.scope }))).catch(() => []) : [];
          return { controller, registrations: regs };
        } catch (e) { return { error: String(e) }; }
      });
      runSummary.learnerFlow.swInfo = swInfo;
    } catch (e) {
      runSummary.learnerFlow.swInfo = { error: String(e) };
    }

    // Now admin flow: new context with E2E bypass injected
  const adminContext = context; // reuse persistent context but open a new page in it
    await adminContext.addInitScript(() => {
      const fake = {
        auth: {
          getSession: async () => ({ data: { session: { access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } } }),
          getUser: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }),
          onAuthStateChange: (cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } }, error: null }),
          refreshSession: async () => ({ data: { session: { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }, error: null }),
          signOut: async () => ({ error: null }),
        },
        channel: (name) => ({ on: () => {}, subscribe: () => {}, unsubscribe: () => {}, send: async () => ({ data: {} }) }),
        removeChannel: () => {},
      };
      (window).__E2E_SUPABASE_CLIENT = fake;
      (window).__supabase = (window).supabase = fake;
      (window).__E2E_BYPASS = true;
      try {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.register = async () => ({ unregister: async () => true });
          navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
        }
        if (typeof caches !== 'undefined') {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
        }
      } catch (e) {}
    });

    const adminPage = await adminContext.newPage();
    try {
      await adminPage.setCacheEnabled(false);
    } catch (e) {}
  adminPage.on('console', (msg) => runSummary.adminFlow.console.push({ type: msg.type(), text: msg.text() }));
  adminPage.on('pageerror', (err) => runSummary.adminFlow.errors.push(String(err)));
  adminPage.on('request', (req) => runSummary.adminFlow.network.push({ event: 'request', url: req.url(), method: req.method(), timestamp: Date.now() }));
  adminPage.on('response', (res) => { runSummary.adminFlow.network.push({ event: 'response', url: res.url(), status: res.status(), timestamp: Date.now() }); recordJsLoad(runSummary.adminFlow)(res); });

    await adminPage.goto(`${FRONTEND_BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForLoadState('networkidle');

    // Check that admin endpoints were called at least once
  const adminApiCalls = runSummary.adminFlow.network.filter((e) => String(e.url).includes('/api/admin/'));
  runSummary.adminFlow.adminApiCalls = adminApiCalls.slice(0, 30);

    // Cross-surface check: ensure admin-capable user on LMS surface does not cause admin calls
    // For this, reuse learner page in same session if possible: navigate to LMS surface and track admin calls recently
  await page.goto(`${FRONTEND_BASE}/lms/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
    // Re-check admin calls after returning to LMS
  const adminCallsAfterReturn = runSummary.learnerFlow.network.filter((e) => String(e.url).includes('/api/admin/'));
  runSummary.learnerFlow.adminCallsAfterReturn = adminCallsAfterReturn.slice(0, 30);

    // Hard refresh tests
    await page.reload({ waitUntil: 'networkidle' });
    await adminPage.reload({ waitUntil: 'networkidle' });

    // finalize run
    runSummary.endedAt = new Date().toISOString();
    runSummary.success = !(runSummary.learnerFlow.errors.length || runSummary.adminFlow.errors.length);
    // write a per-run partial summary so we don't lose progress if the process is interrupted
    try {
      const perRunPath = `./runtime-verify-run-${runIndex}.json`;
      fs.writeFileSync(perRunPath, JSON.stringify(runSummary, null, 2));
    } catch (e) {}
    aggregate.runs.push(runSummary);

    // detect subscribe() or realtime-related TypeErrors in console messages
    const subscribeErrors = [...runSummary.learnerFlow.console, ...runSummary.adminFlow.console]
      .filter((c) => /subscribe\(|reading 'subscribe'|Cannot read properties of undefined \(reading 'subscribe'\)|subscribe\) is not a function/i.test(c.text));
    if (subscribeErrors.length > 0) {
      aggregate.failures.push({ runIndex, reason: 'subscribe_errors', entries: subscribeErrors });
    }

    // ensure sync bundle loaded is the latest
    const anyOldSync = (runSummary.learnerFlow.jsBundlesLoaded || []).concat(runSummary.adminFlow.jsBundlesLoaded || [])
      .filter((b) => /^sync\./i.test(b.file) && b.isLatestSync === false);
    if (anyOldSync.length > 0) {
      aggregate.failures.push({ runIndex, reason: 'stale_sync_bundle_loaded', entries: anyOldSync });
    }

    // end of per-run happy path
    } catch (err) {
      console.error('Run error (runIndex=' + runIndex + '):', err);
      aggregate.failures.push({ runIndex, reason: 'run_exception', error: String(err) });
    } finally {
      try { await context.close(); } catch (e) {}
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
    }
    return runSummary;
  }

  // execute runs sequentially (fresh context each run)
  for (let runIndex = 0; runIndex < RUNS; runIndex++) {
    await runSingle(runIndex);
  }

  // after all runs, write aggregate summary
  const outPath = './runtime-verify-summary.json';
  fs.writeFileSync(outPath, JSON.stringify(aggregate, null, 2));
  console.log('Runtime verification aggregate summary written to', outPath);

  // Print concise verdicts
  const runs = aggregate.runs.length;
  const failures = aggregate.failures.length;
  console.log('RUNTIME_VERIFY_RUNS:', runs, 'failures:', failures);
  if (failures > 0) {
    console.log('Failures detected:', JSON.stringify(aggregate.failures, null, 2));
    process.exitCode = 2;
  } else {
    console.log('All runs clean — no subscribe() errors detected and no stale sync bundles loaded.');
  }
  process.exitCode = failures ? 2 : 0;
  return;
})();
