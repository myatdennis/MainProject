import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 45000,
    hookTimeout: 45000,
    maxConcurrency: 1,
    pool: 'forks',
    watch: false,
    sequence: {
      concurrent: false,
    },
  },
});
