import { test, expect } from '@playwright/test';

test.describe('Módulo de Motoristas - Permissões Fleet Analyst', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 15000 });
  });

  test('Deve visualizar e editar, mas excluir depende de flag', async ({ page }) => {
    // 1. Verificar se vê motoristas
    await expect(page.locator('table')).toBeVisible();

    // 2. Tentar editar o primeiro motorista da lista
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    
    const editBtn = firstRow.locator('button:has(.sr-only:has-text("Editar"))');
    await expect(editBtn).toBeVisible();
    
    // 3. Verificar botão de excluir (deve depender da flag canDeleteDrivers)
    // Para Mariana, esperamos que NÃO seja visível por padrão
    const deleteBtn = firstRow.locator('button:has(.sr-only:has-text("Excluir"))');
    await expect(deleteBtn).not.toBeVisible();
  });
});
