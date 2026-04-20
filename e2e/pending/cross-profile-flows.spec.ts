import { test, expect } from '@playwright/test';

/**
 * TESTE CRUZADO (Cross-Profile) — Fluxo de Manutenção Corretiva
 * 
 * 1. Carlos (Auditor) cria checklist com não conformidade.
 * 2. Mariana (Analista) cria o Plano de Ação, assume e envia para aprovação.
 * 3. Alexandre (Gerente) aprova a conclusão do plano.
 */

test.describe.serial('Fluxo Cruzado: Auditoria para Manutenção', () => {
  test.setTimeout(120000);
  
  let targetVehicle = ''; 

  test('Passo 1: Auditor (Carlos) gera Inconformidade', async ({ browser }) => {
    const auditorCtx = await browser.newContext({ storageState: 'e2e/.auth/carlos.json' });
    const page = await auditorCtx.newPage();
    
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Checklists').first()).toBeVisible({ timeout: 30000 });

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
    
    // Pequena pausa para carregar templates após seleção
    await page.waitForTimeout(2000);
    
    const startBtn = page.locator('div').filter({ hasText: 'Iniciar Auditoria' }).getByRole('button', { name: /Iniciar/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();
    
    // 3. Responder todos os itens (o botão 'Finalizar' só habilita com tudo preenchido)
    // Esperar a navegação e o carregamento dos itens (rota localizada)
    await expect(page).toHaveURL(/.*\/preencher.*/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    console.log(`URL após iniciar: ${page.url()}`);
    
    // Aguardar ao menos um título de item ser visível
    await expect(page.locator('p.text-sm.font-medium').first()).toBeVisible({ timeout: 30000 });
    
    // Localizar botões para preenchimento (OK, Problema, N/A)
    const conformeButtons = page.locator('button').filter({ hasText: /^OK$/i });
    const problemaButtons = page.locator('button').filter({ hasText: /^Problema$/i });
    
    await expect(conformeButtons.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000); 
    const count = await conformeButtons.count();
    console.log(`Preenchendo ${count} itens...`);

    for (let i = 0; i < count; i++) {
        if (i === 0) {
            const probBtn = problemaButtons.nth(i);
            await probBtn.scrollIntoViewIfNeeded();
            await probBtn.click();
            
            // Opcional: preencher observação já que abriu o campo
            const textarea = page.locator('textarea').first();
            if (await textarea.isVisible()) {
                await textarea.fill('Inconformidade detectada durante auditoria E2E.');
            }
        } else {
            const confBtn = conformeButtons.nth(i);
            await confBtn.scrollIntoViewIfNeeded();
            await confBtn.click();
        }
        
        await page.waitForTimeout(100);
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
    await page.screenshot({ path: `test-results/passo1-concluido-${targetVehicle}.png` });

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
    await expect(modal).toBeHidden({ timeout: 10000 });
    
    // 3. Ir para a tela de Ações e gerenciar
    await page.goto('/acoes');
    await page.waitForLoadState('networkidle');
    
    // Filtrar por placa para garantir que vemos o nosso
    const searchInput = page.getByPlaceholder(/Buscar por placa/i);
    await searchInput.fill(targetVehicle);
    await page.waitForTimeout(1000); // Debounce
    
    // Filtrar por Pendente
    const pendingBtn = page.locator('button').filter({ hasText: /^Pendente/ }).first();
    await pendingBtn.click();

    const rowPlan = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(rowPlan).toBeVisible({ timeout: 20000 });
    await rowPlan.click();
    
    const planModal = page.locator('div.relative.bg-white.rounded-2xl.shadow-2xl').filter({ hasText: 'Plano de Ação' }).last();
    
    // Assumir
    const claimBtn = planModal.getByRole('button', { name: /Assumir esta ação/i });
    await expect(claimBtn).toBeVisible({ timeout: 10000 });
    await claimBtn.click();
    
    // Esperar a transição de estado
    await expect(claimBtn).toBeHidden({ timeout: 15000 });
    
    // Como o item sai de 'Pendente', ele some da lista atual. Vamos mudar para 'Em Andamento'
    const inProgressBtn = page.locator('button').filter({ hasText: /^Em Andamento/ }).first();
    await inProgressBtn.click();
    
    // Reabrir o modal (agora na lista de Em Andamento)
    const rowInProgress = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(rowInProgress).toBeVisible({ timeout: 15000 });
    await rowInProgress.click();

    // Agora sim, concluir (Enviar para aprovação)
    const activeModal = page.locator('div.relative.bg-white.rounded-2xl.shadow-2xl').filter({ hasText: 'Plano de Ação' }).last();
    const textarea = activeModal.getByPlaceholder(/Descreva o que foi feito/i);
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.scrollIntoViewIfNeeded();
    await textarea.fill('Manutenção validada via teste cruzado.');
    
    const sendBtn = activeModal.getByRole('button', { name: /Enviar para aprovação/i });
    await expect(sendBtn).toBeVisible({ timeout: 10000 });
    await sendBtn.click();
    await expect(sendBtn).toBeHidden({ timeout: 15000 });
    
    await expect(page.getByText(/Aguardando Aprovação/i).first()).toBeVisible({ timeout: 15000 });
    await analystCtx.close();
  });

  test('Passo 3: Gerente (Alexandre) aprova o ciclo', async ({ browser }) => {
    const managerCtx = await browser.newContext({ storageState: 'e2e/.auth/alexandre.json' });
    const page = await managerCtx.newPage();
    
    await page.goto('/acoes');
    await page.waitForLoadState('networkidle');
    
    // Filtrar por placa
    const searchInput = page.getByPlaceholder(/Buscar por placa/i);
    await searchInput.fill(targetVehicle);
    await page.waitForTimeout(1000);

    // Filtrar por Aguardando Aprovação
    const approvalBtn = page.locator('button').filter({ hasText: /^Ag. Aprovação/ }).first();
    await approvalBtn.click();
    
    const row = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.click();
    
    const approveModal = page.locator('div.relative.bg-white.rounded-2xl.shadow-2xl').filter({ hasText: 'Plano de Ação' }).last(); // Aprovar
    const approveBtn = approveModal.getByRole('button', { name: /Aprovar conclusão/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    
    // O item sai de 'Ag. Aprovação' e o modal pode fechar
    await expect(approveBtn).toBeHidden({ timeout: 15000 });
    
    // Mudar para o filtro Concluída para verificar
    const completedFilterBtn = page.locator('button').filter({ hasText: /^Concluída/ }).first();
    await completedFilterBtn.click();
    
    const rowCompleted = page.locator('tr').filter({ hasText: targetVehicle }).first();
    await expect(rowCompleted).toBeVisible({ timeout: 15000 });
    
    await managerCtx.close();
  });
});
