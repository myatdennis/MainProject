import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/apiErrorHandler.test.ts',
      'tests/server/mfa.spec.ts',
    ],
    environment: 'node',
    watch: false,
  },
});
