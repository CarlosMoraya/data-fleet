import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const UID = Date.now().toString().slice(-6);
const TEST_NAME = `Oficina Partnership E2E ${UID}`;
const TEST_CNPJ = `456789120001${UID.slice(-2)}`; // 14 dígitos, diferente dos outros specs

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'tabela: coluna "Tipo" existe no cabeçalho' },
  { id: '02', name: 'botões "Cadastrar Oficina" e "Convidar Oficina" existem' },
  { id: '03', name: 'modal "Cadastrar Oficina": título "Nova Oficina" e SEM campos de login' },
  { id: '04', name: 'criar: oficina de referência cadastrada com sucesso' },
  { id: '05', name: 'tipo: badge "Referência" exibido para nova oficina' },
  { id: '06', name: 'busca por nome funciona' },
  { id: '07', name: 'busca por CNPJ funciona' },
  { id: '08', name: 'editar: modal sem campos de login; nome alterado persiste' },
  { id: '09', name: 'cnpj duplicado: erro ao cadastrar CNPJ já existente' },
  { id: '10', name: 'modal "Convidar Oficina": abre com título e elementos corretos' },
  { id: '11', name: 'gerar link: convite criado e exibido na lista' },
  { id: '12', name: 'copiar link: feedback visual ao copiar' },
  { id: '13', name: 'revogar convite: remove da lista' },
  { id: '14', name: 'fechar: modal "Convidar Oficina" fecha ao clicar "Fechar"' },
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
    '# Relatório E2E — Workshop Partnership',
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

  fs.writeFileSync(path.join(reportDir, 'workshop-partnership-report.md'), report, 'utf-8');
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe.serial('Workshop Partnership Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/oficinas');
    await expect(page.locator('h1', { hasText: 'Oficinas' })).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(() => {
    writeReport();
  });

  // -------------------------------------------------------------------------
  // Grupo 1 — Tabela e Botões
  // -------------------------------------------------------------------------

  test('01 — tabela: coluna "Tipo" existe no cabeçalho', async ({ page }) => {
    const r = rec('01');
    try {
      await expect(page.locator('table thead th', { hasText: 'Tipo' })).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — botões "Cadastrar Oficina" e "Convidar Oficina" existem', async ({ page }) => {
    const r = rec('02');
    try {
      await expect(page.locator('button:has-text("Cadastrar Oficina")')).toBeVisible();
      await expect(page.locator('button:has-text("Convidar Oficina")')).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 2 — Cadastrar Oficina como Referência
  // -------------------------------------------------------------------------

  test('03 — modal "Cadastrar Oficina": título "Nova Oficina" e SEM campos de login', async ({ page }) => {
    const r = rec('03');
    try {
      await page.locator('button:has-text("Cadastrar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Nova Oficina' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('input[name="loginEmail"]')).not.toBeAttached();
      await expect(modal.locator('input[name="loginPassword"]')).not.toBeAttached();

      await modal.locator('button:has-text("Cancelar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — criar: oficina de referência cadastrada com sucesso', async ({ page }) => {
    const r = rec('04');
    try {
      await page.locator('button:has-text("Cadastrar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Nova Oficina' })).toBeVisible({ timeout: 5000 });

      await modal.locator('input[name="name"]').fill(TEST_NAME);
      await modal.locator('input[name="cnpj"]').fill(TEST_CNPJ);
      await modal.locator('input[name="phone"]').fill('11988887777');
      await modal.locator('input[name="email"]').fill('parceria@oficinae2e.com');
      await modal.locator('input[name="contactPerson"]').fill('Ana Mecânica');
      await modal.locator('input[name="addressStreet"]').fill('Av. das Oficinas');
      await modal.locator('input[name="addressNumber"]').fill('100');
      await modal.locator('input[name="addressComplement"]').fill('');
      await modal.locator('input[name="addressNeighborhood"]').fill('Industrial');
      await modal.locator('input[name="addressCity"]').fill('Campinas');
      await modal.locator('input[name="addressState"]').fill('SP');
      await modal.locator('input[name="addressZip"]').fill('13010100');
      await modal.getByLabel('Mecânica Geral').check();
      await modal.locator('textarea[name="notes"]').fill('Oficina Partnership E2E');

      await modal.locator('button:has-text("Cadastrar Oficina")').click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible({ timeout: 10000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('05 — tipo: badge "Referência" exibido para nova oficina', async ({ page }) => {
    const r = rec('05');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_NAME);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_NAME });
      await expect(row).toBeVisible({ timeout: 5000 });
      await expect(row.getByText('Referência')).toBeVisible();
      await expect(row.getByText('Parceira')).not.toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('06 — busca por nome funciona', async ({ page }) => {
    const r = rec('06');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_NAME);
      await page.waitForTimeout(300);
      await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('07 — busca por CNPJ funciona', async ({ page }) => {
    const r = rec('07');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_CNPJ);
      await page.waitForTimeout(300);
      await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('08 — editar: modal sem campos de login; nome alterado persiste', async ({ page }) => {
    const r = rec('08');
    try {
      await page.locator('input[placeholder*="Buscar"]').fill(TEST_NAME);
      await page.waitForTimeout(300);

      const row = page.locator('tr', { hasText: TEST_NAME });
      await row.locator('button[title="Editar"]').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Editar Oficina' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('input[name="loginEmail"]')).not.toBeAttached();
      await expect(modal.locator('input[name="loginPassword"]')).not.toBeAttached();

      const updatedName = `${TEST_NAME} EDITADO`;
      await modal.locator('input[name="name"]').fill(updatedName);
      await modal.locator('button:has-text("Salvar Alterações")').click();
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      await page.locator('input[placeholder*="Buscar"]').fill(updatedName);
      await page.waitForTimeout(300);
      await expect(page.locator('table').getByText(updatedName)).toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('09 — cnpj duplicado: erro ao cadastrar CNPJ já existente', async ({ page }) => {
    const r = rec('09');
    try {
      await page.locator('button:has-text("Cadastrar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Nova Oficina' })).toBeVisible({ timeout: 5000 });

      await modal.locator('input[name="name"]').fill('Outra Oficina Mesmo CNPJ');
      await modal.locator('input[name="cnpj"]').fill(TEST_CNPJ);
      await modal.locator('button:has-text("Cadastrar Oficina")').click();

      await expect(modal.getByText('Este CNPJ já está cadastrado para este cliente.')).toBeVisible({ timeout: 10000 });

      await modal.locator('button:has-text("Cancelar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  // -------------------------------------------------------------------------
  // Grupo 3 — Modal "Convidar Oficina Parceira"
  // -------------------------------------------------------------------------

  test('10 — modal "Convidar Oficina": abre com título e elementos corretos', async ({ page }) => {
    const r = rec('10');
    try {
      await page.locator('button:has-text("Convidar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Convidar Oficina Parceira' })).toBeVisible({ timeout: 5000 });
      await expect(modal.locator('button:has-text("Gerar Link")')).toBeVisible();
      await expect(modal.locator('button:has-text("Fechar")')).toBeVisible();

      await modal.locator('button:has-text("Fechar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('11 — gerar link: convite criado e exibido na lista', async ({ page }) => {
    const r = rec('11');
    try {
      await page.locator('button:has-text("Convidar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('button:has-text("Gerar Link")')).toBeVisible({ timeout: 5000 });

      await modal.locator('button:has-text("Gerar Link")').click();

      // Aguarda seção de convites pendentes aparecer
      await expect(modal.getByText('CONVITES PENDENTES')).toBeVisible({ timeout: 10000 });

      // Verifica URL com token
      await expect(modal.locator('p.font-mono')).toContainText('workshop/join?token=', { timeout: 5000 });

      // Verifica data de expiração
      await expect(modal.getByText(/Expira em/)).toBeVisible();

      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('12 — copiar link: feedback visual ao copiar', async ({ page }) => {
    const r = rec('12');
    try {
      // Contexto de clipboard precisa ser concedido
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      // Reabre o modal (beforeEach navegou para a página, fechando o modal)
      await page.locator('button:has-text("Convidar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      // Aguarda o convite gerado no teste 11 carregar
      await expect(modal.locator('p.font-mono')).toBeVisible({ timeout: 10000 });

      // Clica no botão de copiar (dentro da linha do convite)
      await modal.locator('button[title="Copiar link"]').click();

      // Aguarda ícone Check aparecer (feedback visual)
      await expect(modal.locator('svg.text-green-600')).toBeVisible({ timeout: 3000 });

      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('13 — revogar convite: remove da lista', async ({ page }) => {
    const r = rec('13');
    try {
      // Reabre o modal
      await page.locator('button:has-text("Convidar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('p.font-mono')).toBeVisible({ timeout: 10000 });

      // Clica no botão de revogar (lixeira)
      await modal.locator('button[title="Revogar convite"]').click();

      // A seção "CONVITES PENDENTES" deve desaparecer (lista vazia)
      await expect(modal.getByText('CONVITES PENDENTES')).not.toBeVisible({ timeout: 10000 });

      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('14 — fechar: modal "Convidar Oficina" fecha ao clicar "Fechar"', async ({ page }) => {
    const r = rec('14');
    try {
      // Reabre o modal para testar o botão Fechar
      await page.locator('button:has-text("Convidar Oficina")').click();
      await page.waitForTimeout(300);

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Convidar Oficina Parceira' })).toBeVisible({ timeout: 5000 });

      await modal.locator('button:has-text("Fechar")').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
