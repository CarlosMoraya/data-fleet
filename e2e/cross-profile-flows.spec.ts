import { test, expect } from '@playwright/test';

/**
 * TESTE CRUZADO (Cross-Profile) — Fluxo de Manutenção Corretiva
 * 
 * 1. Carlos (Auditor) cria checklist com não conformidade.
 * 2. Mariana (Analista) cria o Plano de Ação, assume e envia para aprovação.
 * 3. Alexandre (Gerente) aprova a conclusão do plano.
 */

test.describe.serial('Fluxo Cruzado: Auditoria para Manutenção', () => {
  
  let targetVehicle = ''; 

  test('Passo 1: Auditor (Carlos) gera Inconformidade', async ({ browser }) => {
    test.slow();
    const auditorCtx = await browser.newContext({ storageState: 'e2e/.auth/carlos.json' });
    const page = await auditorCtx.newPage();
    
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Checklists', exact: true })).toBeVisible({ timeout: 10000 });

    // Limpeza de rascunhos se houver - aguardar um pouco para o estado carregar
    const cancelBtn = page.getByRole('button', { name: /Cancelar/i });
    try {
        await expect(cancelBtn).toBeVisible({ timeout: 5000 });
        await cancelBtn.click();
        await page.getByRole('button', { name: /Excluir permanentemente/i }).click();
        await page.waitForTimeout(1000);
    } catch (e) {
        // Não há rascunho, vida que segue
    }

    await page.waitForSelector('select', { timeout: 15000 });
    const vehicleSelect = page.getByRole('combobox');
    
    const options = page.locator('select option');
    let selectedValue = '';
    for (let i = 1; i < await options.count(); i++) {
        const val = await options.nth(i).getAttribute('value');
        if (val) {
            selectedValue = val;
            targetVehicle = (await options.nth(i).innerText()).split(' ')[0];
            break;
        }
    }
    
    if (!selectedValue) throw new Error("Carlos não tem veículos.");
    await vehicleSelect.selectOption(selectedValue);
    console.log(`Veículo selecionado: ${targetVehicle}`);
    
    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();
    
    // 3. Responder todos os itens (o botão 'Finalizar' só habilita com tudo preenchido)
    // Esperar a navegação e o carregamento dos itens (rota localizada)
    await expect(page).toHaveURL(/.*\/preencher.*/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Aguardar ao menos um item (tag p com o título)
    const itemTitles = page.locator('div.bg-white.rounded-2xl.border p.text-sm.font-medium');
    await expect(itemTitles.first()).toBeVisible({ timeout: 15000 });
    const count = await itemTitles.count();
    console.log(`Preenchendo ${count} itens...`);

    const conformeButtons = page.getByRole('button', { name: 'Conforme', exact: true });
    const problemaButtons = page.getByRole('button', { name: 'Problema', exact: true });

    for (let i = 0; i < count; i++) {
        await itemTitles.nth(i).scrollIntoViewIfNeeded();
        if (i === 0) {
            await problemaButtons.nth(i).click();
        } else {
            await conformeButtons.nth(i).click();
        }
    }
    
    // 4. Finalizar
    const finalizeBtn = page.getByRole('button', { name: /Finalizar Checklist/i });
    await expect(finalizeBtn).toBeEnabled({ timeout: 10000 });
    await finalizeBtn.click();
    
    // Confirmar se houver modal de confirmação
    const confirmBtn = page.getByRole('button', { name: 'Confirmar e Finalizar' });
    if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
    }
    
    // Validar redirecionamento e presença no histórico
    await expect(page).toHaveURL(/\/checklists$/);
    await expect(page.locator('div:has-text("Concluído")').first()).toBeVisible();

    await auditorCtx.close();
  });

  test('Passo 2: Analista (Mariana) cria, assume e conclui o Plano de Ação', async ({ browser }) => {
    const analystCtx = await browser.newContext({ storageState: 'e2e/.auth/mariana.json' });
    const page = await analystCtx.newPage();
    
    await page.goto('/checklists');
    
    // 1. Localizar o checklist de Carlos com inconformidade
    await page.getByRole('button', { name: /Com inconformidades/i }).click();

    const rowChecklist = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(rowChecklist).toBeVisible();

    // 2. Criar Plano de Ação manualmente
    await rowChecklist.getByTitle(/Criar Plano de Ação/i).click();
    
    // Esperar o modal aparecer e preencher
    const modal = page.locator('div.bg-white.rounded-2xl.shadow-2xl');
    await expect(modal.getByText(/Criar Plano de Ação/i)).toBeVisible();
    
    await modal.locator('input[placeholder*="Revisão de freios"]').fill('Manutenção Corretiva E2E');
    // Selecionar o responsável (Alexandre ou qualquer um que não seja Auditor/Motorista)
    await modal.locator('select').selectOption({ index: 1 });
    
    // Data limite: amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await modal.locator('input[type="date"]').fill(dateStr);
    
    await modal.getByRole('button', { name: /Criar/i }).click();
    
    // 3. Ir para a tela de Ações e gerenciar
    await page.goto('/acoes');
    
    // Filtrar por Pendente
    await page.locator('button').filter({ hasText: /^Pendente/ }).first().click();

    const rowPlan = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(rowPlan).toBeVisible();
    await rowPlan.click();
    
    const planModal = page.locator('div').filter({ hasText: 'Plano de Ação' }).last();
    
    // Assumir
    await planModal.getByRole('button', { name: /Assumir esta ação/i }).click();
    await expect(planModal.getByText(/Em execução/i)).toBeVisible();
    
    // Concluir (Enviar para aprovação)
    await planModal.getByPlaceholder(/Descreva o que foi feito/i).fill('Manutenção validada via teste cruzado.');
    await planModal.getByRole('button', { name: /Enviar para aprovação/i }).click();
    
    await expect(page.getByText(/aguardando aprovação/i).first()).toBeVisible();
    await analystCtx.close();
  });

  test('Passo 3: Gerente (Alexandre) aprova o ciclo', async ({ browser }) => {
    const managerCtx = await browser.newContext({ storageState: 'e2e/.auth/alexandre.json' });
    const page = await managerCtx.newPage();
    
    await page.goto('/acoes');
    
    // Filtrar por Aguardando Aprovação
    await page.locator('button').filter({ hasText: /^Ag. Aprovação/ }).first().click();
    
    const row = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(row).toBeVisible();
    await row.click();
    
    const approveModal = page.locator('div').filter({ hasText: 'Plano de Ação' }).last();
    await approveModal.getByRole('button', { name: /Aprovar conclusão/i }).click();
    
    await expect(approveModal.getByText(/Concluída/i).first()).toBeVisible();
    
    await managerCtx.close();
  });
});
