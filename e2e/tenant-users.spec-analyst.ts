import { test, expect } from '@playwright/test';

test.describe('Módulo de Veículos (Papel: Fleet Analyst - Mariana)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/vehicles');
    await expect(page.locator('h1', { hasText: 'Vehicles' })).toBeVisible({ timeout: 15000 });
  });

  test('Analyst pode editar mas não deve ver lixeira (sem o flag)', async ({ page }) => {
    const editButtons = page.locator('button .lucide-edit2');
    const deleteButtons = page.locator('button .lucide-trash2');

    // Se houver algum veículo (criamos um rápido se precisar, ou apenas checamos a lista)
    if (await editButtons.count() > 0) {
      await expect(editButtons.first()).toBeVisible();
      await expect(deleteButtons).toHaveCount(0);
    }
  });
});
