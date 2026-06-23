import { expect, test, type Locator, type Page } from '@playwright/test';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

test.describe('Regressão pós-otimização — logout limpa dados sensíveis', () => {
  test('limpa cache React Query e estado de UI ao sair pela interface', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder*="Buscar"]').first().fill('ABC');
    await page.goto('/');
    await expect(mainHeading(page, 'Dashboard')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });

    const fromInput = page.locator('input[type="date"]').first();
    await fromInput.fill('2024-01-01');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('betafleet-rq-cache')), { timeout: 15000 })
      .not.toBeNull();

    const uiKeysBeforeLogout = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('bf:v1:ui:')) keys.push(key);
      }
      return keys;
    });
    expect(uiKeysBeforeLogout.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Logout|Sair/i }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });

    const storageState = await page.evaluate(() => {
      const uiKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('bf:v1:ui:')) uiKeys.push(key);
      }

      const rawCache = localStorage.getItem('betafleet-rq-cache');
      let rqCacheHasData = rawCache != null;
      if (rawCache) {
        try {
          const parsed = JSON.parse(rawCache);
          const queries = parsed?.clientState?.queries ?? parsed?.queries ?? [];
          rqCacheHasData = Array.isArray(queries) && queries.length > 0;
        } catch {
          rqCacheHasData = false;
        }
      }

      return {
        rqCacheHasData,
        uiKeys,
        dashboardDateFilter: localStorage.getItem('dashboard_date_filter'),
        workshopActiveClient: localStorage.getItem('workshop_active_client'),
        adminMasterActiveClient: localStorage.getItem('adminMasterActiveClient'),
      };
    });

    expect(storageState.rqCacheHasData).toBe(false);
    expect(storageState.uiKeys).toEqual([]);
    expect(storageState.dashboardDateFilter).toBeNull();
    expect(storageState.workshopActiveClient).toBeNull();
    expect(storageState.adminMasterActiveClient).toBeNull();
  });
});
