import type { BrowserContext, Page } from '@playwright/test';
import { ensureE2EBypass } from './auth';

export async function newPageWithBypass(context: BrowserContext, opts?: { role?: 'learner' | 'admin' | string; orgId?: string; }): Promise<Page> {
  const page = await context.newPage();
  // default to learner role unless specified
  await ensureE2EBypass(page, { role: opts?.role ?? 'learner', orgId: opts?.orgId ?? 'demo-sandbox-org' });
  return page;
}
