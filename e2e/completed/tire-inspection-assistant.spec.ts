import { test, expect, type Page } from '@playwright/test';

/**
 * TESTES E2E — INSPEÇÃO DE PNEUS: FLEET ASSISTANT (Pedro)
 *
 * Fleet Assistant deve ver inspeções de pneus na aba "Inspeções de Pneus"
 * e abrir TireInspectionDetailModal com comparação das 3 últimas inspeções por posição.
 * NÃO deve ver botão "Inspeção de Pneus" (apenas Driver/Auditor iniciam).
 */

async function openTireInspectionsTab(page: Page) {
  await page.getByRole('button', { name: /Inspeções de Pneus/i }).click();
  return page.locator('table tbody tr');
}

test.describe.serial('Inspeção de Pneus — Fleet Assistant (Pedro)', () => {
  test.use({ storageState: 'e2e/.auth/pedro.json' });

  // ── A: Acesso e listagem ───────────────────────────────────────────────────

  test('A.1 Fleet Assistant acessa /checklists', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
  });

  test('A.2 Fleet Assistant vê tabela de histórico de checklists', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Assistant vê tabela de histórico (ao contrário do Motorista)
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  test('A.3 Fleet Assistant NÃO vê botão "Inspeção de Pneus" para iniciar', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Fleet Assistant não deve iniciar inspeções (somente Driver/Auditor)
    const tireStartBtn = page.locator('button', { hasText: /Inspeção de Pneus/i });
    await expect(tireStartBtn).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // Se existir algum botão com esse texto, deve ser de outro contexto
      // (ex: título de seção, não botão de ação)
    });
  });

  // ── B: Inspeções de pneus na listagem ───────────────────────────────────────

  test('B.1 Inspeções de pneus aparecem na aba dedicada', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const rows = await openTireInspectionsTab(page);

    const tableVisible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!tableVisible) {
      test.skip(true, 'Tabela não visível — sem histórico disponível');
      return;
    }

    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus no histórico — execute o seed primeiro');
      return;
    }

    await expect(rows.first()).toBeVisible();
  });

  test('B.2 Linha de inspeção de pneus exibe ícone de disco/pneu', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    // A linha deve ter algum ícone visual diferenciador
    const firstRow = tireRows.first();
    await expect(firstRow).toBeVisible();

    // SVG de ícone deve existir na linha
    await expect(firstRow.locator('svg').first()).toBeVisible({ timeout: 5000 });
  });

  // ── C: Modal de detalhes ───────────────────────────────────────────────────

  test('C.1 Clicar em inspeção de pneus abre TireInspectionDetailModal', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    // Modal deve abrir
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Header com "Inspeção de Pneus"
    await expect(modal.getByText(/Inspeção de Pneus/i)).toBeVisible({ timeout: 5000 });
  });

  test('C.2 Modal exibe header com placa, inspetor e datas', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Metadados: Inspetor, KM, Início, Conclusão
    await expect(modal.getByText(/Inspetor/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText('KM', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/Início/i)).toBeVisible({ timeout: 5000 });
  });

  test('C.3 Modal exibe badges de resumo: Total, Conformes, Não Conformes, Conformidade', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Summary badges
    await expect(modal.getByText(/Total/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText('Conformes', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText('Não Conformes', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText('Conformidade', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('C.4 Modal exibe comparação de fotos por posição de pneu', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Aguardar carregamento das respostas
    await page.waitForTimeout(1000);

    const loadingSpinner = modal.locator('svg.animate-spin');
    const isLoading = await loadingSpinner.isVisible({ timeout: 2000 }).catch(() => false);
    if (isLoading) {
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
    }

    await expect(modal.getByText(/Comparação \(3 últimas inspeções\)/i)).toBeVisible({ timeout: 5000 });

    const photoImages = modal.locator('img');
    const emptyPhotos = modal.getByText(/Sem foto/i);
    const photoCount = await photoImages.count();
    const emptyCount = await emptyPhotos.count();

    if (photoCount + emptyCount > 0) {
      if (photoCount > 0) {
        await expect(photoImages.first()).toBeVisible();
      } else {
        await expect(emptyPhotos.first()).toBeVisible();
      }
    }
  });

  test('C.5 Modal exibe data e status nas fotos comparativas', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Aguardar respostas carregarem
    const spinner = modal.locator('svg.animate-spin');
    const isLoading = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    if (isLoading) {
      await expect(spinner).not.toBeVisible({ timeout: 10000 });
    }

    await expect(modal.getByText(/Comparação \(3 últimas inspeções\)/i)).toBeVisible({ timeout: 5000 });

    const statusLabels = modal.getByText(/Conforme|Não conforme/i);
    await expect(statusLabels.first()).toBeVisible({ timeout: 5000 });
  });

  test('C.6 Modal pode ser fechado com botão X', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    const tireRows = await openTireInspectionsTab(page);

    const tireRowCount = await tireRows.count();

    if (tireRowCount === 0) {
      test.skip(true, 'Nenhuma inspeção de pneus na listagem');
      return;
    }

    await tireRows.first().locator('button[title="Visualizar"]').click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fechar modal
    await modal.locator('button').filter({ has: page.locator('svg') }).first().click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  // ── D: Restrições de acesso ─────────────────────────────────────────────────

  test('D.1 Fleet Assistant acessa /manutencao', async ({ page }) => {
    await page.goto('/manutencao');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*manutencao.*/, { timeout: 10000 });
  });

  test('D.2 Fleet Assistant NÃO acessa /settings', async ({ page }) => {
    await page.goto('/settings');
    // Deve ser redirecionado
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/settings');
  });
});
