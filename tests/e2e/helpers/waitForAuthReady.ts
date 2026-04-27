export async function waitForAuthReady(page: any, timeout = 30000) {
  const start = Date.now();
  const locator = page.locator('main, [role="main"], [data-test="dashboard-root"]').first();
  while (Date.now() - start < timeout) {
    try {
      // 1) Prefer explicit AUTH_READY flag when available.
      const ready = await page.evaluate(() => (window as any).AUTH_READY === true).catch(() => false);
      if (ready) return true;

      // 2) If the app has rendered a main/dashboard anchor and it's visible, treat that as ready.
      try {
        const count = await locator.count();
        if (count > 0) {
          const visible = await locator.isVisible().catch(() => false);
          if (visible) return true;
        }
      } catch (e) {
        // swallow and continue polling
      }

      // 3) As a fallback, consider being on a known logged-in path as readiness.
      try {
        const current = page.url();
        const pathname = new URL(current).pathname || '';
        if (/^\/(lms\/dashboard|admin(\/|$)|client(\/|$)|dashboard(\/|$))/.test(pathname)) {
          return true;
        }
      } catch (e) {
        // ignore and continue
      }
    } catch (e) {
      // loop
    }
    // small backoff to avoid tight loop
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('waitForAuthReady: timeout');
}

export default waitForAuthReady;
