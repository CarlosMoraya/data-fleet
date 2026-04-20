import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'Fleet Assistant pode visualizar página /cadastros/pneus' },
  { id: '02', name: 'Fleet Assistant NÃO vê botão "Adicionar Pneus" (sem permissão de criação)' },
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
    '# Relatório E2E — Tire Management (Fleet Assistant)',
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

  fs.writeFileSync(path.join(reportDir, 'tire-management-assistant-report.md'), report, 'utf-8');
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe('Tire Management — Fleet Assistant (Pedro) — Permissões', () => {
  test.afterAll(() => {
    writeReport();
  });

  test('01 — Fleet Assistant visualiza página /cadastros/pneus', async ({ page }) => {
    const r = rec('01');
    try {
      await page.goto('/cadastros/pneus');
      await expect(page.locator('h1', { hasText: 'Gestão de Pneus' })).toBeVisible({ timeout: 15000 });
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — Fleet Assistant NÃO vê botão "Adicionar Pneus"', async ({ page }) => {
    const r = rec('02');
    try {
      await page.goto('/cadastros/pneus');
      await expect(page.locator('h1', { hasText: 'Gestão de Pneus' })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('button:has-text("Adicionar Pneus")')).not.toBeVisible();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });
});
