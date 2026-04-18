import { test, expect, type Page, type Request } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const VERIFIED_E2E_ORG_ID = 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';

type Surface = {
  name: string;
  route: string;
  apiPath: string;
  requireOrgId: boolean;
};

const SURFACES: Surface[] = [
  {
    name: 'courses',
    route: '/admin/courses',
    apiPath: '/api/admin/courses',
    requireOrgId: true,
  },
  {
    name: 'organizations',
    route: '/admin/organizations',
    apiPath: '/api/admin/organizations',
    requireOrgId: true,
  },
  {
    name: 'users',
    route: '/admin/users',
    apiPath: '/api/admin/users',
    requireOrgId: true,
  },
  {
    name: 'surveys',
    route: '/admin/surveys',
    apiPath: '/api/admin/surveys',
    requireOrgId: true,
  },
];

const waitForSurfaceRequest = async (page: Page, surface: Surface): Promise<Request> => {
  return page.waitForRequest((request) => request.url().includes(surface.apiPath), { timeout: 20_000 });
};

test.describe('Admin workspace hardening', () => {
  test.setTimeout(120_000);

  test('loads each admin surface via direct navigation with scoped requests', async ({ page }) => {
    const env = await loginAsAdmin(page, { activeOrgId: VERIFIED_E2E_ORG_ID });
    let crmResponseStatus: number | null = null;

    for (const surface of SURFACES) {
      const requestPromise = waitForSurfaceRequest(page, surface);
      const crmPromise =
        surface.name === 'organizations'
          ? page.waitForResponse((response) => response.url().includes('/api/admin/crm/summary'), { timeout: 20_000 })
          : null;
      const responsePromise = page.waitForResponse((response) => response.url().includes(surface.apiPath), {
        timeout: 20_000,
      });
      await page.goto(`${env.baseUrl}${surface.route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

      const request = await requestPromise;
      const response = await responsePromise;
      const requestUrl = new URL(request.url());
      if (surface.requireOrgId) {
        expect(requestUrl.searchParams.get('orgId')).toBeTruthy();
      }
      if (surface.name !== 'surveys') {
        expect(response.status(), `${surface.name} should succeed`).toBeGreaterThanOrEqual(200);
        expect(response.status(), `${surface.name} should succeed`).toBeLessThan(300);
      } else {
        const body = await response.text();
        expect(response.status(), `surveys should succeed, got body: ${body}`).toBeGreaterThanOrEqual(200);
        expect(response.status(), `surveys should succeed, got body: ${body}`).toBeLessThan(300);
      }
      if (crmPromise) {
        crmResponseStatus = (await crmPromise).status();
      }
    }

    expect(crmResponseStatus).not.toBeNull();
    expect(crmResponseStatus).toBeGreaterThanOrEqual(200);
    expect(crmResponseStatus).toBeLessThan(300);
  });

  test('supports deep links, refreshes, and rapid page switching without collapsing the workspace', async ({ page }) => {
    const env = await loginAsAdmin(page, { activeOrgId: VERIFIED_E2E_ORG_ID });

    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/organizations`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/users`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/surveys`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${env.baseUrl}/admin/users`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${env.baseUrl}/admin/organizations`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  });

  test('isolates a failing surveys request so other admin surfaces still load', async ({ page }) => {
    const env = await loginAsAdmin(page, { activeOrgId: VERIFIED_E2E_ORG_ID });

    await page.route('**/api/admin/surveys**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'schema_mismatch', message: 'survey_assignments.organization_id does not exist' }),
      });
    });

    await page.goto(`${env.baseUrl}/admin/surveys`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Refresh surveys/i)).toBeVisible({ timeout: 20_000 });

    await page.unroute('**/api/admin/surveys**');

    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/organizations`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${env.baseUrl}/admin/users`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  });
});
