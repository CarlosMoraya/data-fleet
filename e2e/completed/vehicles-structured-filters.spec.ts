import { test, expect } from '@playwright/test';

test.describe.serial('Veículos: filtros estruturados', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('deep-link de pendência aplica o filtro', async ({ page }) => {
    await page.goto('/cadastros/veiculos?pendencia=crlv_vencido');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel('Pendência')).toHaveValue('crlv_vencido');
  });

  test('selecionar embarcador atualiza a URL', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const shipperSelect = page.getByLabel('Embarcador');
    const firstShipper = await shipperSelect.evaluate((select) => {
      const options = Array.from((select as HTMLSelectElement).options);
      return options.find((option) => option.value !== '')?.value ?? null;
    });

    if (!firstShipper) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Seed sem embarcador derivado da lista de veículos; controle existe, mas não há opção selecionável.',
      });
      return;
    }

    await shipperSelect.selectOption(firstShipper);
    await expect(page).toHaveURL(/embarcador=/);
  });

  test('limpar filtros reseta URL e busca', async ({ page }) => {
    await page.goto('/cadastros/veiculos?pendencia=crlv_a_vencer');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    await expect(page).not.toHaveURL(/pendencia=|embarcador=|unidade=/);
    await expect(searchInput).toHaveValue('');
  });

  test('botão voltar restaura o filtro anterior', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const pendencySelect = page.getByLabel('Pendência');
    await pendencySelect.selectOption('crlv_vencido');
    await expect(page).toHaveURL(/pendencia=crlv_vencido/);
    await pendencySelect.selectOption('gr_a_vencer');
    await expect(page).toHaveURL(/pendencia=gr_a_vencer/);

    await page.goBack();
    await expect(pendencySelect).toHaveValue('crlv_vencido');
  });

  test('busca textual coexiste com filtros', async ({ page }) => {
    await page.goto('/cadastros/veiculos?pendencia=crlv_vencido');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');

    await expect(searchInput).toHaveValue('ABC');
    await expect(page).toHaveURL(/pendencia=crlv_vencido/);
  });
});
