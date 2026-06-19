import { expect, test } from '@playwright/test';

test.describe('Dashboard: escopo do filtro de período', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('exibe o filtro de período apenas na aba Custos', async ({ page }) => {
    await page.getByRole('button', { name: /Visão Geral/ }).click();
    await expect(page.getByText('Período de análise')).not.toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.getByText('Custo do Mês Atual')).toBeVisible();

    await page.getByRole('button', { name: /Operação/ }).click();
    await expect(page.getByText('Período de análise')).not.toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });
});
