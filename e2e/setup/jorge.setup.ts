import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/jorge.json';

setup('authenticate as Driver (Jorge)', async ({ page }) => {
  const email = process.env.TEST_DRIVER_EMAIL;
  const password = process.env.TEST_DRIVER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_DRIVER_EMAIL or TEST_DRIVER_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/checklists', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
