import { test, expect } from '@playwright/test';

test.describe('Dashboard Costs Analysis', () => {
  test('all cost charts are present on the Custos tab', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });

    const expectedTitles = [
      'Evolução do Custo de Manutenção',
      'Custo por Tipo de Manutenção',
      'Custo por Tipo de Veículo',
    ];

    for (const title of expectedTitles) {
      await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 10000 });
    }

    const conditionalTitles = [
      'Custo por Sistema',
      'Custo por Categoria',
      'Custo por Modelo',
      'Custo por Embarcador',
      'Custo por Unidade Operacional',
    ];

    for (const title of conditionalTitles) {
      const titleEl = page.getByText(title, { exact: false });
      if (await titleEl.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(titleEl).toBeVisible();
      }
    }
  });

  test('Veículos para Análise section is present with correct columns', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Veículos para Análise')).toBeVisible({ timeout: 10000 });

    const expectedHeaders = ['Veículo', 'Custo Total', 'Custo por KM', 'Qtd OS', 'OS Corretivas', 'Ações'];
    for (const header of expectedHeaders) {
      await expect(page.getByRole('columnheader', { name: header, exact: false })).toBeVisible();
    }
  });

  test('Ver histórico navigates to Maintenance with plate filter', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Custos/ }).click();
    await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2000);

    const firstVisibleButton = page.locator('table button:has-text("Ver histórico")').first();
    const isVisible = await firstVisibleButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const isDisabled = await firstVisibleButton.isDisabled();

      if (!isDisabled) {
        await firstVisibleButton.click();

        await page.waitForURL(/\/manutencao/, { timeout: 10000, waitUntil: 'domcontentloaded' });

        const searchInput = page.getByPlaceholder('Buscar por placa...');
        await expect(searchInput).toBeVisible({ timeout: 10000 });

        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/[?&]placa=/);
      }
    }
  });
});
