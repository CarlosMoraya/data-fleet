import { test, expect } from '@playwright/test';

test.describe.serial('Veículos: filtros estruturados', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('deep-link de pendência aplica o filtro', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel('Pendência')).toHaveValue('crlv_expired');
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
    await expect(page).toHaveURL(/shipper=/);
  });

  test('limpar filtros reseta URL e busca', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expiring');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    await expect(page).not.toHaveURL(/issue=|shipper=|unit=|q=/);
    await expect(searchInput).toHaveValue('');
  });

  test('botão voltar restaura o filtro anterior', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const pendencySelect = page.getByLabel('Pendência');
    await pendencySelect.selectOption('crlv_expired');
    await expect(page).toHaveURL(/issue=crlv_expired/);
    await pendencySelect.selectOption('gr_expiring');
    await expect(page).toHaveURL(/issue=gr_expiring/);

    await page.goBack();
    await expect(pendencySelect).toHaveValue('crlv_expired');
  });

  test('busca textual coexiste com filtros', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');

    await expect(searchInput).toHaveValue('ABC');
    await expect(page).toHaveURL(/issue=crlv_expired/);
  });
});
