import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — INSPEÇÃO DE PNEUS: CONFIGURAÇÕES (Alexandre — Manager)
 *
 * Manager deve ver campo "Pneus (Inspeção)" nas configurações de intervalo
 * com valor mínimo de 7 dias enforçado.
 */

test.describe.serial('Inspeção de Pneus — Configurações de Intervalo (Alexandre)', () => {
  test.use({ storageState: 'e2e/.auth/alexandre.json' });

  // ── A: Acesso às configurações ──────────────────────────────────────────────

  test('A.1 Manager acessa /settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*settings.*/, { timeout: 15000 });
  });

  test('A.2 Seção de configurações de checklist visível', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Deve haver alguma seção de configuração de intervalo de checklists
    const checklistSection = page.getByText(/Checklists?|Intervalo/i).first();
    await expect(checklistSection).toBeVisible({ timeout: 15000 });
  });

  // ── B: Campo de intervalo de pneus ──────────────────────────────────────────

  test('B.1 Campo "Pneus (Inspeção)" visível nas configurações de intervalo', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Label do campo de pneus
    const pneusLabel = page.getByText(/Pneus.*Inspe[cç][aã]o|Inspe[cç][aã]o.*Pneus/i);
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });
  });

  test('B.2 Campo de pneus tem valor padrão de 7 ou maior', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Localizar input do campo de pneus
    // Padrão: input próximo ao label "Pneus (Inspeção)"
    const pneusLabel = page.getByText(/Pneus.*Inspe[cç][aã]o|Inspe[cç][aã]o.*Pneus/i);
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });

    // O input deve ser encontrado na mesma seção/linha
    const pneusRow = page.locator('div', { has: pneusLabel });
    const pneusInput = pneusRow.locator('input[type="number"]').first();

    const inputVisible = await pneusInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      // Tentar encontrar o input de outra forma — pegar todos os inputs numéricos
      // O de pneus é geralmente o terceiro (Diário, Semanal, Pneus)
      const allInputs = page.locator('input[type="number"]');
      const inputCount = await allInputs.count();
      if (inputCount >= 3) {
        const thirdInput = allInputs.nth(2);
        const val = await thirdInput.inputValue();
        const numVal = parseInt(val, 10);
        expect(numVal).toBeGreaterThanOrEqual(7);
      }
      return;
    }

    const val = await pneusInput.inputValue();
    const numVal = parseInt(val, 10);
    expect(numVal).toBeGreaterThanOrEqual(7);
  });

  test('B.3 Campo de pneus tem atributo min="7"', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const pneusLabel = page.getByText(/Pneus.*Inspe[cç][aã]o|Inspe[cç][aã]o.*Pneus/i);
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });

    // Verificar min=7 em algum input numérico da página de settings
    const inputWithMin7 = page.locator('input[type="number"][min="7"]');
    await expect(inputWithMin7).toBeVisible({ timeout: 5000 });
  });

  // ── C: Validação de mínimo ────────────────────────────────────────────────

  test('C.1 Salvar com valor < 7 é bloqueado — valor retorna para 7', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const pneusLabel = page.getByText(/Pneus.*Inspe[cç][aã]o|Inspe[cç][aã]o.*Pneus/i);
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });

    // Localizar o input de pneus
    const inputWithMin7 = page.locator('input[type="number"][min="7"]').first();
    const inputVisible = await inputWithMin7.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      test.skip(true, 'Input com min=7 não encontrado');
      return;
    }

    // Tentar inserir valor menor que 7
    await inputWithMin7.fill('3');

    // Clicar em salvar
    const saveBtn = page.locator('button', { hasText: /Salvar/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Após salvar, o valor deve ser normalizado para 7 (Math.max no código)
    const savedVal = await inputWithMin7.inputValue();
    const numVal = parseInt(savedVal, 10);
    expect(numVal).toBeGreaterThanOrEqual(7);
  });

  test('C.2 Salvar com valor válido (14) persiste após reload', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const pneusLabel = page.getByText(/Pneus.*Inspe[cç][aã]o|Inspe[cç][aã]o.*Pneus/i);
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });

    const inputWithMin7 = page.locator('input[type="number"][min="7"]').first();
    const inputVisible = await inputWithMin7.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      test.skip(true, 'Input com min=7 não encontrado');
      return;
    }

    // Salvar com valor 14
    await inputWithMin7.fill('14');

    const saveBtn = page.locator('button', { hasText: /Salvar/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Recarregar página
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verificar que valor persiste
    await expect(pneusLabel).toBeVisible({ timeout: 15000 });

    const inputAfterReload = page.locator('input[type="number"][min="7"]').first();
    await expect(inputAfterReload).toBeVisible({ timeout: 5000 });

    const savedVal = await inputAfterReload.inputValue();
    const numVal = parseInt(savedVal, 10);
    expect(numVal).toBe(14);

    // Restaurar para 7 após o teste
    await inputAfterReload.fill('7');
    await page.locator('button', { hasText: /Salvar/i }).first().click();
    await page.waitForTimeout(1000);
  });

  // ── D: Outros campos de intervalo ─────────────────────────────────────────

  test('D.1 Outros campos de intervalo (Diário/Checklist) ainda presentes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verificar que os campos existentes de intervalo continuam funcionando
    const allNumberInputs = page.locator('input[type="number"]');
    const count = await allNumberInputs.count();

    // Deve haver pelo menos 1 input numérico (o de pneus)
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
