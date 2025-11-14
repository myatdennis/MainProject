import { chromium } from 'playwright';

(async () => {
  const url = process.env.BASE_URL || 'http://localhost:5174/admin/dashboard';
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const requestFailures = [];
  const responses = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    consoleMessages.push({ type: 'pageerror', text: String(err) });
  });

  page.on('requestfailed', req => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || null });
  });

  page.on('response', async resp => {
    try {
      const url = resp.url();
      if (url.includes('/src/pages/Admin/AdminDashboard')) {
        responses.push({ url, status: resp.status(), type: resp.headers()['content-type'] || null });
      }
    } catch (e) {
      // ignore
    }
  });

  try {
  // Use 'load' instead of 'networkidle' to avoid long-lived background
  // requests preventing completion; allow a longer timeout for first load.
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // wait a bit for lazy-loaded chunks to fetch
    await page.waitForTimeout(1500);

    const result = { url, consoleMessages, requestFailures, responses };
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err);
    await browser.close();
    process.exit(2);
  }
})();
