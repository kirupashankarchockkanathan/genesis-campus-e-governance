import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/helpers/setupEnv.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: 'forks',
    coverage: { provider: 'v8', include: ['src/**/*.js'] },
  },
});
