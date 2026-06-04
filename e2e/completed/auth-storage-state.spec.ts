import { test, expect, type Page } from '@playwright/test';

async function expectAuthenticatedRoute(
  page: Page,
  path: string,
  heading: string,
) {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
}

test.describe('Auth storageState regression', () => {
  test.describe('Fleet Analyst', () => {
    test.use({ storageState: 'e2e/.auth/mariana.json' });

    test('mariana stays authenticated on dashboard', async ({ page }) => {
      await expectAuthenticatedRoute(page, '/', 'Dashboard');
    });
  });

  test.describe('Fleet Assistant', () => {
    test.use({ storageState: 'e2e/.auth/pedro.json' });

    test('pedro stays authenticated on dashboard', async ({ page }) => {
      await expectAuthenticatedRoute(page, '/', 'Dashboard');
    });
  });

  test.describe('Manager', () => {
    test.use({ storageState: 'e2e/.auth/alexandre.json' });

    test('alexandre stays authenticated on dashboard', async ({ page }) => {
      await expectAuthenticatedRoute(page, '/', 'Dashboard');
    });
  });

  test.describe('Yard Auditor', () => {
    test.use({ storageState: 'e2e/.auth/carlos.json' });

    test('carlos stays authenticated on checklists', async ({ page }) => {
      await expectAuthenticatedRoute(page, '/checklists', 'Checklists');
    });
  });

  test.describe('Driver', () => {
    test.use({ storageState: 'e2e/.auth/jorge.json' });

    test('jorge stays authenticated on checklists', async ({ page }) => {
      await expectAuthenticatedRoute(page, '/checklists', 'Checklists');
    });
  });
});
