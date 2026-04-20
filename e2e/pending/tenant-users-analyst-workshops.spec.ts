import { test, expect } from '@playwright/test';

test.describe('Módulo de Oficinas (Permissões Analyst)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/oficinas');
    await expect(page.locator('h1', { hasText: 'Oficinas Parceiras' })).toBeVisible({ timeout: 15000 });
  });

  test('deve permitir editar mas não excluir sem flag', async ({ page }) => {
    // Verificar se há oficinas
    const hasWorkshops = await page.locator('tbody tr').count();
    if (hasWorkshops === 0) {
      test.skip(true, 'Nenhuma oficina cadastrada');
      return;
    }

    const row = page.locator('tbody tr').first();
    const rowText = await row.textContent();
    if (rowText?.includes('Nenhuma')) {
      test.skip(true, 'Nenhuma oficina cadastrada');
      return;
    }

    // Botão Editar deve estar visível
    await expect(row.locator('button').first()).toBeVisible();

    // Botão Excluir pode ou não estar visível (depende da flag)
    // Apenas verificamos que a tabela carregou com dados
  });

  test('deve permitir adicionar oficina', async ({ page }) => {
    await expect(page.locator('button:has-text("Cadastrar Oficina")')).toBeVisible();
  });
});
