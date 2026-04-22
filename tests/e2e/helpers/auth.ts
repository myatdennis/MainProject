import { expect, Page } from '@playwright/test';
import { getFrontendBaseUrl, getApiBaseUrl, waitForOk } from './env';

interface LoginOptions {
  email?: string;
  password?: string;
  baseUrl?: string;
  apiBaseUrl?: string;
  activeOrgId?: string;
}

const boundPages = new WeakSet<Page>();
type RealtimeStatusCallback = (status: string) => void;
type RealtimeEventCallback = (...args: unknown[]) => void;
const envFlagEnabled = (value?: string) => String(value || '').trim().toLowerCase() === 'true';

const shouldUseSyntheticBypass = () =>
  envFlagEnabled(process.env.E2E_TEST_MODE) || envFlagEnabled(process.env.DEV_FALLBACK);

const waitForAdminLanding = async (page: Page) => {
  await page.waitForURL((url) => {
    const pathname = url.pathname || '/';
    return pathname === '/admin' || pathname === '/admin/dashboard';
  }, { timeout: 30_000 });

  const adminShellSignals = [
    page.getByRole('heading', { name: /track impact across/i }),
    page.getByText(/Admin Workspace/i),
  ];

  await Promise.any(
    adminShellSignals.map((locator) => locator.waitFor({ state: 'visible', timeout: 20_000 })),
  );
};

export const loginAsAdmin = async (
  page: Page,
  options: LoginOptions = {},
) => {
  const activeOrgId = options.activeOrgId ?? 'demo-sandbox-org';
  if (!boundPages.has(page)) {
    page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    boundPages.add(page);
  }

  // Prepare base URL early so cookies are added to the correct origin before navigation.
  const baseUrl = options.baseUrl ?? getFrontendBaseUrl();

  // In E2E test mode inject a lightweight fake supabase client before the
  // app scripts run so the app boots with an authenticated session. This
  // avoids relying on the full SecureAuth flow in CI/local runs.
  if (shouldUseSyntheticBypass()) {
    // Inject a lightweight fake Supabase client and a safe fetch monkey-patch that only
    // attaches E2E headers to same-origin requests. Also set the same-origin cookies
    // via document.cookie in the page so they're present for in-page fetches.
    await page.addInitScript((injected) => {
      try {
        document.cookie = `x-e2e-bypass=true; path=/`;
        if (injected.orgId) document.cookie = `x-org-id=${injected.orgId}; path=/`;
      } catch (e) {
        // ignore
      }
      const fake = {
        auth: {
          getSession: async () => ({ data: { session: { access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } } }),
          getUser: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }),
          onAuthStateChange: (cb: any) => {
            const subscription = { unsubscribe: () => {} };
            try { setTimeout(() => cb('INITIAL_SESSION', { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } }), 0); } catch (e) {}
            return { data: { subscription } };
          },
          signInWithPassword: async ({ email, password }: any) => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email } }, error: null }),
          refreshSession: async () => ({ data: { session: { access_token: 'e2e', user: { id: '00000000-0000-0000-0000-000000000001', email: 'mya@the-huddle.co' } } }, error: null }),
          signOut: async () => ({ error: null }),
        },
        channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}), unsubscribe: () => ({}), send: async () => ({}) }),
        removeChannel: () => {},
      };
      (window as any).__E2E_SUPABASE_CLIENT = fake;
      (window as any).__supabase = (window as any).supabase = fake;
      (window as any).__E2E_BYPASS = true;
      (window as any).__E2E_ACTIVE_ORG_ID = injected.orgId;

      const originalFetch = window.fetch.bind(window);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
        try {
          const urlString = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
          const requestUrl = new URL(urlString, window.location.href);
          if (requestUrl.origin === window.location.origin) {
            init = init ?? {};
            const headers = new Headers(init.headers || {});
            headers.set('x-e2e-bypass', 'true');
            if (injected.orgId) headers.set('x-org-id', String(injected.orgId));
            init.headers = headers;
          }
        } catch (e) {}
        return originalFetch(input, init as any);
      };
  }, { orgId: activeOrgId });
    // Also monkey-patch Playwright's page.request methods in Node (not in the browser)
    // so tests that use page.request.get/post will include the E2E headers by default
    // for same-origin API calls. We keep this local to the page instance to avoid
    // globally injecting headers at the browser level which triggers CORS preflights.
    try {
      const apiBase = getApiBaseUrl();
      const headerDefaults: Record<string, string> = {
        'x-e2e-bypass': 'true',
        'x-user-role': 'admin',
        'x-org-id': activeOrgId,
      };
      const patchMethod = (name: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reqAny: any = (page.request as any);
        const orig = reqAny[name]?.bind(reqAny);
        if (typeof orig !== 'function') return;
        reqAny[name] = async (url: any, options: any = {}) => {
          try {
            const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
            const sameOrigin = urlStr.startsWith('/') || urlStr.startsWith(apiBase) || urlStr.startsWith(getFrontendBaseUrl());
            if (sameOrigin) {
              options = options || {};
              options.headers = { ...(headerDefaults), ...(options.headers || {}) };
            }
          } catch (e) {
            // swallow
          }
          return orig(url, options);
        };
      };
      ['get', 'post', 'put', 'delete', 'patch', 'head'].forEach(patchMethod);
    } catch (e) {
      // Non-fatal: tests can still proceed; we just won't auto-inject headers
      // into page.request calls in that environment.
      // eslint-disable-next-line no-console
      console.warn('[E2E] failed to patch page.request methods for E2E headers', e);
    }
  }

  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const email = options.email ?? 'mya@the-huddle.co';
  const password = options.password ?? 'admin123';

  await waitForOk(page.request, `${apiBaseUrl}/api/health`);
  await waitForOk(page.request, `${baseUrl}/`);

  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded' });

  // E2E runtime env check: log the frontend and API base the test is using
  try {
    // eslint-disable-next-line no-console
    console.log('[ENV CHECK][E2E]', {
      baseUrl,
      apiBaseUrl,
      currentPage: page.url(),
    });
  } catch (e) {
    // ignore
  }

  // In E2E mode, skip the full SecureAuth flow and navigate directly to the
  // dashboard. Tests run with E2E_TEST_MODE or DEV_FALLBACK should use this
  // to avoid flaky external auth dependencies.
  if (shouldUseSyntheticBypass()) {
    await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  }

  if (/\/admin(?:\/dashboard)?(?:\?|$)/.test(page.url())) {
    // Already authenticated (e.g., warm storage). Ensure dashboard is ready and return.
    await waitForAdminLanding(page);
    return { baseUrl, apiBaseUrl };
  }

  const emailInput = page.locator('#email');
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    // In E2E mode, be tolerant of SecureAuth failing to render and fallback
    // to directly visiting the dashboard so tests can proceed. This keeps
    // the test harness moving while still only running in test/dev modes.
    if (shouldUseSyntheticBypass()) {
      console.warn('Email input did not appear; falling back to direct dashboard navigation for E2E.');
      await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      await waitForAdminLanding(page);
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
  await waitForAdminLanding(page);

  return { baseUrl, apiBaseUrl };
};
