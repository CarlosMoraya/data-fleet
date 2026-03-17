import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3000';

// Test fixtures for different user profiles
const users = {
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
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'alexandre@gmail.com',
    password: process.env.TEST_MANAGER_PASSWORD || '123456',
    name: 'Alexandre',
  },
};

test.describe.serial('Embarcadores + Unidades Operacionais - Full Workflow', () => {
  // Store IDs for later reference
  const testData = {
    shipper1: { id: '', name: 'Transportadora A' },
    shipper2: { id: '', name: 'Transportadora B' },
    unit1: { id: '', name: 'Base São Paulo' },
    unit2: { id: '', name: 'Base Rio de Janeiro' },
    unit3: { id: '', name: 'Base Brasília' },
  };

  test('Fleet Assistant: Login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', users.fleetAssistant.email);
    await page.fill('input[type="password"]', users.fleetAssistant.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL(`${BASE_URL}/`);
    expect(page.url()).toContain(BASE_URL);
  });

  test('Fleet Assistant: Navigate to Embarcadores', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await expect(page.getByRole('heading', { name: 'Embarcadores' })).toBeVisible();
  });

  test('Fleet Assistant: Create Transportadora A', async ({ page }) => {
    // Ensure page is loaded
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click "Adicionar Embarcador"
    await page.getByRole('button', { name: 'Adicionar Embarcador' }).click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]');

    // Fill form
    await page.fill('input[name="name"]', testData.shipper1.name);
    await page.fill('input[name="cnpj"]', '12345678901234');
    await page.fill('input[name="phone"]', '1133334444');
    await page.fill('input[name="email"]', 'transportadora-a@example.com');
    await page.fill('input[name="contactPerson"]', 'João Silva');
    await page.fill('textarea[name="notes"]', 'Transportadora de cargas gerais');

    // Submit
    await page.getByRole('button', { name: 'Cadastrar Embarcador' }).click();

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify in table
    await expect(page.getByText('Transportadora A')).toBeVisible();
  });

  test('Fleet Assistant: Create Transportadora B', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Adicionar Embarcador' }).click();
    await page.waitForSelector('[role="dialog"]');

    await page.fill('input[name="name"]', testData.shipper2.name);
    await page.fill('input[name="cnpj"]', '98765432109876');
    await page.fill('input[name="phone"]', '1144445555');
    await page.fill('input[name="email"]', 'transportadora-b@example.com');

    await page.getByRole('button', { name: 'Cadastrar Embarcador' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Transportadora B')).toBeVisible();
  });

  test('Fleet Analyst: Login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', users.fleetAnalyst.email);
    await page.fill('input[type="password"]', users.fleetAnalyst.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL(`${BASE_URL}/`);
  });

  test('Fleet Analyst: Navigate to Unidades Operacionais', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await expect(page.getByRole('heading', { name: 'Unidades Operacionais' })).toBeVisible();
  });

  test('Fleet Analyst: Create Base São Paulo', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Adicionar Unidade' }).click();
    await page.waitForSelector('[role="dialog"]');

    // Select Transportadora A from dropdown
    await page.selectOption('select[name="shipperId"]', { label: 'Transportadora A' });

    // Fill form
    await page.fill('input[name="name"]', testData.unit1.name);
    await page.fill('input[name="code"]', 'BASE-SP-001');
    await page.fill('input[name="city"]', 'São Paulo');
    await page.fill('input[name="state"]', 'SP');

    await page.getByRole('button', { name: 'Cadastrar Unidade' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Base São Paulo')).toBeVisible();
    await expect(page.getByText('Transportadora A')).toBeVisible();
  });

  test('Fleet Analyst: Create Base Rio de Janeiro', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Adicionar Unidade' }).click();
    await page.waitForSelector('[role="dialog"]');

    await page.selectOption('select[name="shipperId"]', { label: 'Transportadora A' });
    await page.fill('input[name="name"]', testData.unit2.name);
    await page.fill('input[name="code"]', 'BASE-RJ-001');
    await page.fill('input[name="city"]', 'Rio de Janeiro');
    await page.fill('input[name="state"]', 'RJ');

    await page.getByRole('button', { name: 'Cadastrar Unidade' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Base Rio de Janeiro')).toBeVisible();
  });

  test('Fleet Analyst: Create Base Brasília', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Adicionar Unidade' }).click();
    await page.waitForSelector('[role="dialog"]');

    await page.selectOption('select[name="shipperId"]', { label: 'Transportadora B' });
    await page.fill('input[name="name"]', testData.unit3.name);
    await page.fill('input[name="code"]', 'BASE-DF-001');
    await page.fill('input[name="city"]', 'Brasília');
    await page.fill('input[name="state"]', 'DF');

    await page.getByRole('button', { name: 'Cadastrar Unidade' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Base Brasília')).toBeVisible();
  });

  test('Fleet Analyst: Verify cascading dropdown in Vehicle Form', async ({ page }) => {
    // Navigate to Vehicles
    await page.goto(`${BASE_URL}/cadastros/veiculos`);

    // Click to add new vehicle
    await page.click('button:has-text("Adicionar Veículo")');
    await page.waitForSelector('[role="dialog"]');

    // Verify Operational Unit dropdown is disabled initially
    const unitDropdown = page.locator('select[name="operationalUnitId"]');
    expect(await unitDropdown.isDisabled()).toBe(true);

    // Select Transportadora A
    await page.selectOption('select[name="shipperId"]', { label: 'Transportadora A' });
    await page.waitForTimeout(300);

    // Now operational unit dropdown should be enabled
    expect(await unitDropdown.isDisabled()).toBe(false);

    // Verify only units from Transportadora A appear
    const options = await unitDropdown.locator('option').allTextContents();
    expect(options).toContain('Base São Paulo');
    expect(options).toContain('Base Rio de Janeiro');
    expect(options).not.toContain('Base Brasília');

    // Select Transportadora B
    await page.selectOption('select[name="shipperId"]', { label: 'Transportadora B' });
    await page.waitForTimeout(300);

    // Verify unit field is reset
    const selectedUnit = await unitDropdown.inputValue();
    expect(selectedUnit).toBe('');

    // Verify only units from Transportadora B appear
    const optionsB = await unitDropdown.locator('option').allTextContents();
    expect(optionsB).toContain('Base Brasília');
    expect(optionsB).not.toContain('Base São Paulo');

    // Close modal without saving
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('Manager: Login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', users.manager.email);
    await page.fill('input[type="password"]', users.manager.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL(`${BASE_URL}/`);
  });

  test('Manager: Try delete Transportadora A (should fail)', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await expect(page.getByRole('heading', { name: 'Embarcadores' })).toBeVisible();

    // Find Transportadora A row and look for delete button
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const cell = rows.nth(i).locator('td').first();
      const text = await cell.textContent();
      if (text?.includes('Transportadora A')) {
        const deleteBtn = rows.nth(i).locator('button[aria-label="Excluir"]');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          // Confirm delete in modal
          const confirmBtn = page.getByRole('button', { name: 'Confirmar' });
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(500);

            // Should see FK error message
            await expect(page.getByText(/unidades operacionais vinculadas/)).toBeVisible();
          }
        }
        break;
      }
    }
  });

  test('Manager: Delete Base Brasília (orphan unit)', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);

    // Find Base Brasília row
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const cell = rows.nth(i).locator('td').first();
      const text = await cell.textContent();
      if (text?.includes('Base Brasília')) {
        const deleteBtn = rows.nth(i).locator('button[aria-label="Excluir"]');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          const confirmBtn = page.locator('button:has-text("Confirmar")');
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(500);
          }
        }
        break;
      }
    }

    // Verify Base Brasília is removed
    await expect(page.getByText('Base Brasília')).not.toBeVisible();
  });

  test('Manager: Delete Transportadora B (no more linked units)', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const cell = rows.nth(i).locator('td').first();
      const text = await cell.textContent();
      if (text?.includes('Transportadora B')) {
        const deleteBtn = rows.nth(i).locator('button[aria-label="Excluir"]');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          const confirmBtn = page.locator('button:has-text("Confirmar")');
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(500);
          }
        }
        break;
      }
    }

    // Verify Transportadora B is removed
    await expect(page.getByText('Transportadora B')).not.toBeVisible();
  });

  test('Manager: Verify remaining data persists', async ({ page }) => {
    // Verify Transportadora A still exists
    await page.goto(`${BASE_URL}/cadastros/embarcadores`);
    await expect(page.getByText('Transportadora A')).toBeVisible();

    // Verify its units still exist
    await page.goto(`${BASE_URL}/cadastros/unidades-operacionais`);
    await expect(page.getByText('Base São Paulo')).toBeVisible();
    await expect(page.getByText('Base Rio de Janeiro')).toBeVisible();
    await expect(page.getByText('Transportadora A')).toBeVisible();
  });
});
