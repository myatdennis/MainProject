import { chromium } from 'playwright';

(async () => {
  const logs = [];
  const browser = await chromium.launch({ headless: true });
  // Create a normal context without global extra headers (those apply to every request,
  // including third-party fonts and cause CORS preflight failures). Instead we set a
  // same-origin cookie inside the page to signal the server to allow the E2E bypass.
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject client-side E2E bootstrap so the app treats this browser as an E2E admin session.
  // This sets the same window/localStorage flags the app checks in `sessionBootstrap.isE2EBootstrapBypassEnabled()`
  await page.addInitScript(() => {
    try {
      window.__E2E_BYPASS = true;
      window.__E2E_USER_ROLE = 'admin';
      window.localStorage && window.localStorage.setItem && window.localStorage.setItem('huddle_lms_auth', 'true');
      // Set a same-site cookie the server can read to allow E2E bypass without adding
      // a global extraHTTPHeader (which breaks third-party requests). The server
      // middleware checks req.cookies['x-e2e-bypass'] or req.cookies['e2e_bypass'].
      try {
        document.cookie = 'x-e2e-bypass=true; path=/';
        // also set an explicit x-user-role cookie so the server can grant admin/demo context
        document.cookie = 'x-user-role=admin; path=/';
      } catch (e) { /* ignore */ }
      // Monkey-patch fetch to attach an X-E2E-Bypass header on same-origin /api requests
      try {
        const _fetch = window.fetch.bind(window);
        window.fetch = function (input, init = {}) {
          try {
            const url = typeof input === 'string' ? input : input?.url || '';
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')) {
              init = init || {};
              init.headers = init.headers || {};
              // Respect existing header shapes (Headers instance or plain object)
              if (typeof init.headers.append === 'function') {
                init.headers.append('X-E2E-Bypass', 'true');
                init.headers.append('x-user-role', 'admin');
              } else {
                init.headers['X-E2E-Bypass'] = 'true';
                init.headers['x-user-role'] = 'admin';
              }
            }
          } catch (e) {
            // ignore
          }
          return _fetch(input, init);
        };
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  });

  page.on('console', (msg) => {
    try {
      const text = msg.text();
      const type = msg.type();
      const out = { ts: Date.now(), type, text };
      logs.push(out);
      // Mirror to stdout for CI capture
      console.log('[PW_CONSOLE]', JSON.stringify(out));
    } catch (e) {
      console.log('[PW_CONSOLE] (err reading message)', e?.message || e);
    }
  });

  page.on('pageerror', (err) => {
    const out = { ts: Date.now(), type: 'pageerror', text: String(err) };
    logs.push(out);
    console.log('[PW_PAGEERROR]', JSON.stringify(out));
  });

  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      const status = resp.status();
      // Only log admin endpoints and health
      if (url.includes('/api/admin') || url.includes('/api/health') || url.includes('/api/admin/courses')) {
        const out = { ts: Date.now(), type: 'response', url, status };
        logs.push(out);
        console.log('[PW_RESPONSE]', JSON.stringify(out));
      }
    } catch (e) {
      console.log('[PW_RESPONSE] error', e?.message || e);
    }
  });

  const target = process.env.TARGET_ORIGIN ?? 'http://127.0.0.1:8888';
  const url = `${target}/admin/courses?e2e_bypass=1`;
  console.log('[PW] Navigating to', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => {
      console.log('[PW] goto failed', e && e.message);
    });
  } catch (e) {
    console.log('[PW] navigation exception', e?.message || e);
  }

  // Wait and capture logs for a bit to let init run
  const captureMs = 20000;
  console.log(`[PW] Capturing console logs for ${captureMs}ms...`);
  await new Promise((res) => setTimeout(res, captureMs));

  // Dump a short summary
  console.log('[PW] Summary: total logs captured =', logs.length);
  const instrumentLogs = logs.filter(l => typeof l.text === 'string' && l.text.includes('courseStore.instrument') || (l.type === 'response' && l.url && l.url.includes('/api/admin')) );
  console.log('[PW] Instrument log samples (first 50):');
  for (let i = 0; i < Math.min(instrumentLogs.length, 50); i++) {
    console.log('[PW_SAMPLE]', JSON.stringify(instrumentLogs[i]));
  }

  try {
    await page.screenshot({ path: 'playwright_admin_courses.png', fullPage: true }).catch(() => {});
    console.log('[PW] screenshot saved: playwright_admin_courses.png');
  } catch (e) {
    console.log('[PW] screenshot error', e?.message || e);
  }

  await browser.close();
  process.exit(0);
})();
