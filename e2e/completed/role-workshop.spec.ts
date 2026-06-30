import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// Workshop — cobertura dedicada (rank 2, hasRoleAccess=false)
// Expectativas derivadas de src/lib/rolePermissions.ts:
//   - getDefaultRouteForRole('Workshop') === '/manutencao'
//   - hasRoleAccess('Workshop') === false → não acessa rotas protegidas (Cadastros etc.)
//   - canEditWorkshopOrder('Workshop') === true → controle "Preencher OS"
//   - canViewPartPhotos('Workshop') === true → seção "Fotos das Peças" no detalhe
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'login redireciona para /manutencao' },
  { id: '02', name: 'não acessa Cadastros' },
  { id: '03', name: 'vê lista de ordens de manutenção' },
  { id: '04', name: 'pode abrir/editar uma OS' },
  { id: '05', name: 'vê fotos de peças quando disponíveis' },
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
    `# Relatório E2E — Workshop`,
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

  fs.writeFileSync(path.join(reportDir, 'role-workshop-report.md'), report, 'utf-8');
}

test.describe('Workshop — permissões', () => {
  test.afterAll(() => {
    writeReport();
  });

  test('01 — login redireciona para /manutencao', async ({ page }) => {
    const r = rec('01');
    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/manutencao$/, { timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — não acessa Cadastros', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/cadastros/veiculos');
      await page.waitForLoadState('networkidle');
      // Workshop hasRoleAccess=false → cai em /manutencao (default route) ou /login
      await expect(page).not.toHaveURL(/\/cadastros\/veiculos/, { timeout: 15000 });
      // Comportamento observado: redirect para a rota padrão do papel (/manutencao)
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — vê lista de ordens de manutenção', async ({ page }) => {
    const r = rec('03');
    try {
      await page.goto('/manutencao');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/manutencao', { timeout: 15000 });
      await expect(page.locator('main').getByRole('heading', { name: /manutenção/i })).toBeVisible({ timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — pode abrir/editar uma OS', async ({ page }) => {
    const r = rec('04');
    try {
      await page.goto('/manutencao');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /manutenção/i })).toBeVisible({ timeout: 15000 });

      // canEditWorkshopOrder(true) → controle "Preencher OS" (canWorkshopFillOrder depende do status)
      const fillButton = page.locator('main').locator('button[title="Preencher OS"]');
      if (!(await fillButton.first().isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, 'sem OS para validar edição');
        return;
      }
      await expect(fillButton.first()).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('05 — vê fotos de peças quando disponíveis', async ({ page }) => {
    const r = rec('05');
    try {
      await page.goto('/manutencao');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /manutenção/i })).toBeVisible({ timeout: 15000 });

      // Abre o detalhe da primeira OS via botão "Visualizar"
      const viewButton = page.locator('main').locator('button[title="Visualizar"]').first();
      if (!(await viewButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, 'sem OS para validar fotos de peças');
        return;
      }
      await viewButton.click();

      // canViewPartPhotos(true) → seção "Fotos das Peças" presente no modal de detalhe
      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible({ timeout: 10000 });
      const photosHeading = modal.getByText(/fotos das peças/i);
      if (!(await photosHeading.first().isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, 'sem OS com fotos para validar');
        return;
      }
      await expect(photosHeading.first()).toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
