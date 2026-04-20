import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const UID = Date.now().toString().slice(-6);
const TEST_PLATE = `AXL${UID}`;

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'AxleConfigEditor aparece ao preencher eixos=2 (tipo não Moto)' },
  { id: '02', name: 'Eixo 1 automaticamente inicializado como Direcional' },
  { id: '03', name: 'Eixo 1: select Tipo desabilitado (não editável)' },
  { id: '04', name: 'Eixo 1: rodagem "Tripla" não aparece como opção' },
  { id: '05', name: 'badge "1/2 eixos configurados" exibido (incompleto = amarelo)' },
  { id: '06', name: 'botão "+ Adicionar eixo 2" visível quando configuração incompleta' },
  { id: '07', name: 'clicar "+ Adicionar eixo 2" adiciona nova linha de eixo' },
  { id: '08', name: 'badge "2/2 eixos configurados" exibido após completar (verde)' },
  { id: '09', name: 'total de pneus calculado e exibido após configuração completa' },
  { id: '10', name: 'Estepes de fábrica: incrementar adiciona ao total de pneus' },
  { id: '11', name: 'warning "Configure todos os eixos" visível quando incompleto' },
  { id: '12', name: 'eixos=3 com Duplo: tipo multi-eixo disponível quando slots >= 2' },
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
    '# Relatório E2E — Axle Configuration (Manager)',
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

  fs.writeFileSync(path.join(reportDir, 'axle-config-report.md'), report, 'utf-8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Abre o VehicleForm no modo de cadastro e preenche os campos mínimos até o campo eixos.
 * Retorna o locator do modal para interações subsequentes.
 */
async function openVehicleFormWithEixos(page: import('@playwright/test').Page, eixos: number) {
  await page.goto('/cadastros/veiculos');
  await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });

  await page.locator('button:has-text("Adicionar Veículo")').click();
  const modal = page.locator('.fixed.inset-0');
  await expect(modal.locator('h2', { hasText: 'Cadastrar Veículo' })).toBeVisible({ timeout: 5000 });
  await modal.locator('input').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  // Preencher campos mínimos necessários para chegar na seção de eixos
  await modal.locator('input[name="licensePlate"]').fill(TEST_PLATE + eixos);
  await modal.locator('select[name="type"]').selectOption('Truck');
  await modal.locator('input[name="eixos"]').fill(String(eixos));
  await page.waitForTimeout(500); // aguardar useEffect inicializar AxleConfigEditor

  return modal;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe.serial('Axle Configuration — Manager (Alexandre)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(() => {
    writeReport();
  });

  // -------------------------------------------------------------------------
  // Grupo 1 — Aparecimento e Inicialização
  // -------------------------------------------------------------------------

  test('01 — AxleConfigEditor aparece ao preencher eixos=2', async ({ page }) => {
    const r = rec('01');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });
      await expect(editor.locator('h4', { hasText: 'Configuração de Eixos' })).toBeVisible();
      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — Eixo 1 inicializado como Direcional automaticamente', async ({ page }) => {
    const r = rec('02');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Primeira linha do editor: label "Eixo 1"
      const firstRow = editor.locator('.border-blue-100').first();
      await expect(firstRow.locator('text=Eixo 1')).toBeVisible();

      // Select de tipo deve ter valor "direcional"
      const typeSelect = firstRow.locator('select').first();
      await expect(typeSelect).toHaveValue('direcional');

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — Eixo 1: select Tipo desabilitado (não editável)', async ({ page }) => {
    const r = rec('03');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      const firstRow = editor.locator('.border-blue-100').first();
      const typeSelect = firstRow.locator('select').first();
      await expect(typeSelect).toBeDisabled();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — Eixo 1: rodagem "tripla" não aparece como opção', async ({ page }) => {
    const r = rec('04');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      const firstRow = editor.locator('.border-blue-100').first();
      const rodagemSelect = firstRow.locator('select').nth(1);
      const triplaOption = rodagemSelect.locator('option[value="tripla"]');
      await expect(triplaOption).not.toBeAttached();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('05 — badge "1/2 eixos configurados" em amarelo (incompleto)', async ({ page }) => {
    const r = rec('05');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Badge com texto "1/2 eixos configurados"
      await expect(editor.locator('text=1/2 eixos configurados')).toBeVisible();

      // Badge deve ter classe amber (incompleto)
      const badge = editor.locator('.bg-amber-100');
      await expect(badge).toBeVisible();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('06 — botão "+ Adicionar eixo 2" visível quando configuração incompleta', async ({ page }) => {
    const r = rec('06');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      await expect(editor.locator('button:has-text("+ Adicionar eixo 2")')).toBeVisible();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('07 — clicar "+ Adicionar eixo 2" adiciona nova linha', async ({ page }) => {
    const r = rec('07');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      const addBtn = editor.locator('button:has-text("+ Adicionar eixo 2")');
      await addBtn.click();
      await page.waitForTimeout(300);

      // Deve haver 2 linhas agora
      const rows = editor.locator('.border-blue-100');
      await expect(rows).toHaveCount(2);

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('08 — badge "2/2 eixos configurados" em verde após completar', async ({ page }) => {
    const r = rec('08');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      await editor.locator('button:has-text("+ Adicionar eixo 2")').click();
      await page.waitForTimeout(300);

      await expect(editor.locator('text=2/2 eixos configurados')).toBeVisible();

      // Badge deve ter classe emerald (completo)
      const badge = editor.locator('.bg-emerald-100');
      await expect(badge).toBeVisible();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('09 — total de pneus exibido após configuração completa', async ({ page }) => {
    const r = rec('09');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      await editor.locator('button:has-text("+ Adicionar eixo 2")').click();
      await page.waitForTimeout(300);

      // "Total de pneus:" deve estar visível com um número (não "—")
      await expect(editor.locator('text=Total de pneus:')).toBeVisible();
      const totalEl = editor.locator('.text-emerald-600');
      await expect(totalEl).toBeVisible();
      const totalText = await totalEl.textContent();
      expect(Number(totalText?.trim())).toBeGreaterThan(0);

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('10 — Estepes de fábrica: incrementar adiciona ao total de pneus', async ({ page }) => {
    const r = rec('10');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      await editor.locator('button:has-text("+ Adicionar eixo 2")').click();
      await page.waitForTimeout(300);

      // Ler total atual
      const totalEl = editor.locator('.text-emerald-600');
      const totalBefore = Number((await totalEl.textContent())?.trim() ?? '0');

      // Preencher estepes = 1
      const stepsInput = editor.locator('input[inputmode="numeric"]');
      await stepsInput.fill('1');
      await page.waitForTimeout(200);

      const totalAfter = Number((await totalEl.textContent())?.trim() ?? '0');
      expect(totalAfter).toBe(totalBefore + 1);

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('11 — warning "Configure todos os eixos" visível quando incompleto', async ({ page }) => {
    const r = rec('11');
    try {
      const modal = await openVehicleFormWithEixos(page, 2);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Com apenas 1 eixo configurado, o warning deve aparecer
      await expect(editor.locator('text=Configure todos os 2 eixos')).toBeVisible({ timeout: 3000 });

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('12 — eixos=3: tipo "Duplo" disponível como opção no Eixo 2', async ({ page }) => {
    const r = rec('12');
    try {
      const modal = await openVehicleFormWithEixos(page, 3);
      const editor = modal.locator('.bg-blue-50');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Adicionar Eixo 2
      await editor.locator('button:has-text("+ Adicionar eixo 2")').click();
      await page.waitForTimeout(300);

      // Segunda linha: select tipo deve ter opção "duplo" (requer 2 slots, e temos 2 restantes)
      const secondRow = editor.locator('.border-blue-100').nth(1);
      const typeSelect = secondRow.locator('select').first();
      const duploOption = typeSelect.locator('option[value="duplo"]');
      await expect(duploOption).toBeAttached();

      await modal.locator('button:has-text("Cancelar")').click();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
