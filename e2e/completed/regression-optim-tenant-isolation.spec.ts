import { expect, test, type Locator, type Page } from '@playwright/test';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

const TENANT_A = 'Deluna Transportes';
const TENANT_B = 'BetaFleet';

async function switchTenant(page: Page, tenantName: string) {
  const select = page.locator('header select').first();
  await expect(select, 'tenant de teste ausente — rode `node scripts/seed-e2e.mjs` e confirme dados em Deluna/BetaFleet').toContainText(tenantName);
  await select.selectOption({ label: tenantName });
  const expectedValue = await select.locator('option').evaluateAll((options, label) => {
    const match = options.find((option) => option.textContent?.trim() === label);
    return match?.getAttribute('value') ?? '';
  }, tenantName);
  await expect(select).toHaveValue(expectedValue);
  await expect(page.locator('header')).toContainText(tenantName, { timeout: 15000 });
}

async function collectVisiblePlates(page: Page): Promise<string[]> {
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  const texts = await rows.allTextContents();
  const plates = new Set<string>();

  for (const text of texts) {
    const matches = text.match(/[A-Z]{3}-?\d{4}|[A-Z]{3}\d[A-Z0-9]\d{2}/g) ?? [];
    matches.forEach((plate) => plates.add(plate));
  }

  return [...plates];
}

test.describe('Regressão pós-otimização — isolamento entre tenants', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/');
    const select = page.locator('header select').first();
    if (await select.isVisible()) {
      await switchTenant(page, TENANT_A);
    }
  });

  test('Veículos: dados de um tenant não aparecem após troca de cliente', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await switchTenant(page, TENANT_A);
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

    const tenantAPlates = await collectVisiblePlates(page);
    expect(tenantAPlates.length, 'Deluna Transportes precisa ter placas visíveis para validar isolamento').toBeGreaterThan(0);

    await switchTenant(page, TENANT_B);
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

    for (const plate of tenantAPlates) {
      await expect(page.locator('main').getByText(plate, { exact: false })).toHaveCount(0);
    }
  });

  test('Dashboard: troca de tenant re-renderiza sem dados do tenant anterior', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await switchTenant(page, TENANT_A);
    await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

    const tenantAPlates = await collectVisiblePlates(page);
    expect(tenantAPlates.length, 'Deluna Transportes precisa ter placas visíveis para validar isolamento').toBeGreaterThan(0);

    await page.goto('/');
    await expect(mainHeading(page, 'Dashboard')).toBeVisible({ timeout: 15000 });
    const tenantADashboardText = await page.locator('main').innerText();
    expect(tenantADashboardText.length).toBeGreaterThan(0);

    await switchTenant(page, TENANT_B);
    await expect(mainHeading(page, 'Dashboard')).toBeVisible({ timeout: 15000 });

    for (const plate of tenantAPlates) {
      await expect(page.locator('main').getByText(plate, { exact: false })).toHaveCount(0);
    }
  });
});
