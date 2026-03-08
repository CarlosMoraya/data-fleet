import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/pedro.json';

setup('authenticate as Fleet Assistant (Pedro)', async ({ page }) => {
  const email = process.env.TEST_ASSISTANT_EMAIL;
  const password = process.env.TEST_ASSISTANT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_ASSISTANT_EMAIL or TEST_ASSISTANT_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
