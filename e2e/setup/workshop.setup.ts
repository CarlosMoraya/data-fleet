import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/workshop.json';

setup('authenticate as Workshop', async ({ page }) => {
  const email = process.env.TEST_WORKSHOP_EMAIL;
  const password = process.env.TEST_WORKSHOP_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_WORKSHOP_EMAIL or TEST_WORKSHOP_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/manutencao', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
