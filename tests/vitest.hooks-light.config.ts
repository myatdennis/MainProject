import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/hooks/__tests__/useSignedMediaUrl.test.tsx'],
    environment: 'jsdom',
    watch: false,
    pool: 'forks',
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
    },
  },
});
