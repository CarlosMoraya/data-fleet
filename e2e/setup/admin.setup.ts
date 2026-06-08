import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/admin.json';

setup('authenticate as Admin Master', async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD in .env.local'
    );
  }

  await page.goto('/login');
  // Wait for the React app to fully render the login form before interacting.
  // Without this, a cold Vite dev server may not have compiled the JS bundle yet,
  // causing fill/click to time out because the inputs don't exist in the DOM.
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Aguarda redirecionar para o dashboard após login
  await expect(page).toHaveURL('/', { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
