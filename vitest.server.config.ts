import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/lib/**/*.test.ts'],
    environment: 'node',
  },
});
