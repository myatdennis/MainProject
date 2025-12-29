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
  const baseUrl = options.baseUrl ?? getFrontendBaseUrl();
  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const email = options.email ?? 'admin@thehuddleco.com';
  const password = options.password ?? 'admin123';

  await waitForOk(page.request, `${apiBaseUrl}/api/health`);
  await waitForOk(page.request, `${baseUrl}/`);

  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded' });

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
    const bodyText = await page.textContent('body').catch(() => '');
    const htmlSnippet = await page.content().catch(() => '');
    throw new Error(
      `Timed out waiting for #email on ${page.url()} (SecureAuth state). Body snippet: ${bodyText?.slice(0, 280)} | HTML snippet: ${htmlSnippet?.slice(0, 280)}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }
  await emailInput.fill(email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /access admin portal/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 30_000 });
  const dashboardHeading = page.getByRole('heading', { name: /track impact across/i });
  await expect(dashboardHeading).toBeVisible({ timeout: 20_000 });

  return { baseUrl, apiBaseUrl };
};
