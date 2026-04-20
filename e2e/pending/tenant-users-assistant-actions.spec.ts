import { test, expect } from '@playwright/test';

test.describe.serial('Painel de Plano de Ação (Fleet Assistant)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/acoes');
    await expect(page.locator('h1', { hasText: 'Plano de Ação' })).toBeVisible({ timeout: 15000 });
  });

  test('deve carregar o painel de ações', async ({ page }) => {
    // Summary cards should be visible
    await expect(page.locator('text=Pendente').first()).toBeVisible();
    await expect(page.locator('text=Em Andamento').first()).toBeVisible();
    await expect(page.locator('text=Concluída').first()).toBeVisible();
  });

  test('deve filtrar ações por aba', async ({ page }) => {
    // Os botões de aba são pills com classe "rounded-full" (summary cards têm "rounded-2xl")
    const todosTab = page.locator('button.rounded-full:has-text("Todos")');
    const emAndamentoTab = page.locator('button.rounded-full:has-text("Em Andamento")');

    // Click "Todos" tab
    await todosTab.click();
    await expect(todosTab).toHaveClass(/bg-orange-500/);

    // Click "Em Andamento"
    await emAndamentoTab.click();
    await expect(emAndamentoTab).toHaveClass(/bg-orange-500/);
  });

  test('deve buscar ações pelo campo de pesquisa', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();

    // Verificar se há ações antes de buscar
    const rowsCount = await page.locator('tbody tr').count();
    if (rowsCount === 0) {
      test.skip(true, 'Sem ações para testar busca — crie um checklist com item "Problema" primeiro');
      return;
    }

    await searchInput.fill('OS-');
    // Should filter results without errors
    await expect(page.locator('table, text=Nenhuma ação encontrada')).toBeVisible({ timeout: 5000 });
    await searchInput.clear();
  });

  test('deve abrir modal de gestão ao clicar em uma ação', async ({ page }) => {
    // Navigate to "Todos" to see all actions
    await page.locator('button:has-text("Todos")').click();

    const rows = page.locator('tr td');
    const count = await rows.count();

    if (count === 0) {
      test.skip(true, 'Sem ações disponíveis para testar — crie um checklist com item "Problema" primeiro');
      return;
    }

    // Click first row
    await page.locator('tbody tr').first().click();

    const modal = page.locator('.fixed.inset-0').first();
    await expect(modal.locator('h2', { hasText: 'Plano de Ação' })).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('select')).toBeVisible(); // Status dropdown

    // Change status to in_progress
    await modal.locator('select').selectOption('in_progress');
    await modal.locator('button:has-text("Salvar alterações")').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test('deve validar O.S. obrigatória ao concluir ação', async ({ page }) => {
    await page.locator('button:has-text("Todos")').click();

    const rowsCount = await page.locator('tbody tr').count();
    if (rowsCount === 0) {
      test.skip(true, 'Sem ações para testar');
      return;
    }

    await page.locator('tbody tr').first().click();
    const modal = page.locator('.fixed.inset-0').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Try to complete without O.S.
    await modal.locator('select').selectOption('completed');
    await modal.locator('button:has-text("Salvar alterações")').click();

    // Should show error
    await expect(modal.locator('text=O.S. é obrigatório')).toBeVisible({ timeout: 3000 });

    // Fill O.S. and save
    await modal.locator('input[placeholder*="OS-"]').fill('OS-TEST-001');
    await modal.locator('textarea').fill('Reparo realizado com sucesso');
    await modal.locator('button:has-text("Salvar alterações")').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });
});
