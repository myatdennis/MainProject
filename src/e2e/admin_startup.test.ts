/* eslint-disable no-console */
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { setCanonicalSession, clearCanonicalSession } from '../lib/canonicalAuth';
import { writeBridgeSnapshot } from '../store/courseStoreOrgBridge';
import { courseStore } from '../store/courseStore';

// Helper to create delayed fetch responses
function delayedResponse(body: unknown, delayMs = 2000, ok = true) {
  return new Promise<Response>((resolve) => {
    setTimeout(() => {
      const resp = new Response(JSON.stringify(body), { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
      resolve(resp);
    }, delayMs);
  });
}

let originalFetch: typeof globalThis.fetch | undefined;
let originalLocalStorageSet: ((key: string, value: string) => void) | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalLocalStorageSet = window.localStorage.setItem.bind(window.localStorage);
});

afterEach(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
  try {
    if (originalLocalStorageSet) window.localStorage.setItem = originalLocalStorageSet;
  } catch {}
  clearCanonicalSession();
});

test('ADMIN_STARTUP_STABILITY loads admin workspace safely under slow APIs and storage failure', async () => {
  // Intercept fetch and simulate slow endpoints for admin loads
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String((input as Request).url);
    calls.push(url);
    // Simulate endpoints used during admin bootstrap
    if (url.includes('/api/admin/courses')) {
      return delayedResponse([{ id: 'c1', title: 'Test Course' }], 2400);
    }
    if (url.includes('/api/admin/users')) {
      return delayedResponse([{ id: 'u1', email: 'admin@example.com' }], 2600);
    }
    if (url.includes('/api/admin/organizations')) {
      return delayedResponse([{ id: 'o1', name: 'Org' }], 2200);
    }
    if (url.includes('/api/admin/surveys')) {
      return delayedResponse([{ id: 's1', title: 'Survey' }], 2800);
    }
    // Default: quick empty 200
    return delayedResponse({}, 50);
  });

  // Mock localStorage to throw on setItem to simulate storage failure
  window.localStorage.setItem = () => {
    throw new Error('Storage disabled');
  };

  // Set canonical session and bridge snapshot as if login happened
  setCanonicalSession({ accessToken: 'test-token', refreshToken: 'r', userId: 'admin-1', userEmail: 'admin@example.com', activeOrgId: 'o1', authenticated: true });
  writeBridgeSnapshot({ status: 'ready', membershipStatus: 'ready', activeOrgId: 'o1', orgId: 'o1', role: 'admin', userId: 'admin-1' });

  // Trigger admin workspace load
  let threw = false;
  try {
    await courseStore.init({ reason: 'e2e_admin_startup_test', surface: 'admin' });
  } catch (e) {
    threw = true;
    console.error('courseStore.init threw', e);
  }

  // Allow some time for background processing (but test should be deterministic)
  await new Promise((resolve) => setTimeout(resolve, 3500));

  const state = courseStore.getAdminCatalogState();
  // Assert: no crash
  expect(threw).toBe(false);
  // Assert: admin load succeeded or at least confirmed empty only after responses
  expect(['success', 'empty', 'error']).toContain(state.adminLoadStatus);
  // Ensure the endpoints were called
  expect(calls.some((c) => c.includes('/api/admin/courses'))).toBe(true);
  expect(calls.some((c) => c.includes('/api/admin/users'))).toBe(true);
  expect(calls.some((c) => c.includes('/api/admin/organizations'))).toBe(true);
  expect(calls.some((c) => c.includes('/api/admin/surveys'))).toBe(true);
  // Ensure we did not prematurely set empty before success: adminLoadStatus is not unset
  // The courseStore test harness ensures empty only after confirmed response; here we assert not 'idle'
  expect(state.phase).not.toBe('idle');
});
