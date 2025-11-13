const playwright = require('playwright');
const fs = require('fs');

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:5174';
  const loginPath = process.env.LOGIN_PATH || '/lms/login';
  const navPath = process.env.NAV_PATH || null; // optional path to navigate to after login (e.g. /lms/course/foundations)
  const email = process.env.TEST_EMAIL || 'demo@local';
  const password = process.env.TEST_PASSWORD || 'demo';

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const network = [];
  const consoleMsgs = [];

  page.on('request', req => {
    network.push({ type: 'request', method: req.method(), url: req.url() });
    if (req.postData()) network[network.length-1].postData = req.postData();
  });
  page.on('response', async res => {
    const idx = network.push({ type: 'response', url: res.url(), status: res.status() }) - 1;
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('application/json')) {
        const body = await res.json();
        network[idx].body = body;
      } else {
        const txt = await res.text().catch(() => undefined);
        network[idx].body = typeof txt === 'string' && txt.length > 0 ? txt.slice(0, 2000) : undefined;
      }
    } catch (e) {
      network[idx].body = `<<unable to read body: ${e.message}>>`;
    }
  });

  page.on('console', msg => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    consoleMsgs.push({ type: 'pageerror', text: err.stack || String(err) });
  });

  try {
    console.log(`Opening ${base + loginPath}`);
    await page.goto(base + loginPath, { waitUntil: 'load', timeout: 20000 });

    // try common selectors for login form with fallbacks
    const emailSelector = 'input[name="email"]';
    const passSelector = 'input[name="password"]';
    const idEmailSelector = '#email';
    const idPassSelector = '#password';
    const submitSelector = 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")';

    // Wait for the email input using multiple possible selectors
    try {
      await page.waitForSelector(emailSelector, { timeout: 10000 });
    } catch (e) {
      try {
        await page.waitForSelector(idEmailSelector, { timeout: 5000 });
      } catch (e2) {
        // give one more attempt for generic input[type=email]
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      }
    }

    // Fill inputs with fallbacks
    try { await page.fill(emailSelector, email); } catch (_) {
      try { await page.fill(idEmailSelector, email); } catch (_) {
        await page.fill('input[type="email"]', email);
      }
    }
    try { await page.fill(passSelector, password); } catch (_) {
      try { await page.fill(idPassSelector, password); } catch (_) {
        await page.fill('input[type="password"]', password);
      }
    }

    // intercept XHR/fetch and wait for /auth/login response
    const loginPromise = page.waitForResponse(resp => resp.url().includes('/api/auth/login') || resp.url().includes('/api/auth/login'), { timeout: 10000 }).catch(e => null);

    // click submit
    await page.click(submitSelector).catch(async () => {
      // fallback: submit form
      await page.$eval('form', f => f.submit());
    });

    const loginResp = await loginPromise;
    if (loginResp) {
      const status = loginResp.status();
      let body = null;
      try { body = await loginResp.json(); } catch (e) { body = await loginResp.text().catch(()=>undefined); }
      console.log('Login response status:', status);
      console.log('Login response body:', JSON.stringify(body));
    } else {
      console.log('No login response captured for /api/auth/login');
    }

    // wait briefly for any console logs
    await page.waitForTimeout(2000);

    // If NAV_PATH is provided, navigate there after successful login to exercise further flows (CoursePlayer, etc.)
    if (navPath) {
      try {
        console.log(`Navigating to post-login path: ${navPath}`);
        await page.goto(base + navPath, { waitUntil: 'load', timeout: 20000 });
        // give the page a moment to initialize and emit logs
        await page.waitForTimeout(3000);
        console.log(`Post-login navigation to ${navPath} completed`);
      } catch (navErr) {
        console.error('Navigation after login failed:', navErr && navErr.stack ? navErr.stack : navErr);
      }
    }

    const out = { network, console: consoleMsgs };
    fs.writeFileSync('/tmp/auto_login_output.json', JSON.stringify(out, null, 2));
    console.log('Saved capture to /tmp/auto_login_output.json');

  } catch (err) {
    console.error('Auto-login script error:', err && err.stack ? err.stack : err);
  } finally {
    await browser.close();
  }
})();
