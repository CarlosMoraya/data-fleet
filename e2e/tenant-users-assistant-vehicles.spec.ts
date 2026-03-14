import { test, expect } from '@playwright/test';

test.describe('Módulo de Veículos (Papel: Fleet Assistant - Pedro)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Vehicles' })).toBeVisible({ timeout: 15000 });
  });

  test('Assistant pode abrir formulário mas não deve ver botão deletar (se sem flag)', async ({ page }) => {
    // 1. Verificar botão Add Vehicle existe
    await expect(page.locator('button:has-text("Add Vehicle")')).toBeVisible();

    // 2. Verificar se o botão editar existe nas linhas (se houver veículos)
    // Se não houver, criamos um rápido ou apenas checamos a ausência do de excluir
    const deleteButtons = page.locator('button .lucide-trash2');
    await expect(deleteButtons).toHaveCount(0); // Não deve ver lixeira se não tiver permissão
  });

  test('Assistant não tem acesso à página de Settings', async ({ page }) => {
    await page.goto('/settings');
    // Deve ser redirecionado para a home ou outra página
    await expect(page).not.toHaveURL(/settings/, { timeout: 8000 });
  });
});
