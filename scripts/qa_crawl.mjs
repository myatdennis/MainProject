import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:5173';

// Routes to test. For param routes we use sample ids (1).
const routes = [
  // Admin
  '/admin/dashboard',
  '/admin/users',
  '/admin/organizations',
  '/admin/organizations/new',
  '/admin/organizations/1',
  '/admin/courses',
  '/admin/reports',
  '/admin/analytics',
  '/admin/certificates',
  '/admin/integrations',
  '/admin/surveys',
  '/admin/surveys/builder',
  '/admin/surveys/builder/1',
  '/admin/surveys/1/analytics',
  '/admin/surveys/1/preview',
  '/admin/course-builder/1',
  '/admin/courses/1/details',
  '/admin/documents',
  '/admin/settings',

  // LMS
  '/lms/dashboard',
  '/lms/courses',
  '/lms/module/1',
  '/lms/module/1/lesson/1',
  '/lms/downloads',
  '/lms/downloads/package',
  '/lms/meeting',
  '/lms/feedback',
  '/lms/contact',
];

async function run() {
  const outDir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const results = [];

  for (const route of routes) {
    const url = new URL(route, base).toString();
    const page = await context.newPage();

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
    page.on('requestfailed', req => {
      consoleMessages.push({ type: 'requestfailed', url: req.url(), status: req.failure()?.errorText });
    });

    let response = null;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (err) {
      // retry once after short delay
      await new Promise(r => setTimeout(r, 1000));
      try {
        response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      } catch (err2) {
        pageErrors.push(String(err2));
      }
    }

    // Allow some time for client-side navigation to settle
    await page.waitForTimeout(800);

    const screenshotPath = path.join(outDir, `screenshot-${route.replace(/[^a-z0-9-_]/gi, '_')}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (err) {
      // ignore screenshot errors
    }

    results.push({
      route,
      url,
      status: response ? response.status() : null,
      statusText: response ? response.statusText() : null,
      console: consoleMessages,
      pageErrors,
      screenshot: fs.existsSync(screenshotPath) ? screenshotPath : null,
    });

    await page.close();
    console.log(`Visited ${url} -> ${response ? response.status() : 'no-response'} (${consoleMessages.length} console msgs, ${pageErrors.length} errors)`);
  }

  await browser.close();

  const reportPath = path.join(outDir, 'qa_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2));
  console.log('QA report written to', reportPath);
}

run().catch(err => {
  console.error('Crawler failed:', err);
  process.exit(1);
});
