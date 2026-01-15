import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/lib/**/*.test.{js,ts}'],
    environment: 'node',
  },
});
