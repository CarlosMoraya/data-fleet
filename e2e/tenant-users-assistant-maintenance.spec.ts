import { test, expect } from '@playwright/test';

const UID = Date.now().toString().slice(-6);
const OS_OFICINA = `OS-EXT-${UID}`;

test.describe.serial('Manutenção — Integração Agendamento → OS e Dual OS', () => {

  // ─── 01: Seed — criar agendamento para usar no fluxo ────────────────────────

  test('01 — seed: criar agendamento para o fluxo de integração', async ({ page }) => {
    await page.goto('/agendamentos');
    await expect(page.locator('h1', { hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("Novo Agendamento")').click();
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Novo Agendamento' })).toBeVisible({ timeout: 10000 });

    // Aguarda spinner sumir (opções carregadas)
    await expect(modal.locator('select[name="vehicleId"]')).toBeVisible({ timeout: 10000 });

    const vehicleOptions = await modal.locator('select[name="vehicleId"] option').count();
    if (vehicleOptions < 2) {
      test.skip(true, 'Nenhum veículo disponível — execute os seed tests do assistant primeiro');
      return;
    }
    await modal.locator('select[name="vehicleId"]').selectOption({ index: 1 });

    const workshopOptions = await modal.locator('select[name="workshopId"] option').count();
    if (workshopOptions < 2) {
      test.skip(true, 'Nenhuma oficina disponível — execute os seed tests do manager primeiro');
      return;
    }
    await modal.locator('select[name="workshopId"]').selectOption({ index: 1 });

    // Data de amanhã (min é today quando criando)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await modal.locator('input[name="scheduledDate"]').fill(tomorrow.toISOString().split('T')[0]);

    await modal.locator('button:has-text("Agendar")').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Linha deve aparecer na tabela
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  // ─── 02: Botão "Gerar OS" navega para /manutencao e abre form ───────────────

  test('02 — navegação: "Gerar OS" abre form de nova manutenção em /manutencao', async ({ page }) => {
    await page.goto('/agendamentos');
    await expect(page.locator('h1', { hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    const gerarOsBtn = page.locator('button[title="Gerar OS de Manutenção"]').first();
    await expect(gerarOsBtn).toBeVisible({ timeout: 5000 });
    await gerarOsBtn.click();

    // Verifica navegação
    await expect(page).toHaveURL('/manutencao', { timeout: 10000 });

    // Form deve abrir automaticamente via useEffect
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Nova Manutenção' })).toBeVisible({ timeout: 10000 });
  });

  // ─── 03: Form pré-preenchido com dados do agendamento ───────────────────────

  test('03 — prefill: vehicleId, workshopId e entryDate preenchidos do agendamento', async ({ page }) => {
    await page.goto('/agendamentos');
    await expect(page.locator('h1', { hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    await page.locator('button[title="Gerar OS de Manutenção"]').first().click();
    await expect(page).toHaveURL('/manutencao', { timeout: 10000 });

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Nova Manutenção' })).toBeVisible({ timeout: 10000 });

    // Aguarda opções carregarem (spinner desaparece)
    await expect(modal.locator('select[name="vehicleId"]')).toBeVisible({ timeout: 10000 });

    // Veículo, oficina e data devem ter valores do agendamento
    const vehicleVal = await modal.locator('select[name="vehicleId"]').inputValue();
    expect(vehicleVal).not.toBe('');

    const workshopVal = await modal.locator('select[name="workshopId"]').inputValue();
    expect(workshopVal).not.toBe('');

    const entryDateVal = await modal.locator('input[name="entryDate"]').inputValue();
    expect(entryDateVal).not.toBe('');

    // Tipo e status devem ter os defaults do prefill
    const typeVal = await modal.locator('select[name="type"]').inputValue();
    expect(typeVal).toBe('Preventiva');

    const statusVal = await modal.locator('select[name="status"]').inputValue();
    expect(statusVal).toBe('Aguardando orçamento');

    await modal.locator('button:has-text("Cancelar")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  // ─── 04: OS Interna é div read-only (não input) ─────────────────────────────

  test('04 — OS Interna: div read-only exibe "Será gerada automaticamente" no CREATE', async ({ page }) => {
    await page.goto('/agendamentos');
    await expect(page.locator('h1', { hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    await page.locator('button[title="Gerar OS de Manutenção"]').first().click();
    await expect(page).toHaveURL('/manutencao', { timeout: 10000 });

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Nova Manutenção' })).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('select[name="vehicleId"]')).toBeVisible({ timeout: 10000 });

    // OS Interna NÃO deve ser um <input> editável
    await expect(modal.locator('input[name="os"]')).not.toBeAttached();

    // Deve ser div mostrando texto de placeholder
    await expect(modal.locator('text=Será gerada automaticamente')).toBeVisible();

    // OS da Oficina deve ser input editável
    await expect(modal.locator('input[name="workshopOs"]')).toBeVisible();
    const workshopOsVal = await modal.locator('input[name="workshopOs"]').inputValue();
    expect(workshopOsVal).toBe('');

    await modal.locator('button:has-text("Cancelar")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  // ─── 05: Salvar OS via prefill, verificar OS gerada na tabela ────────────────

  test('05 — salvar: OS Interna gerada automaticamente e OS da Oficina persistida', async ({ page }) => {
    await page.goto('/agendamentos');
    await expect(page.locator('h1', { hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    await page.locator('button[title="Gerar OS de Manutenção"]').first().click();
    await expect(page).toHaveURL('/manutencao', { timeout: 10000 });

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Nova Manutenção' })).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('select[name="vehicleId"]')).toBeVisible({ timeout: 10000 });

    // Custo estimado (prefill traz 0, mas vamos preencher um valor real)
    await modal.locator('input[name="estimatedCost"]').fill('1500');

    // Preenche OS da Oficina
    await modal.locator('input[name="workshopOs"]').fill(OS_OFICINA);

    // Salva
    await modal.locator('button:has-text("Criar Manutenção")').click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verifica que tabela tem pelo menos uma linha
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // A primeira coluna (OS) deve ter o padrão OS-AAMM-XXXX
    const firstOsText = await page.locator('table tbody tr').first().locator('td').first().textContent();
    expect(firstOsText?.trim()).toMatch(/OS-\d{4}-\d{4}/);
  });

  // ─── 06: Editar OS — OS Interna mostra valor real (imutável) ────────────────

  test('06 — editar: OS Interna mostra valor real read-only; OS da Oficina tem valor salvo', async ({ page }) => {
    await page.goto('/manutencao');
    await expect(page.locator('h1', { hasText: 'Manutenção' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // Clica no botão "Editar" (title="Editar") da primeira linha
    const editBtn = page.locator('table tbody tr').first().locator('button[title="Editar"]');
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Editar OS / Orçamento' })).toBeVisible({ timeout: 10000 });

    // OS Interna NÃO deve ser input
    await expect(modal.locator('input[name="os"]')).not.toBeAttached();

    // Div com font-mono deve exibir OS real (padrão OS-AAMM-XXXX), NÃO "automaticamente"
    const osInternalDiv = modal.locator('div.font-mono');
    const osInternalText = await osInternalDiv.textContent();
    expect(osInternalText?.trim()).toMatch(/OS-\d{4}-\d{4}/);
    expect(osInternalText).not.toContain('automaticamente');

    // OS da Oficina deve ter o valor salvo anteriormente
    const workshopOsInput = modal.locator('input[name="workshopOs"]');
    await expect(workshopOsInput).toBeVisible();
    const workshopOsVal = await workshopOsInput.inputValue();
    expect(workshopOsVal).toBe(OS_OFICINA);

    await modal.locator('button:has-text("Cancelar")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  // ─── 07: Fluxo manual — "+ Nova Manutenção" também tem OS Interna read-only ─

  test('07 — manual: "+ Nova Manutenção" mostra OS Interna como read-only', async ({ page }) => {
    await page.goto('/manutencao');
    await expect(page.locator('h1', { hasText: 'Manutenção' })).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("Nova Manutenção")').click();
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.locator('h2', { hasText: 'Nova Manutenção' })).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('select[name="vehicleId"]')).toBeVisible({ timeout: 10000 });

    // OS Interna: div read-only mostrando placeholder — não é input
    await expect(modal.locator('input[name="os"]')).not.toBeAttached();
    await expect(modal.locator('text=Será gerada automaticamente')).toBeVisible();

    // OS da Oficina: input editável vazio
    await expect(modal.locator('input[name="workshopOs"]')).toBeVisible();
    const workshopOsVal = await modal.locator('input[name="workshopOs"]').inputValue();
    expect(workshopOsVal).toBe('');

    await modal.locator('button:has-text("Cancelar")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

});
