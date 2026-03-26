import { expect, Page } from '@playwright/test';
import { getFrontendBaseUrl, getApiBaseUrl, waitForOk } from './env';

interface LoginOptions {
  email?: string;
  password?: string;
  baseUrl?: string;
  apiBaseUrl?: string;
}

const boundPages = new WeakSet<Page>();

export const loginAsAdmin = async (
  page: Page,
  options: LoginOptions = {},
) => {
  if (!boundPages.has(page)) {
    page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    boundPages.add(page);
  }
  // In E2E test mode inject a lightweight fake supabase client before the
  // app scripts run so the app boots with an authenticated session. This
  // avoids relying on the full SecureAuth flow in CI/local runs.
  if (process.env.E2E_TEST_MODE || process.env.DEV_FALLBACK) {
    await page.addInitScript(() => {
      // Minimal fake supabase client with auth methods used by the app
      // NOTE: keep this minimal and only for test environments.
      const fake = {
        auth: {
          getSession: async () => ({ data: { session: { access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } } }),
          getUser: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }),
          onAuthStateChange: (cb: any) => {
            // Return the same shape as the real client: { data: { subscription } }
            const subscription = {
              unsubscribe: () => {},
            };
            try {
              // Notify asynchronously to mimic real behavior
              setTimeout(() => cb('INITIAL_SESSION', { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } }), 0);
            } catch (e) {}
            return { data: { subscription } };
          },
          signInWithPassword: async ({ email, password }: any) => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email } }, error: null }),
          refreshSession: async () => ({ data: { session: { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }, error: null }),
          signOut: async () => ({ error: null }),
        },
        // Minimal realtime stub used by SyncService.subscribe which calls
        // supabase.channel(...).on(...).subscribe()
        channel: (name: string) => {
          // Create a chainable channel object similar to Supabase client's channel
          const handlers: Array<{ type?: string; filter?: any; callback?: Function }> = [];
          const ch: any = {
            on: (typeOrCallback: any, filterOrCallback?: any, callback?: any) => {
              // Support both (event, filter, cb) and (event, cb) signatures
              if (typeof filterOrCallback === 'function' && callback === undefined) {
                handlers.push({ type: typeOrCallback, callback: filterOrCallback });
              } else {
                handlers.push({ type: typeOrCallback, filter: filterOrCallback, callback });
              }
              return ch;
            },
            subscribe: (statusCb?: Function) => {
              // Invoke provided status callback with SUBSCRIBED to mimic behavior
              if (typeof statusCb === 'function') {
                try { statusCb('SUBSCRIBED'); } catch (e) {}
              }
              return ch;
            },
            unsubscribe: () => ({ data: {} }),
            send: async () => ({ data: {} }),
          };
          return ch;
        },
        // Supabase client helpers used by realtime code
        removeChannel: (channelObj: any) => {
          try {
            channelObj?.unsubscribe?.();
          } catch (e) {}
        },
      };
  (window as any).__E2E_SUPABASE_CLIENT = fake;
  // Also set window.__supabase for any debug code that expects it.
  (window as any).__supabase = (window as any).supabase = fake;
  // Explicit bypass flag so client code can detect E2E mode even when
  // import.meta.env flags are not present in the built bundle.
  (window as any).__E2E_BYPASS = true;
    });
  }
  const baseUrl = options.baseUrl ?? getFrontendBaseUrl();
  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const email = options.email ?? 'mya@the-huddle.co';
  const password = options.password ?? 'admin123';

  await waitForOk(page.request, `${apiBaseUrl}/api/health`);
  await waitForOk(page.request, `${baseUrl}/`);

  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded' });

  // In E2E mode, skip the full SecureAuth flow and navigate directly to the
  // dashboard. Tests run with E2E_TEST_MODE or DEV_FALLBACK should use this
  // to avoid flaky external auth dependencies.
  if (process.env.E2E_TEST_MODE || process.env.DEV_FALLBACK) {
    await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  }

  if (page.url().includes('/admin/dashboard')) {
    // Already authenticated (e.g., warm storage). Ensure dashboard is ready and return.
    const dashboardHeading = page.getByRole('heading', { name: /track impact across/i });
    await expect(dashboardHeading).toBeVisible({ timeout: 20_000 });
    return { baseUrl, apiBaseUrl };
  }

  const emailInput = page.locator('#email');
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    // In E2E mode, be tolerant of SecureAuth failing to render and fallback
    // to directly visiting the dashboard so tests can proceed. This keeps
    // the test harness moving while still only running in test/dev modes.
    if (process.env.E2E_TEST_MODE || process.env.DEV_FALLBACK) {
      console.warn('Email input did not appear; falling back to direct dashboard navigation for E2E.');
      await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      const dashboardHeading = page.getByRole('heading', { name: /track impact across/i });
      await expect(dashboardHeading).toBeVisible({ timeout: 20_000 });
      return { baseUrl, apiBaseUrl };
    }
    const bodyText = await page.textContent('body').catch(() => '');
    const htmlSnippet = await page.content().catch(() => '');
    const baseMessage = `Timed out waiting for #email on ${page.url()} (SecureAuth state). Body snippet: ${bodyText?.slice(0, 280)} | HTML snippet: ${htmlSnippet?.slice(0, 280)}`;
    const wrappedError = new Error(baseMessage);
    if (error instanceof Error) {
      (wrappedError as Error & { cause?: Error }).cause = error;
    }
    throw wrappedError;
  }
  await emailInput.fill(email);
  await page.fill('#password', password);
  // Submit the login form by pressing Enter on the password field. This
  // is more robust in E2E when the button might be animated/covered or
  // temporarily non-actionable for Playwright's click heuristics.
  await page.press('#password', 'Enter');
  await page.waitForURL('**/admin/dashboard', { timeout: 30_000 });
  const dashboardHeading = page.getByRole('heading', { name: /track impact across/i });
  await expect(dashboardHeading).toBeVisible({ timeout: 20_000 });

  return { baseUrl, apiBaseUrl };
};
