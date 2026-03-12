import { test, expect } from '@playwright/test';

test.describe('Módulo de Motoristas - Permissões Fleet Assistant', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 15000 });
  });

  test('Deve visualizar e cadastrar, mas não excluir nem editar', async ({ page }) => {
    // 1. Verificar se vê motoristas e botão de adicionar
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('button:has-text("Adicionar Motorista")')).toBeVisible();

    // 2. Tentar encontrar botões de edição/exclusão na tabela
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible()) {
      await expect(firstRow.locator('button:has(.sr-only:has-text("Editar"))')).not.toBeVisible();
      await expect(firstRow.locator('button:has(.sr-only:has-text("Excluir"))')).not.toBeVisible();
    }
    
    // 3. Tentar acessar página de configurações (não deve ter acesso)
    await page.goto('/settings');
    // Deve ser redirecionado para home ou checklists
    await expect(page).not.toHaveURL('/settings');
  });
});
