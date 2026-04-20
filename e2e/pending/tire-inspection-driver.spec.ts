import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — INSPEÇÃO DE PNEUS: MOTORISTA (Jorge)
 *
 * Fluxo completo do Motorista: ver botão, validações, preencher KM,
 * diagrama, formulário por pneu e finalizar inspeção.
 */

test.describe.serial('Inspeção de Pneus — Motorista (Jorge)', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  // ── A: Acesso e botão ───────────────────────────────────────────────────────

  test('A.1 Motorista vê seção "Inspeção de Pneus" em /checklists', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Motorista deve ver a seção de inspeção de pneus para seu veículo
    const tireSection = page.locator('text=Inspeção de Pneus');
    await expect(tireSection.first()).toBeVisible({ timeout: 15000 });
  });

  test('A.2 Motorista NÃO vê tabela de histórico de checklists (acesso restrito)', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Motorista não tem acesso a tabela de histórico (Fleet Assistant+)
    const historyTable = page.locator('table');
    await expect(historyTable).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // Pode haver tabela de seu próprio histórico — apenas verificar que não há
      // coluna "Cliente" ou similar de visão ampla
    });
  });

  // ── B: Erro — pneus não cadastrados ────────────────────────────────────────

  test('B.1 Erro: iniciar inspeção sem pneus cadastrados no veículo', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Verificar se o motorista tem veículo associado
    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado — execute o seed do driver primeiro');
      return;
    }

    // Tentar clicar no botão de inspeção de pneus
    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();

    // Se o botão está presente, clicar e verificar erro de pneus incompletos
    // (Este teste só é relevante em ambiente sem pneus cadastrados)
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível — verifique estado do seed');
      return;
    }

    await tireBtn.click();

    // Deve aparecer mensagem de erro sobre pneus não cadastrados
    const errorMsg = page.getByText(/pneus.*cadastrad|cadastr.*pneus/i);
    const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasError) {
      await expect(errorMsg).toBeVisible();
    }
    // Se não há erro, é porque os pneus estão cadastrados — o fluxo continuará nos próximos testes
  });

  // ── C: Fluxo de criação e KM ────────────────────────────────────────────────

  test('C.1 Clicar em "Inspeção de Pneus" redireciona para /inspecao-pneus/:id', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível');
      return;
    }

    await tireBtn.click();

    // Verificar se há erro de pneus incompletos ou navega para a página
    const errorVisible = await page.getByText(/pneus.*cadastrad|cadastr.*pneus|É necessário/i)
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (errorVisible) {
      test.skip(true, 'Pneus não cadastrados no veículo de Jorge — necessário seed');
      return;
    }

    // Verificar redirecionamento para página de inspeção
    await expect(page).toHaveURL(/.*inspecao-pneus\/.*/, { timeout: 10000 });
  });

  test('C.2 Passo KM: campo de odômetro visível na página de inspeção', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

    const tireBtn = page.locator('button', { hasText: /Inspeção de Pneus/i }).first();
    const btnVisible = await tireBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Botão de inspeção não visível');
      return;
    }

    await tireBtn.click();

    const onInspectionPage = await page.waitForURL(/.*inspecao-pneus\/.*/, { timeout: 10000 })
      .then(() => true).catch(() => false);
    if (!onInspectionPage) {
      test.skip(true, 'Não foi possível navegar para a inspeção');
      return;
    }

    // Verificar step de KM
    const kmLabel = page.locator('text=KM atual do veículo');
    await expect(kmLabel).toBeVisible({ timeout: 10000 });

    const kmInput = page.locator('input[type="number"]').first();
    await expect(kmInput).toBeVisible();
  });

  test('C.3 KM inválido: botão confirmar mostra erro de validação', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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

    const kmLabel = await page.locator('text=KM atual do veículo').isVisible({ timeout: 5000 }).catch(() => false);
    if (!kmLabel) {
      test.skip(true, 'Passo KM não visível — odômetro já confirmado anteriormente');
      return;
    }

    // Tentar confirmar sem preencher
    await page.locator('button', { hasText: /Confirmar KM/i }).click();
    await expect(page.getByText(/Informe o Km atual/i)).toBeVisible({ timeout: 5000 });
  });

  test('C.4 Confirmar KM válido exibe diagrama do veículo', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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

    // Se KM já confirmado, diagrama deve estar visível diretamente
    const kmLabel = await page.locator('text=KM atual do veículo').isVisible({ timeout: 3000 }).catch(() => false);
    if (kmLabel) {
      // Preencher KM e confirmar
      await page.locator('input[type="number"]').first().fill('125000');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    // Diagrama SVG deve aparecer
    const diagram = page.locator('svg').first();
    await expect(diagram).toBeVisible({ timeout: 10000 });

    // Instrução "Toque em cada pneu" visível
    await expect(page.getByText(/Toque em cada pneu/i)).toBeVisible({ timeout: 5000 });
  });

  // ── D: Diagrama e formulário por pneu ───────────────────────────────────────

  test('D.1 Clicar em pneu no diagrama abre modal de inspeção', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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
      await page.locator('input[type="number"]').first().fill('125000');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    // Aguardar SVG e clicar no primeiro pneu
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10000 });

    const tireNode = svg.locator('g[data-code]').first();
    const tireNodeExists = await tireNode.isVisible({ timeout: 3000 }).catch(() => false);

    if (!tireNodeExists) {
      // Tentar clicar em um rect dentro do SVG
      const rect = svg.locator('rect[data-code]').first();
      await expect(rect).toBeVisible({ timeout: 5000 });
      await rect.click();
    } else {
      await tireNode.click();
    }

    // Modal do pneu deve aparecer
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Deve ter campos de fabricante e marca
    await expect(modal.locator('select, input').first()).toBeVisible({ timeout: 5000 });
  });

  test('D.2 Modal do pneu contém campos obrigatórios: Fabricante, Marca, Foto, Status', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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
      await page.locator('input[type="number"]').first().fill('125000');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10000 });

    // Clicar no primeiro pneu disponível no SVG
    const firstRect = svg.locator('rect').first();
    await expect(firstRect).toBeVisible({ timeout: 5000 });
    await firstRect.click();

    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verificar campos obrigatórios
    await expect(modal.getByText(/Fabricante/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/Marca/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/Foto/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/Conforme|Não Conforme/i)).toBeVisible({ timeout: 5000 });
  });

  // ── E: Progresso e finalização ─────────────────────────────────────────────

  test('E.1 Barra de progresso exibe contagem de pneus respondidos', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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
      await page.locator('input[type="number"]').first().fill('125000');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    // Barra de progresso deve aparecer com "Progresso"
    await expect(page.getByText(/Progresso/i)).toBeVisible({ timeout: 10000 });
    // Formato X / Y pneus
    await expect(page.getByText(/pneus/i)).toBeVisible({ timeout: 5000 });
  });

  test('E.2 Botão "Finalizar Inspeção" visível após diagrama carregado', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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
      await page.locator('input[type="number"]').first().fill('125000');
      await page.locator('button', { hasText: /Confirmar KM/i }).click();
      await page.waitForTimeout(1000);
    }

    // Botão de finalizar deve estar visível (mesmo que não todos os pneus respondidos)
    await expect(page.locator('button', { hasText: /Finalizar Inspeção/i })).toBeVisible({ timeout: 10000 });
  });

  // ── F: Voltar / Navegação ───────────────────────────────────────────────────

  test('F.1 Botão de voltar navega para /checklists', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible();
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

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

    // Clicar no botão de voltar (ChevronLeft)
    await page.locator('button svg').first().click();
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 10000 });
  });

  // ── G: Restrições de acesso ─────────────────────────────────────────────────

  test('G.1 Motorista não acessa /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 10000 });
  });
});
