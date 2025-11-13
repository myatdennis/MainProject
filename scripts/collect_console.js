const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      errors.push({ type, text });
      console.log(`[console:${type}] ${text}`);
    } else {
      console.log(`[console:${type}] ${text}`);
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err && err.stack ? err.stack : String(err) });
    console.log('[pageerror] ' + (err && err.stack ? err.stack : String(err)));
  });

  page.on('crash', () => {
    console.log('[page] crashed');
  });

  try {
    console.log('Navigating to http://localhost:5174/ ...');
    const resp = await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' , timeout: 15000});
    console.log('Response status:', resp && resp.status());
  } catch (err) {
    console.error('Navigation failed:', err && err.stack ? err.stack : err);
  }

  // wait a bit to capture runtime logs
  await page.waitForTimeout(5000);

  if (errors.length === 0) console.log('No console errors/warnings captured.');
  else {
    console.log('Captured errors/warnings:');
    errors.forEach((e, i) => console.log(`${i+1}. [${e.type}] ${e.text}`));
  }

  await browser.close();
  // exit with non-zero if errors found to make detection easier
  process.exit(errors.length > 0 ? 1 : 0);
})();
