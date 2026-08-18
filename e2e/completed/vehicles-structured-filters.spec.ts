import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openFilter(page: Page, label: string) {
  await page.getByRole('button', { name: label }).click();
}

async function closeFilter(page: Page) {
  await page.keyboard.press('Escape');
}

function filterOptions(page: Page) {
  return page.getByRole('listbox').getByRole('option');
}

function option(page: Page, name: string) {
  return page.getByRole('listbox').getByRole('option', { name, exact: true });
}

test.describe.serial('Veículos: filtros estruturados', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('deep-link de pendência aplica o filtro', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await openFilter(page, 'Pendência');
    await expect(option(page, 'CRLV vencido')).toHaveAttribute('aria-checked', 'true');
  });

  test('selecionar embarcador atualiza a URL', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await openFilter(page, 'Embarcador');
    const options = filterOptions(page);
    const count = await options.count();

    if (count === 0) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Seed sem embarcador derivado da lista de veículos; controle existe, mas não há opção selecionável.',
      });
      await closeFilter(page);
      return;
    }

    await options.first().click();
    await closeFilter(page);
    await expect(page).toHaveURL(/shipper=/);
  });

  test('permite combinar duas pendências e repete o parâmetro na URL', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await openFilter(page, 'Pendência');
    await option(page, 'CRLV vencido').click();
    await option(page, 'Sem motorista').click();
    await closeFilter(page);

    await expect(page).toHaveURL(/issue=crlv_expired/);
    await expect(page).toHaveURL(/issue=no_driver/);
  });

  test('limpar seleção de um grupo remove só os parâmetros daquele grupo', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');

    await openFilter(page, 'Pendência');
    await option(page, 'CRLV vencido').click();
    await closeFilter(page);
    await expect(page).toHaveURL(/issue=crlv_expired/);

    await openFilter(page, 'Pendência');
    await page.getByRole('button', { name: 'Limpar seleção' }).click();
    await closeFilter(page);

    await expect(page).not.toHaveURL(/issue=/);
    await expect(page).toHaveURL(/q=ABC/);
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

  test('botão voltar restaura a seleção anterior de pendência', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await openFilter(page, 'Pendência');
    await option(page, 'CRLV vencido').click();
    await closeFilter(page);
    await expect(page).toHaveURL(/issue=crlv_expired/);

    await openFilter(page, 'Pendência');
    await option(page, 'GR a vencer (30 dias)').click();
    await closeFilter(page);
    await expect(page).toHaveURL(/issue=gr_expiring/);

    await page.goBack();
    await expect(page).toHaveURL(/issue=crlv_expired/);
    await expect(page).not.toHaveURL(/issue=gr_expiring/);
  });

  test('novo filtro de disponibilidade grava value canônico', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'Disponibilidade' })).toBeEnabled({ timeout: 10000 });

    await openFilter(page, 'Disponibilidade');
    await option(page, 'Indisponíveis').click();
    await closeFilter(page);

    await expect(page).toHaveURL(/availability=unavailable/);
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
