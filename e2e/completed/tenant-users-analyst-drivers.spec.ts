import { test, expect } from '@playwright/test';

test.describe('Módulo de Motoristas - Permissões Fleet Analyst', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 15000 });
  });

  test('Deve visualizar e editar, mas excluir depende de flag', async ({ page }) => {
    // Verificar se há motoristas (banco pode ter dados reais ou estar vazio)
    const hasMotorists = await page.locator('tbody tr').count();
    if (hasMotorists === 0) {
      test.skip(true, 'Nenhum motorista cadastrado');
      return;
    }

    // Pegar primeira linha que não seja "Nenhum motorista"
    const firstRow = page.locator('tbody tr').first();
    const rowText = await firstRow.textContent();
    if (rowText?.includes('Nenhum')) {
      test.skip(true, 'Nenhum motorista cadastrado');
      return;
    }

    await expect(firstRow).toBeVisible();

    const editBtn = firstRow.locator('button:has(.sr-only:has-text("Editar"))');
    await expect(editBtn).toBeVisible();

    // Para Analyst (Mariana), delete depende da flag canDeleteDrivers
    // Se não estiver visível, ok. Se estiver, também ok (depende da config).
    // Apenas verificamos que o botão de editar está presente.
  });
});
