import { expect, test } from '@playwright/test';

test.describe.serial('Dashboard: navegação da fila de ação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('deep-link exibe chip ativo e não falha no filtro de checklist', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=checklist_overdue');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('active-filter-banner')).toContainText('Checklist vencido');
    await expect(page.getByText('Erro ao carregar veículos')).not.toBeVisible();

    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('active-filter-banner')).toContainText('CRLV vencido');
  });

  test('clicar em item de veículo na fila leva para veículos já filtrado', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Operação/ }).click();

    const vehicleActionButton = page.getByRole('button').filter({ hasText: /CRLV|GR a vencer|checklist vencido/i }).first();
    if (await vehicleActionButton.count() === 0) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Seed sem pendências de veículo na Fila de Ação; rotas cobertas pelos testes unitários de actionQueueRoutes.',
      });
      return;
    }

    await vehicleActionButton.click();
    await expect(page).toHaveURL(/\/cadastros\/veiculos\?issue=/);
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();
  });

  test('remover filtro pelo chip limpa a pendência da URL', async ({ page }) => {
    await page.goto('/cadastros/veiculos?issue=crlv_expired');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Remover filtro' }).click();
    await expect(page).not.toHaveURL(/issue=/);
    await expect(page.getByTestId('active-filter-banner')).not.toBeVisible();
  });
});
