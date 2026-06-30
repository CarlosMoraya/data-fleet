import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// Director — cobertura dedicada de permissões (rank 8, acesso completo)
// Expectativas derivadas de src/lib/rolePermissions.ts:
//   - getDefaultRouteForRole('Director') === '/'
//   - Director ∈ ROLES_WITH_ACCESS / ROLES_CAN_CREATE / ROLES_CAN_DELETE /
//     ROLES_CAN_APPROVE_BUDGET
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'login redireciona para o dashboard' },
  { id: '02', name: 'sidebar com acesso completo' },
  { id: '03', name: 'acessa Cadastros (veículos) sem redirect' },
  { id: '04', name: 'vê ação de criar em Veículos' },
  { id: '05', name: 'vê ação de excluir' },
  { id: '06', name: 'acessa Manutenção' },
];

const recorded = new Map<string, { status: '✅ PASSOU' | '❌ FALHOU'; error: string }>();

function rec(id: string) {
  return {
    pass() {
      recorded.set(id, { status: '✅ PASSOU', error: '—' });
    },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
      // test.skip() lança "Test is skipped: ..." — manter como PULADO, não FALHOU
      if (msg.includes('Test is skipped')) throw e;
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
  const passed = [...recorded.values()].filter((r) => r.status === '✅ PASSOU').length;
  const failed = bugs.length;
  const skipped = ALL_TESTS.length - recorded.size;

  const bugsSection = bugs.length === 0
    ? '_Nenhum bug encontrado._'
    : bugs.map((t) => `- **Teste ${t.id} — ${t.name}**: ${recorded.get(t.id)!.error}`).join('\n');

  const report = [
    `# Relatório E2E — Director`,
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
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, 'role-director-report.md'), report, 'utf-8');
}

test.describe('Director — permissões', () => {
  test.afterAll(() => {
    writeReport();
  });

  test('01 — login redireciona para o dashboard', async ({ page }) => {
    const r = rec('01');
    try {
      await page.goto('/');
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
      await expect(page.locator('main').getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — sidebar com acesso completo', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/');
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /cadastros/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /agendamentos/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /manutenção/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /checklists/i })).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — acessa Cadastros (veículos) sem redirect', async ({ page }) => {
    const r = rec('03');
    try {
      await page.goto('/cadastros/veiculos');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/cadastros/veiculos', { timeout: 15000 });
      await expect(page.locator('main').getByRole('heading', { name: /veículos/i })).toBeVisible({ timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — vê ação de criar em Veículos', async ({ page }) => {
    const r = rec('04');
    try {
      await page.goto('/cadastros/veiculos');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/cadastros/veiculos', { timeout: 15000 });
      // Director ∈ ROLES_CAN_CREATE
      await expect(page.getByRole('button', { name: /adicionar veículo/i })).toBeVisible({ timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('05 — vê ação de excluir', async ({ page }) => {
    const r = rec('05');
    try {
      await page.goto('/cadastros/veiculos');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/cadastros/veiculos', { timeout: 15000 });

      // Skip se não houver veículos (linha de estado vazio aparece na tabela)
      if (await page.getByText(/nenhum ve[ií]culo cadastrado/i).isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip(true, 'sem dados para validar exclusão');
        return;
      }
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 10000 });
      // Director ∈ ROLES_CAN_DELETE — botão com rótulo acessível "Delete" (sr-only)
      await expect(firstRow.getByRole('button', { name: /delete/i })).toBeVisible({ timeout: 10000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('06 — acessa Manutenção', async ({ page }) => {
    const r = rec('06');
    try {
      await page.goto('/manutencao');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/manutencao', { timeout: 15000 });
      // Director ∈ ROLES_CAN_APPROVE_BUDGET — acesso garantido
      await expect(page.locator('main').getByRole('heading', { name: /manutenção/i })).toBeVisible({ timeout: 15000 });

      // Controle de aprovação só é validável com OS pendente; caso contrário, skip.
      const approveControl = page.locator('main').getByRole('button', { name: /aprovar/i });
      if (!(await approveControl.first().isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, 'sem OS pendente para validar aprovação');
        return;
      }
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
