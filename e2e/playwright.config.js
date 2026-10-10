import { defineConfig } from '@playwright/test';

// End-to-end journeys run against a seeded test stack started by start-servers.mjs. They use the installed
// Chrome (channel "chrome"), so no browser download is needed.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5273',
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node start-servers.mjs',
    url: 'http://localhost:5273/login',
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
