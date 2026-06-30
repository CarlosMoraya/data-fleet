import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// Acessibilidade — smoke com axe-core (WCAG 2 A/AA)
// Gate: critical + serious => reprova. moderate/minor apenas reportados.
// Telas autenticadas usam Admin Master (admin.json, via projeto chromium).
// Login em contexto anônimo (test.use dentro do sub-describe).
//
// Nota: como a tela de login usa storageState distinto (anônimo) das telas
// autenticadas (admin.json), o módulo é re-importado por grupo de fixtures.
// Por isso os resultados são persistidos num sidecar JSON a cada teste, e o
// writeReport agrega todos os resultados do sidecar — garantindo relatório
// consolidado independentemente da ordem/isolamento. Mantém o padrão §6.3.
// ══════════════════════════════════════════════════════════════════════════════

interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  helpUrl?: string;
  help?: string;
  nodes: { target: (string | string[])[]; html: string }[];
}

async function runAxe(page: Page): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  return results.violations as AxeViolation[];
}

function filterBlocking(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return '_Nenhuma violação._';
  return violations
    .map((v) => {
      const firstTarget = v.nodes[0]?.target?.[0];
      const selector = Array.isArray(firstTarget) ? firstTarget.join(' ') : String(firstTarget ?? '—');
      return `- **${v.id}** (impacto: ${v.impact}) — ${v.description}. Seletor do 1º nó: \`${selector}\`. Ajuda: ${v.helpUrl ?? v.help ?? '—'}`;
    })
    .join('\n');
}

// ── Relatório (padrão rec()/writeReport() — §6.3, com persistência sidecar) ───

const REPORT_NAME = 'a11y-core-screens';
const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'Login (anônimo)' },
  { id: '02', name: 'Dashboard' },
  { id: '03', name: 'Checklists' },
  { id: '04', name: 'Cadastros (Veículos)' },
];

interface StoredResult {
  status: '✅ PASSOU' | '❌ FALHOU';
  error: string;
  blocking?: AxeViolation[];
  all?: AxeViolation[];
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
  // Merge: preserva blocking/all quando r.fail atualizar apenas status/error
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
    ? '_Nenhum bug encontrado._'
    : bugs.map((t) => {
        const det = stored[t.id];
        const blocking = det?.blocking ? formatViolations(det.blocking) : '—';
        return `- **Teste ${t.id} — ${t.name}** (critical/serious):\n${blocking}`;
      }).join('\n\n');

  const allSection = ALL_TESTS.map((t) => {
    const det = stored[t.id];
    if (!det || !det.all || det.all.length === 0) return `- **${t.name}**: sem violações reportadas.`;
    return `- **${t.name}** (${det.all.length} violação(ões) no total):\n${formatViolations(det.all)}`;
  }).join('\n\n');

  const report = [
    `# Relatório E2E — Acessibilidade (axe-core)`,
    `Data: ${date}`,
    '',
    `**Resumo:** ${passed} passaram · ${failed} falharam · ${skipped} pulados`,
    '',
    '**Gate:** critical + serious => reprova. moderate/minor apenas reportados.',
    '',
    '## Resultados',
    '',
    '| # | Teste | Status | Erro |',
    '|---|-------|--------|------|',
    rows,
    '',
    '## Bugs Encontrados (critical/serious)',
    '',
    bugsSection,
    '',
    '## Todas as violações por tela (incluindo moderate/minor)',
    '',
    allSection,
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, `${REPORT_NAME}-report.md`), report, 'utf-8');
}

test.describe('Acessibilidade — telas principais (axe-core)', () => {
  test.afterAll(() => {
    writeReport();
  });

  test.describe('Login (anônimo)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('01 — Login (anônimo)', async ({ page }) => {
      const r = rec('01');
      try {
        await page.goto('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
        const violations = await runAxe(page);
        const blocking = filterBlocking(violations);
        persistResult('01', {
          status: blocking.length === 0 ? '✅ PASSOU' : '❌ FALHOU',
          error: blocking.length === 0 ? '—' : formatViolations(blocking).split('\n')[0].slice(0, 200),
          blocking,
          all: violations,
        });
        expect(blocking, formatViolations(blocking)).toEqual([]);
        r.pass();
      } catch (e) {
        r.fail(e);
      }
    });
  });

  test('02 — Dashboard', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/');
      await expect(page.locator('main').getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });
      const violations = await runAxe(page);
      const blocking = filterBlocking(violations);
      persistResult('02', {
        status: blocking.length === 0 ? '✅ PASSOU' : '❌ FALHOU',
        error: blocking.length === 0 ? '—' : formatViolations(blocking).split('\n')[0].slice(0, 200),
        blocking,
        all: violations,
      });
      expect(blocking, formatViolations(blocking)).toEqual([]);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — Checklists', async ({ page }) => {
    const r = rec('03');
    try {
      await page.goto('/checklists');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /checklists/i })).toBeVisible({ timeout: 15000 });
      const violations = await runAxe(page);
      const blocking = filterBlocking(violations);
      persistResult('03', {
        status: blocking.length === 0 ? '✅ PASSOU' : '❌ FALHOU',
        error: blocking.length === 0 ? '—' : formatViolations(blocking).split('\n')[0].slice(0, 200),
        blocking,
        all: violations,
      });
      expect(blocking, formatViolations(blocking)).toEqual([]);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — Cadastros (Veículos)', async ({ page }) => {
    const r = rec('04');
    try {
      await page.goto('/cadastros/veiculos');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByRole('heading', { name: /veículos/i })).toBeVisible({ timeout: 15000 });
      const violations = await runAxe(page);
      const blocking = filterBlocking(violations);
      persistResult('04', {
        status: blocking.length === 0 ? '✅ PASSOU' : '❌ FALHOU',
        error: blocking.length === 0 ? '—' : formatViolations(blocking).split('\n')[0].slice(0, 200),
        blocking,
        all: violations,
      });
      expect(blocking, formatViolations(blocking)).toEqual([]);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
