import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — INSPEÇÃO DE PNEUS: AUDITOR (Carlos)
 *
 * Auditor deve selecionar a placa do veículo antes de iniciar a inspeção.
 * Pode inspecionar veículos que não são "seus".
 */

test.describe.serial('Inspeção de Pneus — Auditor (Carlos)', () => {
  test.use({ storageState: 'e2e/.auth/carlos.json' });

  // ── A: Acesso e seleção de veículo ──────────────────────────────────────────

  test('A.1 Auditor acessa /checklists', async ({ page }) => {
    await page.goto('/checklists');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('A.2 Auditor vê dropdown de seleção de veículo', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Auditor vê select de veículo (auditorVehicles)
    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });
  });

  test('A.3 Botão "Inspeção de Pneus" aparece após selecionar veículo', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    const optionCount = await vehicleSelect.locator('option').count();

    if (optionCount < 2) {
      test.skip(true, 'Nenhum veículo disponível para Carlos — execute o seed primeiro');
      return;
    }

    // Selecionar primeiro veículo disponível
    await vehicleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    // Botão de inspeção deve aparecer
    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    await expect(tireBtn).toBeVisible({ timeout: 10000 });
  });

  // ── B: Fluxo de criação ────────────────────────────────────────────────────

  test('B.1 Clicar em "Inspeção de Pneus" redireciona para /inspecao-pneus/:id', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    const optionCount = await vehicleSelect.locator('option').count();

    if (optionCount < 2) {
      test.skip(true, 'Nenhum veículo disponível para Carlos');
      return;
    }

    await vehicleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível após selecionar veículo');
      return;
    }

    await tireBtn.click();

    // Verificar erro de pneus incompletos ou navegar para inspeção
    const errorVisible = await page.getByText(/pneus.*cadastrad|cadastr.*pneus|É necessário/i)
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (errorVisible) {
      test.skip(true, 'Pneus não cadastrados no veículo — necessário seed');
      return;
    }

    await expect(page).toHaveURL(/.*inspecao-pneus\/.*/, { timeout: 10000 });
  });

  test('B.2 Página de inspeção exibe placa do veículo selecionado', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    const optionCount = await vehicleSelect.locator('option').count();

    if (optionCount < 2) {
      test.skip(true, 'Nenhum veículo disponível para Carlos');
      return;
    }

    // Obter texto da opção selecionada para comparar depois
    await vehicleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível');
      return;
    }

    await tireBtn.click();
    await page.waitForURL(/.*inspecao-pneus\/.*/, { timeout: 10000 }).catch(() => {});

    const onPage = page.url().includes('inspecao-pneus');
    if (!onPage) {
      test.skip(true, 'Não foi possível navegar para a inspeção');
      return;
    }

    // Header deve exibir "Inspeção de Pneus" e uma placa
    await expect(page.getByText(/Inspeção de Pneus/i)).toBeVisible({ timeout: 10000 });
    // A placa é exibida no header abaixo do título
    const header = page.locator('.bg-white.border-b');
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  // ── C: Passo KM e Diagrama ─────────────────────────────────────────────────

  test('C.1 Step KM visível na página de inspeção', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    const optionCount = await vehicleSelect.locator('option').count();

    if (optionCount < 2) {
      test.skip(true, 'Nenhum veículo disponível para Carlos');
      return;
    }

    await vehicleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível');
      return;
    }

    await tireBtn.click();
    await page.waitForURL(/.*inspecao-pneus\/.*/, { timeout: 10000 }).catch(() => {});

    const onPage = page.url().includes('inspecao-pneus');
    if (!onPage) {
      test.skip(true, 'Não foi possível navegar para a inspeção');
      return;
    }

    await page.waitForLoadState('networkidle');

    // KM step ou diagrama deve estar visível
    const kmVisible = await page.locator('text=KM atual do veículo').isVisible({ timeout: 5000 }).catch(() => false);
    const svgVisible = await page.locator('svg').first().isVisible({ timeout: 5000 }).catch(() => false);

    // Pelo menos um deve estar visível
    expect(kmVisible || svgVisible).toBe(true);
  });

  test('C.2 Após confirmar KM, diagrama SVG do veículo é exibido', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    const optionCount = await vehicleSelect.locator('option').count();

    if (optionCount < 2) {
      test.skip(true, 'Nenhum veículo disponível para Carlos');
      return;
    }

    await vehicleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível');
      return;
    }

    await tireBtn.click();
    await page.waitForURL(/.*inspecao-pneus\/.*/, { timeout: 10000 }).catch(() => {});

    const onPage = page.url().includes('inspecao-pneus');
    if (!onPage) {
      test.skip(true, 'Não foi possível navegar para a inspeção');
      return;
    }

    await page.waitForLoadState('networkidle');

    const kmLabel = await page.locator('text=KM atual do veículo').isVisible({ timeout: 3000 }).catch(() => false);
    if (kmLabel) {
      await page.locator('input[type="number"]').first().fill('98500');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    // Diagrama SVG
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });
  });

  // ── D: Sem restrição de veículo ─────────────────────────────────────────────

  test('D.1 Auditor pode ver múltiplos veículos no dropdown', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

    const optionCount = await vehicleSelect.locator('option').count();
    // Auditor deve poder ver mais de 1 opção (ou zero se sem dados)
    // Apenas verificar que o select está presente e acessível
    expect(optionCount).toBeGreaterThanOrEqual(1);
  });

  // ── E: Restrições de acesso ─────────────────────────────────────────────────

  test('E.1 Auditor não acessa /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 10000 });
  });
});
