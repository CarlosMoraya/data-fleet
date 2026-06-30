import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// Operations Manager — cobertura dedicada (rank 5, escopo somente leitura)
// Expectativas derivadas de src/lib/rolePermissions.ts:
//   - getDefaultRouteForRole('Operations Manager') === '/agendamentos'
//   - OPERATIONS_MANAGER_ALLOWED_ROUTES = ['/agendamentos', '/manutencao', '/conta/senha']
//   - canAccessRoute retorna false para rotas fora do escopo → redirect p/ /agendamentos
//   - papel read-only (sem canCreate/canEdit/canDelete/canWriteMaintenance)
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'login redireciona para /agendamentos' },
  { id: '02', name: 'sidebar só com Agendamentos e Manutenção' },
  { id: '03', name: 'rota proibida /cadastros/usuarios redireciona para /agendamentos' },
  { id: '04', name: 'rota proibida /checklists redireciona para /agendamentos' },
  { id: '05', name: 'rota proibida /settings redireciona para /agendamentos' },
  { id: '06', name: 'Agendamentos é somente leitura' },
  { id: '07', name: 'Manutenção é somente leitura' },
];

const recorded = new Map<string, { status: '✅ PASSOU' | '❌ FALHOU'; error: string }>();

function rec(id: string) {
  return {
    pass() {
      recorded.set(id, { status: '✅ PASSOU', error: '—' });
    },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
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
    `# Relatório E2E — Operations Manager`,
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

  fs.writeFileSync(path.join(reportDir, 'role-operations-manager-report.md'), report, 'utf-8');
}

test.describe('Operations Manager — escopo somente leitura', () => {
  test.afterAll(() => {
    writeReport();
  });

  test('01 — login redireciona para /agendamentos', async ({ page }) => {
    const r = rec('01');
    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/agendamentos$/, { timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — sidebar só com Agendamentos e Manutenção', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/agendamentos');
      await page.waitForLoadState('networkidle');
      const nav = page.locator('nav');
      // Presentes
      await expect(nav.getByRole('link', { name: /agendamentos/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /manutenção/i })).toBeVisible();
      // Ausentes
      await expect(nav.getByRole('link', { name: /cadastros/i })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: /checklists/i })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: /configurações/i })).toHaveCount(0);
      // Link de Usuários (admin) ausente
      await expect(page.locator('a[href="/cadastros/usuarios"]')).toHaveCount(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — rota proibida /cadastros/usuarios redireciona para /agendamentos', async ({ page }) => {
    const r = rec('03');
    try {
      await page.goto('/cadastros/usuarios');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/agendamentos$/, { timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — rota proibida /checklists redireciona para /agendamentos', async ({ page }) => {
    const r = rec('04');
    try {
      await page.goto('/checklists');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/agendamentos$/, { timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('05 — rota proibida /settings redireciona para /agendamentos', async ({ page }) => {
    const r = rec('05');
    try {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/agendamentos$/, { timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('06 — Agendamentos é somente leitura', async ({ page }) => {
    const r = rec('06');
    try {
      await page.goto('/agendamentos');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /agendamentos/i })).toBeVisible({ timeout: 15000 });
      // Ausência de controles de mutação
      await expect(page.locator('main').getByRole('button', { name: /editar/i })).toHaveCount(0);
      await expect(page.locator('main').getByRole('button', { name: /excluir/i })).toHaveCount(0);
      await expect(page.locator('main').locator('button[title="Gerar OS de Manutenção"]')).toHaveCount(0);
      await expect(page.locator('main').getByRole('button', { name: /novo|criar|adicionar/i })).toHaveCount(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('07 — Manutenção é somente leitura', async ({ page }) => {
    const r = rec('07');
    try {
      await page.goto('/manutencao');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /manutenção/i })).toBeVisible({ timeout: 15000 });
      // Ausência de controles de mutação
      await expect(page.locator('main').getByRole('button', { name: /nova manutenção/i })).toHaveCount(0);
      await expect(page.locator('main').locator('button[title="Editar"]')).toHaveCount(0);
      await expect(page.locator('main').locator('button[title="Cancelar OS"]')).toHaveCount(0);
      await expect(page.locator('main').getByRole('button', { name: /aprovar/i })).toHaveCount(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
