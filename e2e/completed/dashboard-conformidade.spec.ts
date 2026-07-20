import { expect, test } from '@playwright/test';

test.describe.serial('Dashboard: aba Conformidade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('renderiza os 8 cards, a fila documental e navega por deep link quando houver item', async ({ page }) => {
    await page.getByRole('button', { name: /Conformidade/ }).click();

    await expect(page.getByText('Conformidade Documental')).toBeVisible();
    await expect(page.getByText('Contratos PJ Anexados')).toBeVisible();
    await expect(page.getByText('Documentos Vencidos')).toBeVisible();
    await expect(page.getByText('Documentos a Vencer em 30 dias')).toBeVisible();
    await expect(page.getByText('Documentos Ausentes')).toBeVisible();
    await expect(page.getByText('Veículos Irregulares')).toBeVisible();
    await expect(page.getByText('Motoristas Irregulares')).toBeVisible();
    await expect(page.getByText('Itens Críticos')).toBeVisible();
    await expect(page.getByText('Fila de Ação Documental')).toBeVisible();

    const emptyState = page.getByText('Nenhuma ação crítica pendente. Frota em dia.');
    if (await emptyState.count()) {
      await expect(emptyState).toBeVisible();
      return;
    }

    const queueButton = page.locator('button').filter({ has: page.locator('span', { hasText: /CRLV|CNH|GR|Apólice|Contrato/ }) }).first();
    if (await queueButton.count() === 0) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Seed sem itens acionáveis na Fila de Ação Documental.',
      });
      return;
    }

    await queueButton.click();
    await expect(page).toHaveURL(/\/cadastros\/(veiculos|motoristas)\?issue=/);
  });
});
