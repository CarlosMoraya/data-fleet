import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/mariana.json';

setup('authenticate as Fleet Analyst (Mariana)', async ({ page }) => {
  const email = process.env.TEST_ANALYST_EMAIL;
  const password = process.env.TEST_ANALYST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_ANALYST_EMAIL or TEST_ANALYST_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
