import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — PERFIL 6: MOTORISTA (Jorge)
 * 
 * O Motorista é redirecionado para /checklists e deve poder preencher novos checklists.
 */

test.describe('Motorista — Fluxo Operacional', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  test('A.1 Acesso e Redirecionamento', async ({ page }) => {
    await page.goto('/');
    // Motorista deve ser redirecionado para /checklists
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
  });

  test('B.1 Iniciar Novo Checklist', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    
    // Motorista vê "Meu veículo" em vez de um botão "Novo Checklist" genérico
    const myVehicleSection = page.locator('text=Meu veículo');
    await expect(myVehicleSection).toBeVisible({ timeout: 15000 });

    // Se o motorista não tiver veículo associado
    const hasNoVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (hasNoVehicle) {
      console.log('Jorge não possui veículo associado no momento.');
      return; // Sem dados de seed — estado esperado é mensagem de erro
    }

    // Se o motorista tem veículo mas sem templates publicados
    const hasNoTemplates = await page.getByText(/Nenhum template publicado/i).isVisible();
    if (hasNoTemplates) {
      console.log('Nenhum template publicado para o veículo de Jorge.');
      return; // Sem dados de seed — estado esperado
    }

    // Se há checklist em aberto, o botão Iniciar estará desabilitado — usa Continuar
    const openChecklistContinue = page.getByRole('button', { name: /Continuar/i }).first();
    if (await openChecklistContinue.isVisible()) {
      await openChecklistContinue.click();
      await expect(page).toHaveURL(/.*checklists\/preencher.*/, { timeout: 15000 });
      return;
    }

    // Caso normal: botão Iniciar disponível
    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page).toHaveURL(/.*checklists\/preencher.*/, { timeout: 15000 });
  });

  test('C.1 Restrição de Acesso', async ({ page }) => {
    // Motorista não deve acessar configurações
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
  });
});
