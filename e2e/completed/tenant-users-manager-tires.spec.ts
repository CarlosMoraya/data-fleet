import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const UID = Date.now().toString().slice(-6);
const TEST_SPEC = `295/80R22.5-E2E-${UID}`;

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'página /cadastros/pneus carrega com header "Gestão de Pneus"' },
  { id: '02', name: 'botão "Adicionar Pneus" visível para Manager' },
  { id: '03', name: 'AddModeModal: abre com 2 opções de cadastro' },
  { id: '04', name: 'VehiclePickerModal: abre ao clicar "Por Placa (Individual)"' },
  { id: '05', name: 'TireForm: abre ao selecionar veículo, campo especificação visível' },
  { id: '06', name: 'TireForm: cadastrar pneu individual com sucesso' },
  { id: '07', name: 'tabela: pneu cadastrado aparece com classificação e status "Ativo"' },
  { id: '08', name: 'busca: filtrar por especificação funciona' },
  { id: '09', name: 'TireHistoryModal: abre ao clicar botão Histórico' },
  { id: '10', name: 'TireHistoryModal: exibe código do pneu e tabela de histórico' },
  { id: '11', name: 'TireForm (edição): abre ao clicar Editar, campo Especificação editável' },
  { id: '12', name: 'TireForm (edição): salvar alteração persiste na tabela' },
  { id: '13', name: 'toggle Desativar: modal de confirmação abre e desativa pneu' },
  { id: '14', name: 'AddModeModal: opção "Por Modelo (Lote)" abre TireBatchForm' },
];

const recorded = new Map<string, { status: '✅ PASSOU' | '❌ FALHOU'; error: string }>();

function rec(id: string) {
  return {
    pass() {
      recorded.set(id, { status: '✅ PASSOU', error: '—' });
    },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
      recorded.set(id, { status: '❌ FALHOU', error: msg });
      throw e;
    },
  };
}

