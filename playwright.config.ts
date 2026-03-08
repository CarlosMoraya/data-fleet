import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /tenant-users/,
    },
    {
      name: 'analyst',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/mariana.json',
      },
      dependencies: ['setup-mariana'],
      testMatch: /tenant-users\.spec/,
    },
    {
      name: 'assistant',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/pedro.json',
      },
      dependencies: ['setup-pedro'],
      testMatch: /tenant-users-assistant/,
    },
    {
      name: 'manager',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/alexandre.json',
      },
      dependencies: ['setup-alexandre'],
      testMatch: /tenant-users-manager/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
