import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/perf-routes.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /admin-perf\.setup\.ts/,
    },
    {
      name: 'perf',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin-perf.json',
      },
      dependencies: ['setup'],
      testMatch: /perf-routes\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run preview -- --port=4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
