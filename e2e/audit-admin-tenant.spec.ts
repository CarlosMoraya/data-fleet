import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — PERFIS ADMINISTRATIVOS DO TENANT
 * Mariana (Analista), Pedro (Assistente), Alexandre (Gerente)
 */

test.describe('Analista de Frota (Mariana)', () => {
  test.use({ storageState: 'e2e/.auth/mariana.json' });

  test('A.1 Acesso ao Dashboard e KPIs', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'analyst', 'Teste exclusivo para Analista');
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Total Vehicles')).toBeVisible({ timeout: 15000 });
  });

  test('B.1 Gestão de Veículos (Escrita)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'analyst', 'Teste exclusivo para Analista');
    await page.goto('/cadastros/veiculos');
    const addBtn = page.getByRole('button', { name: /Add Vehicle|Novo Veículo/i });
    await expect(addBtn).toBeVisible();
  });

  test('C.1 Plano de Ação', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'analyst', 'Teste exclusivo para Analista');
    await page.goto('/acoes');
    // Corrigido para singular
    await expect(page.getByRole('heading', { name: 'Plano de Ação' })).toBeVisible();
    // Procura por botão que contenha "Pendente" (ignora números de contagem)
    await expect(page.getByRole('button').filter({ hasText: /^Pendente/ })).toBeVisible();
  });
});

test.describe('Assistente de Frota (Pedro)', () => {
  test.use({ storageState: 'e2e/.auth/pedro.json' });

  test('A.1 Restrição de Exclusão em Veículos', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'assistant', 'Teste exclusivo para Assistente');
    await page.goto('/cadastros/veiculos');
    await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
    
    const addBtn = page.getByRole('button', { name: /Add Vehicle|Novo Veículo/i });
    await expect(addBtn).toBeVisible();

    const trashBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash2') });
    if (await trashBtn.count() > 0) {
      await expect(trashBtn.first()).toBeDisabled();
    }
  });
});

test.describe('Gerente (Alexandre)', () => {
  test.use({ storageState: 'e2e/.auth/alexandre.json' });

  test('A.1 Acesso às Configurações', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager', 'Teste exclusivo para Gerente');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Veículos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Motoristas' })).toBeVisible();
  });
});
