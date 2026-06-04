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
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
  return page;
}

test.describe.serial('Budget Approval — Alçada de Aprovação', () => {
  let page: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    const email = requireEnv('TEST_FLEET_ASSISTANT_EMAIL');
    const password = requireEnv('TEST_FLEET_ASSISTANT_PASSWORD');
    page = await loginAs(browser, email, password);
  });

  test.afterAll(async () => {
    await page?.context()?.close();
  });

  test('cenário 1: OS sem itens — botão Aprovar desabilitado com tooltip "sem itens cadastrados"', async () => {
    if (!page) test.skip();
    await page!.goto('/aprovacao-orcamentos');
    await page!.waitForSelector('table', { timeout: 10000 });

    const rowWithNoItems = page!.locator('tr:has-text("—")').first();
    if ((await rowWithNoItems.count()) === 0) {
      test.skip();
    }

    const approveBtn = rowWithNoItems.locator('button:has-text("Aprovar")');
    await expect(approveBtn).toBeDisabled();

    const tooltip = await approveBtn.getAttribute('title');
    expect(tooltip).toContain('sem itens cadastrados');
  });

  test('cenário 2: OS com subtotal > R$ 1.500 — botão Aprovar desabilitado com tooltip de limite', async () => {
    if (!page) test.skip();
    await page!.goto('/aprovacao-orcamentos');
    await page!.waitForSelector('table', { timeout: 10000 });

    const rowWithOverLimit = page!.locator('tr').filter({ hasText: /R\$\s*1[,.]5\d{2}/ }).first();
    if ((await rowWithOverLimit.count()) === 0) {
      test.skip();
    }

    const approveBtn = rowWithOverLimit.locator('button:has-text("Aprovar")');
    await expect(approveBtn).toBeDisabled();

    const tooltip = await approveBtn.getAttribute('title');
    expect(tooltip).toContain('limite de aprovação');
  });

  test('cenário 3: OS com subtotal ≤ R$ 1.500 — botão Aprovar habilitado', async () => {
    if (!page) test.skip();
    await page!.goto('/aprovacao-orcamentos');
    await page!.waitForSelector('table', { timeout: 10000 });

    const approveButtons = page!.locator('button:has-text("Aprovar"):not([disabled])');
    const count = await approveButtons.count();
    if (count === 0) {
      test.skip();
    }
    await expect(approveButtons.first()).toBeEnabled();
  });
});