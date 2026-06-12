/**
 * TESTES E2E — VISIBILIDADE DE INSPEÇÕES DE PNEUS POR CARGO
 *
 * Valida que Coordinator e Director visualizam inspeções de pneus concluídas
 * por Driver do mesmo tenant na aba "Inspeções de Pneus", e que o isolamento
 * entre tenants continua funcionando.
 *
 * PRÉ-REQUISITOS:
 * - Migration 20260612000000_fix_tire_inspections_select_coordinator_director.sql aplicada.
 * - Usuários de teste Coordinator e Director cadastrados no Supabase com credenciais
 *   configuradas em TEST_COORDINATOR_EMAIL/TEST_COORDINATOR_PASSWORD e
 *   TEST_DIRECTOR_EMAIL/TEST_DIRECTOR_PASSWORD no .env.local.
 * - Pelo menos uma inspeção de pneus concluída (status='completed') por um Driver
 *   do mesmo tenant dos usuários Coordinator/Director.
 *
 * Este teste está em e2e/pending/ até que os usuários de teste sejam recadastrados
 * no Supabase e as credenciais sejam adicionadas ao .env.local.
 */

import { test, expect, Browser, Page } from '@playwright/test';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required E2E credential env: ${name}`);
  }
  return value;
}

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
  return page;
}

async function openTireInspectionsTab(page: Page) {
  await page.goto('/checklists');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Inspeções de Pneus/i }).click();
}

// ══════════════════════════════════════════════════════════════════════════════
// Cenário 1: Coordinator do mesmo tenant vê inspeções de pneus
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Coordinator vê inspeções de pneus do tenant', () => {
  let page: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    const email = requireEnv('TEST_COORDINATOR_EMAIL');
    const password = requireEnv('TEST_COORDINATOR_PASSWORD');
    page = await loginAs(browser, email, password);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('Coordinator acessa aba "Inspeções de Pneus"', async () => {
    await openTireInspectionsTab(page!);
    // A tabela de inspeções deve estar visível (não o estado vazio)
    await expect(page!.locator('table').first()).toBeVisible({ timeout: 10000 });
  });

  test('Coordinator vê inspeções concluídas na lista', async () => {
    const rows = page!.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Coordinator NÃO vê mensagem de lista vazia', async () => {
    await expect(page!.getByText(/Nenhuma inspeção de pneus registrada/i)).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Cenário 2: Director do mesmo tenant vê inspeções de pneus
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Director vê inspeções de pneus do tenant', () => {
  let page: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    const email = requireEnv('TEST_DIRECTOR_EMAIL');
    const password = requireEnv('TEST_DIRECTOR_PASSWORD');
    page = await loginAs(browser, email, password);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('Director acessa aba "Inspeções de Pneus"', async () => {
    await openTireInspectionsTab(page!);
    await expect(page!.locator('table').first()).toBeVisible({ timeout: 10000 });
  });

  test('Director vê inspeções concluídas na lista', async () => {
    const rows = page!.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Director NÃO vê mensagem de lista vazia', async () => {
    await expect(page!.getByText(/Nenhuma inspeção de pneus registrada/i)).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Cenário 3: Coordinator de outro tenant NÃO vê inspeções (regressão de isolamento)
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Coordinator de outro tenant NÃO vê inspeções', () => {
  let page: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    // Usa Admin Master (que tem client_id=null) como proxy para testar
    // que RLS continua isolando por tenant. Administrator de outro tenant
    // veria "Nenhuma inspeção...". Se não houver usuário de outro tenant
    // disponível, este bloco pode ser adaptado.
    const email = requireEnv('TEST_COORDINATOR_OTHER_TENANT_EMAIL');
    const password = requireEnv('TEST_COORDINATOR_OTHER_TENANT_PASSWORD');
    page = await loginAs(browser, email, password);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('Coordinator de outro tenant vê lista vazia', async () => {
    await openTireInspectionsTab(page!);
    // Deve ver a mensagem de lista vazia ou tabela sem linhas de inspeção
    const rows = page!.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Cenário 4: Manager e Fleet Assistant continuam vendo (regressão de não-regressão)
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Manager e Fleet Assistant continuam vendo inspeções (regressão)', () => {
  test.skip(({ browser }) => {
    // Usa Pedro (Fleet Assistant) como representante dos cargos já autorizados
    // Se Pedro não estiver disponível no storageState, o teste é pulado.
    return !process.env.TEST_FLEET_ASSISTANT_EMAIL;
  }, 'Fleet Assistant credentials not available');

  let page: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    const email = requireEnv('TEST_FLEET_ASSISTANT_EMAIL');
    const password = requireEnv('TEST_FLEET_ASSISTANT_PASSWORD');
    page = await loginAs(browser, email, password);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('Fleet Assistant vê inspeções na aba dedicada (regressão)', async () => {
    await openTireInspectionsTab(page!);
    await expect(page!.locator('table').first()).toBeVisible({ timeout: 10000 });
    const rows = page!.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});