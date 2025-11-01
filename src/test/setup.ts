import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY ?? 'test-anon-key');
  vi.stubEnv('VITE_API_BASE_URL', process.env.VITE_API_BASE_URL ?? 'http://localhost:8787');
});
