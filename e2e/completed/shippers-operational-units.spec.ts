import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Test fixtures for different user profiles
const users = {
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'alexandre@gmail.com',
    password: process.env.TEST_MANAGER_PASSWORD || '123456',
    name: 'Alexandre',
  },
  fleetAssistant: {
    email: process.env.TEST_ASSISTANT_EMAIL || 'pedro@gmail.com',
    password: process.env.TEST_ASSISTANT_PASSWORD || '123456',
    name: 'Pedro',
  },
  fleetAnalyst: {
    email: process.env.TEST_ANALYST_EMAIL || 'mariana@gmail.com',
    password: process.env.TEST_ANALYST_PASSWORD || '123456',
    name: 'Mariana',
  },
};

test.describe.serial('Embarcadores + Unidades Operacionais - Full Workflow', () => {
  // Use dynamic suffix to avoid duplicate errors in persistent DB
  const suffix = Math.floor(Math.random() * 10000);
  const testData = {
    shipper1: { name: `Transp A ${suffix}`, cnpj: String(suffix).padStart(14, '0') },
    shipper2: { name: `Transp B ${suffix}`, cnpj: String(suffix + 50000).padStart(14, '0') },
    unit1:    { name: `SP Unit ${suffix}`, code: `SP${suffix}` },
    unit3:    { name: `BR Unit ${suffix}`, code: `BR${suffix}` },
  };

  test.beforeEach(async ({ page }) => {
    // Auto-accept confirmation dialogs
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else if (dialog.type() === 'alert') {
        await dialog.accept();
      }
    });
  });

  test('Manager: Login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', users.manager.email);
    await page.fill('input[type="password"]', users.manager.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL(`${BASE_URL}/`);
  });

  test('Manager: Create Shippers', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await page.waitForLoadState('networkidle');

    // Create Shipper A
    await page.getByRole('button', { name: 'Adicionar Embarcador' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8000 });
    await page.fill('input[name="name"]', testData.shipper1.name);
    await page.fill('input[name="cnpj"]', testData.shipper1.cnpj);
    await page.getByRole('button', { name: 'Cadastrar Embarcador' }).click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: testData.shipper1.name }).first()).toBeVisible({ timeout: 10000 });

    // Create Shipper B
    await page.getByRole('button', { name: 'Adicionar Embarcador' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8000 });
    await page.fill('input[name="name"]', testData.shipper2.name);
    await page.fill('input[name="cnpj"]', testData.shipper2.cnpj);
    await page.getByRole('button', { name: 'Cadastrar Embarcador' }).click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: testData.shipper2.name }).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('cell', { name: testData.shipper1.name }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: testData.shipper2.name }).first()).toBeVisible();
  });

  test('Manager: Create Operational Units', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await page.waitForLoadState('networkidle');

    // Create Unit for Shipper A
    await page.getByRole('button', { name: 'Adicionar Unidade' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8000 });
    await page.waitForSelector(`select[name="shipperId"] option:has-text("${testData.shipper1.name}")`, { state: 'attached' });
    await page.selectOption('select[name="shipperId"]', { label: testData.shipper1.name });
    await page.fill('input[name="name"]', testData.unit1.name);
    await page.fill('input[name="code"]', testData.unit1.code);
    await page.getByRole('button', { name: 'Cadastrar Unidade' }).click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: testData.unit1.name }).first()).toBeVisible({ timeout: 10000 });

    // Create Unit for Shipper B
    await page.getByRole('button', { name: 'Adicionar Unidade' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8000 });
    await page.waitForSelector(`select[name="shipperId"] option:has-text("${testData.shipper2.name}")`, { state: 'attached' });
    await page.selectOption('select[name="shipperId"]', { label: testData.shipper2.name });
    await page.fill('input[name="name"]', testData.unit3.name);
    await page.fill('input[name="code"]', testData.unit3.code);
    await page.getByRole('button', { name: 'Cadastrar Unidade' }).click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: testData.unit3.name }).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('cell', { name: testData.unit1.name }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: testData.unit3.name }).first()).toBeVisible();
  });

  test('Manager: Verify cascading dropdown in Vehicle Form', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/veiculos`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Adicionar Veículo' }).first().click();
    const modal = page.locator('[role="dialog"]');
    await modal.waitFor();

    // Select Shipper A
    await page.waitForSelector(`select[name="shipperId"] option:has-text("${testData.shipper1.name}")`, { state: 'attached' });
    await page.selectOption('select[name="shipperId"]', { label: testData.shipper1.name });

    // Wait for unit dropdown to populate
    await page.waitForSelector(`select[name="operationalUnitId"] option:has-text("${testData.unit1.name}")`, { state: 'attached' });
    const unitDropdown = page.locator('select[name="operationalUnitId"]');
    const optionsA = await unitDropdown.locator('option').allTextContents();
    expect(optionsA).toContain(testData.unit1.name);
    expect(optionsA).not.toContain(testData.unit3.name);

    // Select Shipper B
    await page.selectOption('select[name="shipperId"]', { label: testData.shipper2.name });
    await page.waitForSelector(`select[name="operationalUnitId"] option:has-text("${testData.unit3.name}")`, { state: 'attached' });
    const optionsB = await unitDropdown.locator('option').allTextContents();
    expect(optionsB).toContain(testData.unit3.name);
    expect(optionsB).not.toContain(testData.unit1.name);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
  });

  test('Manager: Cleanup', async ({ page }) => {
    // Delete Units first (FK constraint: units must be removed before shippers)
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await page.waitForLoadState('networkidle');
    for (const unit of [testData.unit1.name, testData.unit3.name]) {
      const row = page.locator('tr', { hasText: unit }).first();
      const deleteBtn = row.getByRole('button', { name: /Excluir/i });
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await expect(row).toBeHidden({ timeout: 10000 });
      }
    }

    // Delete Shippers
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await page.waitForLoadState('networkidle');
    for (const shipper of [testData.shipper1.name, testData.shipper2.name]) {
      const row = page.locator('tr', { hasText: shipper }).first();
      const deleteBtn = row.getByRole('button', { name: /Excluir/i });
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await expect(row).toBeHidden({ timeout: 10000 });
      }
    }
  });
});
