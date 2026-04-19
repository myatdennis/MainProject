import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('protectedTables guard', () => {
  let originalWindow: any;
  beforeEach(() => {
    originalWindow = (global as any).window;
  });
  afterEach(() => {
    (global as any).window = originalWindow;
  });

  it('throws in browser context for protected table', async () => {
    (global as any).window = {}; // simulate browser
    const mod = await import('../protectedTables');
    expect(() => mod.assertNotProtectedTable('assignments')).toThrow('Blocked client-side mutation of protected table');
  });

  it('does not throw for non-protected tables', async () => {
    (global as any).window = {};
    const mod = await import('../protectedTables');
    expect(() => mod.assertNotProtectedTable('courses')).not.toThrow();
  });

  it('exports PROTECTED_TABLES and isProtectedTable helpers', async () => {
    const mod = await import('../protectedTables');
    // alias and helper should exist and behave predictably
    expect(Boolean(mod.PROTECTED_TABLES && mod.PROTECTED_TABLES.has('assignments'))).toBe(true);
    expect(typeof mod.isProtectedTable === 'function').toBe(true);
    expect(mod.isProtectedTable('assignments')).toBe(true);
    expect(mod.isProtectedTable('courses')).toBe(false);
  });
});