function writeReport() {
  const reportDir = path.join(process.cwd(), '.claude', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const rows = ALL_TESTS.map((t) => {
    const r = recorded.get(t.id);
    if (!r) return `| ${t.id} | ${t.name} | ⏭️ PULADO | — |`;
    return `| ${t.id} | ${t.name} | ${r.status} | ${r.error} |`;
  }).join('\n');

  const bugs = ALL_TESTS.filter((t) => recorded.get(t.id)?.status === '❌ FALHOU');
  const bugsSection =
    bugs.length === 0
      ? '_Nenhum bug encontrado._'
      : bugs.map((t) => `- **Teste ${t.id} — ${t.name}**: ${recorded.get(t.id)!.error}`).join('\n');

  const passed = [...recorded.values()].filter((r) => r.status === '✅ PASSOU').length;
  const failed = bugs.length;
  const skipped = ALL_TESTS.length - recorded.size;

  const report = [
    '# Relatório E2E — Tire Management (Manager)',
    `Data: ${date}`,
    '',
    `**Resumo:** ${passed} passaram · ${failed} falharam · ${skipped} pulados`,
    '',
    '## Resultados',
    '',
    '| # | Teste | Status | Erro |',
    '|---|-------|--------|------|',
    rows,
    '',
    '## Bugs Encontrados',
    '',
    bugsSection,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, 'tire-management-report.md'), report, 'utf-8');
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe.serial('Tire Management — Manager (Alexandre)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/pneus');
    await expect(page.locator('h1', { hasText: 'Gestão de Pneus' })).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(() => {
    writeReport();
  });

  // -------------------------------------------------------------------------
  // Grupo 1 — Página e Botões
  // -------------------------------------------------------------------------

  test('01 — página carrega com header "Gestão de Pneus"', async ({ page }) => {
    const r = rec('01');
    try {
      await expect(page.locator('h1', { hasText: 'Gestão de Pneus' })).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — botão "Adicionar Pneus" visível para Manager', async ({ page }) => {
    const r = rec('02');
    try {
      await expect(page.locator('button:has-text("Adicionar Pneus")')).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — AddModeModal: abre com 2 opções de cadastro', async ({ page }) => {
    const r = rec('03');
    try {
      await page.locator('button:has-text("Adicionar Pneus")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Adicionar Pneus' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('text=Por Placa (Individual)')).toBeVisible();
      await expect(modal.locator('text=Por Modelo (Lote)')).toBeVisible();

      await modal.locator('text=Cancelar').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — VehiclePickerModal: abre ao clicar "Por Placa (Individual)"', async ({ page }) => {
    const r = rec('04');
    try {
      await page.locator('button:has-text("Adicionar Pneus")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await modal.locator('text=Por Placa (Individual)').click();
      await page.waitForTimeout(300);

      await expect(modal.locator('h2', { hasText: 'Selecionar Veículo' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('input[placeholder*="Buscar por placa"]')).toBeVisible();

      // Fechar
      await modal.locator('text=Cancelar').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 2 — Cadastro Individual (depende de veículo existente)
  // -------------------------------------------------------------------------

  test('05 — TireForm: abre ao selecionar veículo', async ({ page }) => {
    const r = rec('05');
    try {
      await page.locator('button:has-text("Adicionar Pneus")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await modal.locator('text=Por Placa (Individual)').click();
      await page.waitForTimeout(300);

      await expect(modal.locator('h2', { hasText: 'Selecionar Veículo' })).toBeVisible({ timeout: 5000 });

      // Verificar se há veículos disponíveis
      const vehicleItems = modal.locator('.divide-y > button');
      const count = await vehicleItems.count();
      if (count === 0) {
        test.skip(true, 'Nenhum veículo disponível — rode tenant-users-manager-vehicles.spec.ts primeiro');
        return;
      }

      // Selecionar o primeiro veículo disponível
      await vehicleItems.first().click();
      await page.waitForTimeout(300);

      // TireForm deve abrir
      await expect(modal.locator('h2', { hasText: 'Novo Pneu' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('input[placeholder="ex: 295/80R22.5"]')).toBeVisible();

      await modal.locator('button:has-text("Cancelar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('06 — TireForm: cadastrar pneu individual com sucesso', async ({ page }) => {
    const r = rec('06');
    try {
      await page.locator('button:has-text("Adicionar Pneus")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await modal.locator('text=Por Placa (Individual)').click();
      await page.waitForTimeout(300);

      await expect(modal.locator('h2', { hasText: 'Selecionar Veículo' })).toBeVisible({ timeout: 5000 });

      const vehicleItems = modal.locator('.divide-y > button');
      const count = await vehicleItems.count();
      if (count === 0) {
        test.skip(true, 'Nenhum veículo disponível');
        return;
      }

      await vehicleItems.first().click();
      await page.waitForTimeout(300);

      await expect(modal.locator('h2', { hasText: 'Novo Pneu' })).toBeVisible({ timeout: 5000 });
      await modal.locator('input').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(300);

      // Preencher especificação
      await modal.locator('input[placeholder="ex: 295/80R22.5"]').fill(TEST_SPEC);

      // Selecionar classificação "Novo" (já deve ser o padrão)
      const classSelect = modal.locator('select').first();
      await classSelect.selectOption('Novo');

      // Selecionar posição (se disponível)
      const positionSelect = modal.locator('select').nth(1);
      const posCount = await positionSelect.locator('option:not([disabled])').count();
      if (posCount > 1) {
        // Selecionar a primeira opção não vazia e não desabilitada
        const options = positionSelect.locator('option');
        const optCount = await options.count();
        for (let i = 1; i < optCount; i++) {
          const isDisabled = await options.nth(i).getAttribute('disabled');
          if (!isDisabled) {
            const val = await options.nth(i).getAttribute('value');
            if (val) { await positionSelect.selectOption(val); break; }
          }
        }
      }

      await modal.locator('button:has-text("Cadastrar Pneu")').click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Verificar que aparece na tabela
      await expect(page.locator('table').getByText(TEST_SPEC)).toBeVisible({ timeout: 10000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('07 — tabela: pneu cadastrado aparece com status "Ativo"', async ({ page }) => {
    const r = rec('07');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await expect(row).toBeVisible({ timeout: 5000 });
      await expect(row.getByText('Ativo')).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('08 — busca: filtrar por especificação funciona', async ({ page }) => {
    const r = rec('08');
    try {
      const searchInput = page.locator('input[placeholder*="Buscar"]');
      await searchInput.fill(TEST_SPEC);
      await page.waitForTimeout(300);
      await expect(page.locator('table').getByText(TEST_SPEC)).toBeVisible({ timeout: 5000 });

      // Limpar busca e verificar texto vazio
      await searchInput.fill('XXXXXXXXXXX_NOT_FOUND');
      await page.waitForTimeout(300);
      await expect(page.locator('text=Nenhum pneu encontrado com os filtros aplicados.')).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 3 — Histórico
  // -------------------------------------------------------------------------

  test('09 — TireHistoryModal: abre ao clicar botão Histórico', async ({ page }) => {
    const r = rec('09');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await expect(row).toBeVisible({ timeout: 5000 });
      await row.locator('button[title="Histórico"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible({ timeout: 5000 });

      await modal.locator('button:has-text("Fechar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('10 — TireHistoryModal: exibe código do pneu e tabela de histórico', async ({ page }) => {
    const r = rec('10');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await row.locator('button[title="Histórico"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Verificar que existe seção de histórico (De / Para / Responsável)
      await expect(modal.locator('text=De')).toBeVisible();
      await expect(modal.locator('text=Para')).toBeVisible();

      await modal.locator('button:has-text("Fechar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 4 — Edição
  // -------------------------------------------------------------------------

  test('11 — TireForm (edição): abre ao clicar Editar', async ({ page }) => {
    const r = rec('11');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await expect(row).toBeVisible({ timeout: 5000 });
      await row.locator('button[title="Editar"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Editar Pneu' })).toBeVisible({ timeout: 5000 });
      // Campo especificação deve estar preenchido
      await expect(modal.locator('input[placeholder="ex: 295/80R22.5"]')).toHaveValue(TEST_SPEC);

      await modal.locator('button:has-text("Cancelar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('12 — TireForm (edição): salvar alteração persiste na tabela', async ({ page }) => {
    const r = rec('12');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await row.locator('button[title="Editar"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Editar Pneu' })).toBeVisible({ timeout: 5000 });

      // Mudar classificação para "Meia vida"
      const classSelect = modal.locator('select').first();
      await classSelect.selectOption('Meia vida');

      await modal.locator('button:has-text("Salvar Alterações")').click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Verificar que badge de classificação mudou
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);
      const updatedRow = page.locator('tr', { hasText: TEST_SPEC });
      await expect(updatedRow.getByText('Meia vida')).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 5 — Toggle e Lote
  // -------------------------------------------------------------------------

  test('13 — toggle Desativar: modal de confirmação abre', async ({ page }) => {
    const r = rec('13');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_SPEC });
      await expect(row).toBeVisible({ timeout: 5000 });
      await row.locator('button[title="Desativar"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Desativar Pneu' })).toBeVisible({ timeout: 5000 });

      // Confirmar desativação
      await modal.locator('button:has-text("Desativar")').click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Status deve mudar para "Inativo"
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_SPEC);
      await page.waitForTimeout(300);
      const inactiveRow = page.locator('tr', { hasText: TEST_SPEC });
      await expect(inactiveRow.getByText('Inativo')).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('14 — AddModeModal: opção "Por Modelo (Lote)" abre TireBatchForm', async ({ page }) => {
    const r = rec('14');
    try {
      await page.locator('button:has-text("Adicionar Pneus")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await modal.locator('text=Por Modelo (Lote)').click();
      await page.waitForTimeout(300);

      // TireBatchForm aparece — Step 1: Selecionar Modelo
      await expect(modal.locator('text=Selecionar Modelo')).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('text=Escolha o modelo de veículo')).toBeVisible();

      await modal.locator('button:has-text("Cancelar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
