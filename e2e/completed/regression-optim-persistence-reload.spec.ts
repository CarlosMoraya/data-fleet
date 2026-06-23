import { expect, test, type Locator, type Page } from '@playwright/test';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

test.describe('Regressão pós-otimização — persistência sob reload por rota', () => {
  test('Veículos: busca persiste após reload e conteúdo reidrata', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('ABC');

    await page.reload();
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });
    await expect(searchInput).toHaveValue('ABC');
  });

  test('Motoristas: busca persiste após reload e conteúdo reidrata', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(mainHeading(page, 'Motoristas')).toBeVisible({ timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Teste');

    await page.reload();
    await expect(mainHeading(page, 'Motoristas')).toBeVisible({ timeout: 15000 });
    await expect(searchInput).toHaveValue('Teste');
  });

  test('Pneus: busca persiste após reload e conteúdo reidrata', async ({ page }) => {
    await page.goto('/cadastros/pneus');
    await expect(mainHeading(page, 'Gestão de Pneus')).toBeVisible({ timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('ABC');

    await page.reload();
    await expect(mainHeading(page, 'Gestão de Pneus')).toBeVisible({ timeout: 15000 });
    await expect(searchInput).toHaveValue('ABC');
  });

  test('Manutenção: busca persiste após reload e conteúdo reidrata', async ({ page }) => {
    await page.goto('/manutencao');
    await expect(mainHeading(page, /Manuten/i)).toBeVisible({ timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('OS');
    }

    await page.reload();
    await expect(mainHeading(page, /Manuten/i)).toBeVisible({ timeout: 15000 });
    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveValue('OS');
    }
  });
});
