import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// Regressão visual — golden master (toHaveScreenshot)
// Projeto dedicado `visual` (e2e/visual/), fora da suíte padrão.
// Baselines versionadas em e2e/visual/visual-regression.spec.ts-snapshots/.
// Regenerar: npm run test:e2e:visual:update
//
// Nota: a tela de login usa storageState anônimo (test.use) distinto das telas
// autenticadas (admin.json). Resultados persistidos via sidecar JSON para
// garantir relatório consolidado (mesma abordagem do spec a11y). Padrão §6.3.
//
// Baselines geradas em Linux — podem exigir regeneração em outro SO.
// ══════════════════════════════════════════════════════════════════════════════

const REPORT_NAME = 'visual-regression';
const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'login.png' },
  { id: '02', name: 'dashboard.png' },
  { id: '03', name: 'checklist-fill.png' },
];

interface StoredResult {
  status: '✅ PASSOU' | '❌ FALHOU';
  error: string;
}

function sidecarPath() {
  return path.join(process.cwd(), '.claude', 'reports', `${REPORT_NAME}.json`);
}

function loadStored(): Record<string, StoredResult> {
  const p = sidecarPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, StoredResult>;
    } catch {
      return {};
    }
  }
  return {};
}

function persistResult(id: string, result: StoredResult) {
  const dir = path.join(process.cwd(), '.claude', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stored = loadStored();
  stored[id] = { ...(stored[id] ?? {}), ...result };
  fs.writeFileSync(sidecarPath(), JSON.stringify(stored), 'utf-8');
}

function rec(id: string) {
  return {
    pass() {
      persistResult(id, { status: '✅ PASSOU', error: '—' });
    },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
      if (msg.includes('Test is skipped')) throw e;
      persistResult(id, { status: '❌ FALHOU', error: msg });
      throw e;
    },
  };
}

function writeReport() {
  const reportDir = path.join(process.cwd(), '.claude', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const stored = loadStored();
  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const rows = ALL_TESTS.map((t) => {
    const r = stored[t.id];
    if (!r) return `| ${t.id} | ${t.name} | ⏭️ PULADO | — |`;
    return `| ${t.id} | ${t.name} | ${r.status} | ${r.error} |`;
  }).join('\n');

  const bugs = ALL_TESTS.filter((t) => stored[t.id]?.status === '❌ FALHOU');
  const passed = Object.values(stored).filter((r) => r.status === '✅ PASSOU').length;
  const failed = bugs.length;
  const skipped = ALL_TESTS.length - Object.keys(stored).length;

  const bugsSection = bugs.length === 0
    ? '_Nenhuma regressão visual detectada._'
    : bugs.map((t) => `- **Teste ${t.id} — ${t.name}**: ${stored[t.id]!.error}`).join('\n');

  const report = [
    `# Relatório E2E — Regressão Visual`,
    `Data: ${date}`,
    '',
    `**Resumo:** ${passed} passaram · ${failed} falharam · ${skipped} pulados`,
    '',
    '**Baselines:** geradas em Linux. Regenerar em outro SO via `npm run test:e2e:visual:update`.',
    '',
    '## Resultados',
    '',
    '| # | Tela | Status | Erro |',
    '|---|------|--------|------|',
    rows,
    '',
    '## Regressões Detectadas',
    '',
    bugsSection,
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, `${REPORT_NAME}-report.md`), report, 'utf-8');
}

test.describe('Regressão visual — telas críticas', () => {
  test.afterAll(() => {
    writeReport();
  });

  test.describe('Login (anônimo)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('01 — login.png', async ({ page }) => {
      const r = rec('01');
      try {
        await page.goto('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
        await expect(page).toHaveScreenshot('login.png', {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        });
        r.pass();
      } catch (e) {
        r.fail(e);
      }
    });
  });

  test('02 — dashboard.png', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/');
      await expect(page.locator('main').getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });
      // Mascara regiões voláteis: gráficos (recharts) e datas/valores dinâmicos
      const mask = [
        page.locator('.recharts-wrapper'),
        page.locator('time'),
      ];
      await expect(page).toHaveScreenshot('dashboard.png', {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
        mask,
      });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — checklist-fill.png', async ({ page }) => {
    const r = rec('03');
    try {
      await page.goto('/checklists');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /checklists/i })).toBeVisible({ timeout: 15000 });

      // Abrir um checklist concluído (botão com ícone Eye) para visualizar o detalhe.
      // A lista vem ordenada por `started_at` decrescente, então o PRIMEIRO botão
      // é o checklist mais recente — âncora instável: qualquer checklist novo
      // preenchido no ambiente trocava o registro fotografado. Usamos o ÚLTIMO
      // botão (o checklist mais antigo), que não muda conforme a massa cresce.
      const viewButtons = page.locator('main').locator('button:has(svg.lucide-eye)');
      if ((await viewButtons.count()) === 0) {
        test.skip(true, 'sem checklist disponível para validar tela de preenchimento');
        return;
      }
      const viewButton = viewButtons.last();
      await viewButton.click();
      const overlay = page.locator('.fixed.inset-0');
      await expect(overlay).toBeVisible({ timeout: 10000 });

      // As respostas são carregadas depois que o modal abre; sem esperar, o
      // golden master fotografava "Carregando..." de forma intermitente.
      await expect(overlay.getByText('Carregando...')).toHaveCount(0, { timeout: 15000 });

      // Fotografa o painel do modal, não a página nem o overlay de tela cheia:
      // o fundo é a tabela de histórico, que cresce a cada checklist preenchido
      // e tornava o golden master instável por deriva de massa, sem nenhuma
      // regressão visual real.
      const modalPanel = overlay.locator('> div').first();
      await expect(modalPanel).toHaveScreenshot('checklist-fill.png', {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
