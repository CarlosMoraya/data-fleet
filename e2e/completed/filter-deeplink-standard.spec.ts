import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openFilter(page: Page, label: string) {
  await page.getByRole('button', { name: label }).click();
}

async function closeFilter(page: Page) {
  await page.keyboard.press('Escape');
}

function option(page: Page, name: string) {
  return page.getByRole('listbox').getByRole('option', { name, exact: true });
}

test.describe.serial('Padrão de deep link de filtros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('link compartilhável: ir direto para veículos com issue já filtra a tabela', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await openFilter(page, 'Pendência');
    await expect(option(page, 'CRLV vencido')).toHaveAttribute('aria-checked', 'true');
    await closeFilter(page);
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();
  });

  test('botão voltar: aplicar issue via dropdown, depois goBack desfaz o filtro', async ({ page }) => {
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

  test('limpar filtro: com filtro ativo, clicar Limpar filtros remove query params', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired&shipper=s1&unit=u1');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).not.toHaveURL(/issue=|shipper=|unit=|q=/);
  });

  test('não persiste como preferência: aplicar filtro, navegar fora e voltar limpo', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await expect(page).not.toHaveURL(/issue=/);
    await expect(page.getByTestId('active-filter-banner')).toHaveCount(0);
  });

  test('retrocompat: abre link legado de motoristas e normaliza para issue', async ({ page }) => {
    await page.goto('/cadastros/motoristas?situacao=cnh_vencida');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveURL(/issue=cnh_expired/);
    await expect(page).not.toHaveURL(/situacao=/);
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();
  });

  test('busca na URL: digitar busca adiciona q= na URL e recarregar preserva', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');
    await expect(page).toHaveURL(/q=ABC/);

    await page.reload();
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });
    await expect(searchInput).toHaveValue('ABC');
    await expect(page).toHaveURL(/q=ABC/);
  });
});
