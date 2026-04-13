import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'server/lib/**/*.test.{js,ts}',
      'server/services/**/*.test.{js,ts}',
      'server/services/**/__tests__/**/*.{js,ts}',
      'server/validators/**/*.test.{js,ts}',
      'server/utils/**/*.test.{js,ts}',
      'server/utils/**/__tests__/**/*.{js,ts}',
    ],
    environment: 'node',
  },
});
