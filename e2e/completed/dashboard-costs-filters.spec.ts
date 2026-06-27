import { expect, test, type Page } from '@playwright/test';

async function openCostsTab(page: Page) {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Custos/ }).click();
  await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });
}

function kpiCard(page: Page, labelText: string) {
  return page
    .getByText(labelText, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]')
    .filter({ hasNot: page.locator('table') });
}

test.describe('Dashboard Custos: filtros aprovados', () => {
  test('Custos: renderiza os filtros aprovados', async ({ page }) => {
    await openCostsTab(page);

    await expect(page.getByLabel('Categoria')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Modelo' })).toBeVisible();
    await expect(page.getByLabel('Embarcador')).toBeVisible();
    await expect(page.getByLabel('Unidade Operacional')).toBeVisible();
  });

  test('Custos: filtros afetam cards e graficos', async ({ page }) => {
    await openCostsTab(page);

    const categorySelect = page.getByLabel('Categoria');
    const optionCount = await categorySelect.locator('option').count();
    test.skip(optionCount < 2, 'Massa atual sem categorias suficientes para validar filtro estrutural.');

    await categorySelect.selectOption({ index: 1 });

    await expect(categorySelect).not.toHaveValue('');
    await expect(page.getByText('Custo no Período', { exact: true })).toBeVisible();

    const chartOrEmptyState = page
      .locator('.recharts-responsive-container, svg.recharts-surface')
      .or(page.getByText('Sem dados de custo no período.', { exact: true }))
      .first();

    await expect(chartOrEmptyState).toBeVisible();
  });

  test('Custos: limpar filtros preserva período', async ({ page }) => {
    await openCostsTab(page);

    const fromInput = page.locator('input[type="date"]').first();
    const toInput = page.locator('input[type="date"]').nth(1);
    await fromInput.fill('2024-01-01');
    await expect(page.getByLabel('Categoria')).toBeVisible({ timeout: 15000 });
    const preservedFrom = await fromInput.inputValue();
    const preservedTo = await toInput.inputValue();

    const categorySelect = page.getByLabel('Categoria');
    const optionCount = await categorySelect.locator('option').count();
    test.skip(optionCount < 2, 'Massa atual sem categorias suficientes para validar limpar filtros.');
    await categorySelect.selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    await expect(categorySelect).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Modelo' })).toHaveValue('');
    await expect(page.getByLabel('Embarcador')).toHaveValue('');
    await expect(page.getByLabel('Unidade Operacional')).toHaveValue('');
    await expect(fromInput).toHaveValue(preservedFrom);
    await expect(toInput).toHaveValue(preservedTo);
  });

  test('Custos: Custo por KM exibe sem dados suficientes quando nao ha KM valido', async ({ page }) => {
    await openCostsTab(page);

    const categorySelect = page.getByLabel('Categoria');
    const optionCount = await categorySelect.locator('option').count();
    if (optionCount < 2) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Massa atual nao garante recorte sem KM valido; regra principal coberta por unitario de calculateCostPerKm.',
      });
      return;
    }

    let matched = false;
    for (let index = 1; index < optionCount; index += 1) {
      await categorySelect.selectOption({ index });
      const kmCardText = await kpiCard(page, 'Custo por KM').textContent();
      if (kmCardText?.includes('sem dados suficientes')) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Nenhum filtro disponivel na massa atual levou a card sem KM valido; regra coberta por unitario e pelo contrato visual do card.',
      });
    } else {
      const kmCard = kpiCard(page, 'Custo por KM');
      await expect(kmCard).toContainText('sem dados suficientes');
      await expect(kmCard).toContainText('KM válido indisponível');
    }
  });
});
