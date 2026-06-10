import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local' });

const includePending = process.env.PLAYWRIGHT_INCLUDE_PENDING === '1';
const pendingIgnore = includePending ? [] : [/pending\//];

export default defineConfig({
  testDir: './e2e',
  testMatch: includePending
    ? ['**/completed/**/*.spec.ts', '**/pending/**/*.spec.ts', '**/smoke/**/*.spec.ts', '**/setup/**/*.setup.ts']
    : ['**/completed/**/*.spec.ts', '**/smoke/**/*.spec.ts', '**/setup/**/*.setup.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000, // 60s per test
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /admin\.setup\.ts/,
    },
    {
      name: 'setup-mariana',
      testMatch: /mariana\.setup\.ts/,
    },
    {
      name: 'setup-pedro',
      testMatch: /pedro\.setup\.ts/,
    },
    {
      name: 'setup-alexandre',
      testMatch: /alexandre\.setup\.ts/,
    },
    {
      name: 'setup-carlos',
      testMatch: /carlos\.setup\.ts/,
    },
    {
      name: 'setup-jorge',
      testMatch: /jorge\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: [/tenant-users/, ...pendingIgnore],
    },
    {
      name: 'analyst',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/mariana.json',
      },
      dependencies: ['setup-mariana'],
      testMatch: [/tenant-users(-analyst.*)?\.spec\.ts/, /audit-admin-tenant\.spec\.ts/],
      testIgnore: pendingIgnore,
    },
    {
      name: 'assistant',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/pedro.json',
      },
      dependencies: ['setup-pedro'],
      testMatch: [/tenant-users-assistant.*\.spec\.ts/, /audit-admin-tenant\.spec\.ts/],
      testIgnore: [/seed/, ...pendingIgnore],
    },
    {
      name: 'assistant-actions',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/pedro.json',
      },
      dependencies: ['setup-pedro'],
      testMatch: /tenant-users-assistant-actions\.spec\.ts/,
      testIgnore: pendingIgnore,
    },
    {
      name: 'manager',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/alexandre.json',
      },
      dependencies: ['setup-alexandre'],
      testMatch: [/tenant-users-manager.*\.spec\.ts/, /audit-admin-tenant\.spec\.ts/],
      testIgnore: [/seed/, ...pendingIgnore],
    },
    {
      name: 'auditor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/carlos.json',
      },
      dependencies: ['setup-carlos'],
      testMatch: /auditor-flow\.spec\.ts/,
      testIgnore: pendingIgnore,
    },
    {
      name: 'driver',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/jorge.json',
      },
      dependencies: ['setup-jorge'],
      testMatch: [/driver-flow\.spec\.ts/, /driver-schedules-cache\.spec\.ts/],
      testIgnore: pendingIgnore,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
