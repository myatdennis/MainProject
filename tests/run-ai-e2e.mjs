import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);
  try {
    // Navigate to root so we can set localStorage then go to admin route
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => {
      try { localStorage.setItem('huddle_admin_auth', 'true'); } catch (e) {}
    });

  await page.goto('http://localhost:5173/admin/ai-course-creator', { waitUntil: 'load', timeout: 60000 });

  // Capture console messages and page errors
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  // Wait briefly for client to render and then dump the DOM for debugging
  // Give the client more time to hydrate
  await page.waitForTimeout(3000);
  const content = await page.content();
  console.log('PAGE DOM SNAPSHOT (first 4000 chars):\n', content.slice(0, 4000));
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('PAGE BODY TEXT:\n', bodyText.slice(0, 2000));

  // Wait for Generate button and click (longer timeout)
  await page.waitForSelector('text=Generate Course', { timeout: 30000 });
    await page.click('text=Generate Course');

    // Wait for the Generated Course Preview to appear
    await page.waitForSelector('text=Generated Course Preview', { timeout: 20000 });

    // Click Save Draft
    await page.waitForSelector('text=Save Draft', { timeout: 10000 });
    await page.click('text=Save Draft');

    // Wait for navigation to course builder (or at least URL change)
    await page.waitForTimeout(1500);
    const url = page.url();
    console.log('E2E finished, current url:', url);
  } catch (err) {
    console.error('E2E script failed:', err);
    try {
      console.log('\n--- /tmp/vite-dev.log tail ---\n');
      const { execSync } = await import('child_process');
      const tail = execSync('tail -n 200 /tmp/vite-dev.log || true').toString();
      console.log(tail);
      console.log('\n--- /tmp/server.log tail ---\n');
      const t2 = execSync('tail -n 200 /tmp/server.log || true').toString();
      console.log(t2);
    } catch (ex) {
      console.warn('Failed to dump logs', ex);
    }
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
