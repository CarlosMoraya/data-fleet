import { expect, test } from '@playwright/test';

async function loginAsOperationsManager(page: import('@playwright/test').Page) {
  const email = process.env.TEST_GESTOROP_EMAIL;
  const password = process.env.TEST_GESTOROP_PASSWORD;
  test.skip(!email || !password, 'TEST_GESTOROP_EMAIL/PASSWORD ausentes.');

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/agendamentos$/, { timeout: 15000 });
}

test.describe.serial('Operations Manager — checklist de Auditoria por escopo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperationsManager(page);
  });

  test('oferece Auditoria e não oferece Entrega nem Devolução', async ({ page }) => {
    await page.goto('/checklists');

    const contextSelect = page.locator('select').first();
    await expect(contextSelect).toBeVisible({ timeout: 15000 });
    await expect(contextSelect.locator('option', { hasText: 'Auditoria' })).toHaveCount(1);
    await expect(contextSelect.locator('option', { hasText: 'Entrega' })).toHaveCount(0);
    await expect(contextSelect.locator('option', { hasText: 'Devolução' })).toHaveCount(0);
  });

  test('lista mais de um veículo e somente placas do escopo esperado', async ({ page }) => {
    const expectedPlatesRaw = process.env.TEST_GESTOROP_EXPECTED_VEHICLE_PLATES;
    test.skip(!expectedPlatesRaw, 'TEST_GESTOROP_EXPECTED_VEHICLE_PLATES ausente.');
    const expectedPlates = expectedPlatesRaw!.split(',').map((plate) => plate.trim()).filter(Boolean).sort();

    await page.goto('/checklists');
    await page.locator('select').first().selectOption({ label: 'Auditoria' });

    const vehicleOptions = page.locator('select').nth(1).locator('option:not([value=""])');
    await expect.poll(() => vehicleOptions.count(), { timeout: 15000 }).toBeGreaterThan(0);
    const listedPlates = (await vehicleOptions.allTextContents())
      .map((label) => label.split(' (')[0].trim())
      .sort();

    expect(listedPlates.length).toBeGreaterThan(1);
    expect(listedPlates).toEqual(expectedPlates);
  });

  test('inicia um template de Auditoria e navega para o preenchimento', async ({ page }) => {
    await page.goto('/checklists');
    await page.locator('select').first().selectOption({ label: 'Auditoria' });

    const vehicleSelect = page.locator('select').nth(1);
    await expect.poll(
      () => vehicleSelect.locator('option:not([value=""])').count(),
      { timeout: 15000 },
    ).toBeGreaterThan(0);

    const startButton = page.getByRole('button', { name: 'Iniciar' }).first();
    const vehicleOptionCount = await vehicleSelect.locator('option').count();
    let foundVehicleWithTemplate = false;
    for (let index = 1; index < vehicleOptionCount; index += 1) {
      await vehicleSelect.selectOption({ index });
      try {
        await expect.poll(() => startButton.count(), { timeout: 3000 }).toBeGreaterThan(0);
        foundVehicleWithTemplate = true;
        break;
      } catch {
        // Continue until a vehicle category with a published Audit template is found.
      }
    }

    expect(foundVehicleWithTemplate).toBe(true);
    await startButton.click();

    await expect(page).toHaveURL(/\/checklists\/preencher\/[^/]+$/, { timeout: 15000 });
  });

  test('exibe no histórico uma Auditoria preenchida por outra pessoa', async ({ page }) => {
    await page.goto('/checklists');

    const userBlock = page.locator('header').getByText('Gestor de Operações', { exact: true }).locator('..');
    const currentUserName = (await userBlock.locator('span').first().innerText()).trim();
    const historyCard = page.getByRole('heading', { name: 'Histórico' }).locator('..');
    const completedEntry = historyCard.locator('span').filter({ hasText: /^Concluído$/ }).first().locator('..');

    await expect(completedEntry.getByText(/Auditoria/).first()).toBeVisible({ timeout: 15000 });
    await completedEntry.locator('button').click();

    const filledByField = page.getByText('Preenchido por', { exact: true }).first().locator('..');
    const filledByName = (await filledByField.locator('p').nth(1).innerText()).trim();
    expect(filledByName).not.toBe('—');
    expect(filledByName).not.toBe(currentUserName);
  });
});
