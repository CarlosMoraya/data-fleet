import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/carlos.json';

setup('authenticate as Auditor (Carlos)', async ({ page }) => {
  const email = process.env.TEST_AUDITOR_EMAIL;
  const password = process.env.TEST_AUDITOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_AUDITOR_EMAIL or TEST_AUDITOR_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/checklists', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
