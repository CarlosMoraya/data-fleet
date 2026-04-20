import { test, expect } from '@playwright/test';

// Admin Master (chromium project) only
test.describe.serial('Exclusão de Checklists (Admin Master)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checklists');
    await expect(page.locator('h1', { hasText: 'Checklists' })).toBeVisible({ timeout: 15000 });
  });

  test('Admin Master deve ver botão de excluir na tabela', async ({ page }) => {
    const rowsCount = await page.locator('tbody tr').count();
    if (rowsCount === 0) {
      test.skip(true, 'Sem checklists para testar exclusão');
      return;
    }
    // Admin Master deve ver o ícone de lixeira
    await expect(page.locator('button[title="Excluir (Admin Master)"]').first()).toBeVisible();
  });

  test('deve exibir confirmação ao tentar excluir', async ({ page }) => {
    const deleteBtn = page.locator('button[title="Excluir (Admin Master)"]').first();
    const count = await deleteBtn.count();
    if (count === 0) {
      test.skip(true, 'Sem checklists para testar');
      return;
    }

    await deleteBtn.click();

    const dialog = page.locator('.fixed.inset-0').last();
    await expect(dialog.locator('h3', { hasText: 'Excluir checklist' })).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=irreversível')).toBeVisible();
    await expect(dialog.locator('button:has-text("Excluir permanentemente")')).toBeVisible();
    await expect(dialog.locator('button:has-text("Cancelar")')).toBeVisible();

    // Cancel (don't actually delete)
    await dialog.locator('button:has-text("Cancelar")').click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// Fleet Assistant should NOT see delete button
test.describe('Assistente NÃO deve ver botão de excluir', () => {
  test('fleet assistant não tem botão de excluir checklists', async ({ page }) => {
    // This test uses assistant storageState when run from the assistant project
    await page.goto('/checklists');
    await expect(page.locator('h1', { hasText: 'Checklists' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[title="Excluir (Admin Master)"]')).not.toBeVisible();
  });
});
