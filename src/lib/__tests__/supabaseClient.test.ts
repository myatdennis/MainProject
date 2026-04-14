import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('supabaseClient configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    delete (window as any).__E2E_SUPABASE_CLIENT;
  });

  afterEach(() => {
    delete (window as any).__E2E_SUPABASE_CLIENT;
  });

  it('recognizes an E2E override as a configured Supabase client', async () => {
    const fakeClient = {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    };
    (window as any).__E2E_SUPABASE_CLIENT = fakeClient;

    const { hasSupabaseConfig, getSupabase } = await import('../supabaseClient');

    expect(hasSupabaseConfig()).toBe(true);
    expect(getSupabase()).toBe(fakeClient);
  });

  it('returns false when no env config or override is present', async () => {
    const { hasSupabaseConfig, getSupabase } = await import('../supabaseClient');

    expect(hasSupabaseConfig()).toBe(false);
    expect(getSupabase()).toBeNull();
  });
});
