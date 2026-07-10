import { expect, test, type Browser, type Page } from '@playwright/test';

// ══════════════════════════════════════════════════════════════════════════════
// Financeiro — redirecionamento pós-login (regressão do bug da tela branca)
// (IMPLEMENTATION_FIXBUG.md — Testes novos a escrever)
//
// PRÉ-CONDIÇÃO: não há usuário de teste "Financeiro" cadastrado em .env.local
// (TEST_FINANCEIRO_EMAIL / TEST_FINANCEIRO_PASSWORD ausentes). Os cenários são
// pulados (test.skip) documentando o motivo, conforme o padrão adotado nos demais
// specs que dependem de massa/credenciais que podem não existir no ambiente
// (project_test_organization). Ver docs/MEMORY.md — cargo Financeiro sem massa.
// ══════════════════════════════════════════════════════════════════════════════

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await login(page, email, password);
  return page;
}

test.describe('Financeiro — redirecionamento pós-login (regressão tela branca)', () => {
  test('Financeiro é redirecionado para /financeiro após login, sem tela em branco', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/');
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
      await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('Financeiro acessando rota não permitida é redirecionado para /financeiro (não /engate, não tela branca)', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/manutencao');
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
      await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });
});
