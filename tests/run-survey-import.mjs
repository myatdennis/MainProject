import playwright from 'playwright';

async function run() {
  const browser = await playwright.chromium.launch({
    headless: false,
    slowMo: 100,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG>', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR>', err));

  try {
    // Login first (demo credentials supported in AuthContext when Supabase not configured)
    // Try multiple local dev ports in case Vite chose a different one
    const ports = [5175, 5176, 5177, 5178, 5179, 5180];
    let baseUrl = null;
    for (const p of ports) {
      try {
        await page.goto(`http://localhost:${p}/admin/login`, { waitUntil: 'networkidle', timeout: 6000 });
        baseUrl = `http://localhost:${p}`;
        console.log('Connected to dev server at', baseUrl);
        break;
      } catch (e) {
        // continue
      }
    }
    if (!baseUrl) throw new Error('Could not connect to local dev server on ports ' + ports.join(', '));
    // Ensure fields exist
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', 'admin@thehuddleco.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for either navigation or admin dashboard element
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Admin Dashboard', { timeout: 15000 }).catch(() => null)
    ]);

  await page.goto(`${baseUrl}/admin/surveys/import`, { waitUntil: 'networkidle', timeout: 30000 });

    const sample = JSON.stringify({
      id: 'test-survey-1',
      title: 'Imported Survey',
      description: 'A survey imported via test',
      type: 'custom',
      status: 'draft'
    });

    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.fill('textarea', sample);
    await page.click('text=Parse JSON');

    // Wait for preview
    await page.waitForSelector('text=Imported Survey', { timeout: 10000 });

    await page.click('text=Save All');

    // Wait for success message
    await page.waitForSelector('text=Surveys imported successfully', { timeout: 10000 });

    console.log('TEST PASS: survey import flow succeeded');

    // Keep browser open for manual inspection when run locally
    console.log('Leaving browser open for inspection — close manually when done.');
  } catch (err) {
    console.error('TEST FAIL', err);
    console.error('Leaving browser open to inspect failure.');
  }
}

run();
