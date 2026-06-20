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
    await expect(page.getByText('Custo do Mês Atual', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Operação/ }).click();
    await expect(page.getByText('Período de análise')).not.toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await page.getByRole('button', { name: /Conformidade/ }).click();
    await expect(page.getByText('Período de análise')).not.toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
    await expect(page.getByText('Custo no Período', { exact: true })).toBeVisible();
    await expect(page.getByText('Custo por KM', { exact: true })).toBeVisible();
    await expect(page.getByText('Custo do Mês Atual', { exact: true })).toBeVisible();
    await expect(page.getByText('Projeção Próximo Mês', { exact: true })).toBeVisible();
    await expect(page.getByText('Ticket Médio por OS', { exact: true })).toBeVisible();
    await expect(page.getByText('Custos com Reboque', { exact: true })).toBeVisible();
  });
});
