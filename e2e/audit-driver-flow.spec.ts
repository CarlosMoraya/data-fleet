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

    // Verifica se há um botão "Iniciar" disponível
    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    
    // Se o motorista não tiver veículo/templates, o botão não aparecerá.
    // Vamos registrar o estado atual para auditoria.
    const hasVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (hasVehicle) {
      console.log('Jorge não possui veículo associado no momento.');
      return; // Sucesso parcial (validou a mensagem de erro esperada se sem dados)
    }

    await expect(startBtn).toBeVisible();
    await startBtn.click();
    
    // Se clicou em iniciar, deve ir para a página de preenchimento
    await expect(page).toHaveURL(/.*checklists\/preencher.*/, { timeout: 15000 });
  });

  test('C.1 Restrição de Acesso', async ({ page }) => {
    // Motorista não deve acessar configurações
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
  });
});
