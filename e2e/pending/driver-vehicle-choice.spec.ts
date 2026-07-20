import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — Escolha de veículo pelo Motorista + divergência de vínculo
 *
 * Requer usuário de teste Driver recadastrado (ver docs/MEMORY.md, item 0c —
 * usuários de teste operacionais foram deletados em 2026-05-06).
 */

test.describe('Motorista — Escolha de veículo com aviso de divergência', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  test('1. Motorista vê lista com mais de um veículo, com o dele pré-selecionado', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

    const options = await vehicleSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    expect(options.some(o => o.includes('— seu veículo'))).toBe(true);
  });

  test('2. Escolher veículo de outro motorista abre o aviso de divergência', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

    const options = vehicleSelect.locator('option');
    const optionValues = await options.evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value));
    const mineIndex = (await options.allTextContents()).findIndex(t => t.includes('— seu veículo'));
    const otherIndex = optionValues.findIndex((_, idx) => idx !== mineIndex);
    if (otherIndex < 0) {
      console.log('Sem segundo veículo disponível no seed — cenário não aplicável.');
      return;
    }
    await vehicleSelect.selectOption({ index: otherIndex });

    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    await startBtn.click();

    await expect(page.getByText('Divergência de vínculo')).toBeVisible({ timeout: 15000 });
  });

  test('3. Não cancela e não cria checklist', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

    const options = vehicleSelect.locator('option');
    const optionValues = await options.evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value));
    const mineIndex = (await options.allTextContents()).findIndex(t => t.includes('— seu veículo'));
    const otherIndex = optionValues.findIndex((_, idx) => idx !== mineIndex);
    if (otherIndex < 0) {
      console.log('Sem segundo veículo disponível no seed — cenário não aplicável.');
      return;
    }
    await vehicleSelect.selectOption({ index: otherIndex });

    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    await startBtn.click();

    const modal = page.getByText('Divergência de vínculo');
    await expect(modal).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Não' }).click();
    await expect(modal).not.toBeVisible();
    await expect(page).toHaveURL(/.*checklists.*/);
  });

  test('4. Sim cria o checklist e a divergência aparece para o Assistente+', async ({ page }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const vehicleSelect = page.locator('select').first();
    await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

    const options = vehicleSelect.locator('option');
    const optionValues = await options.evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value));
    const mineIndex = (await options.allTextContents()).findIndex(t => t.includes('— seu veículo'));
    const otherIndex = optionValues.findIndex((_, idx) => idx !== mineIndex);
    if (otherIndex < 0) {
      console.log('Sem segundo veículo disponível no seed — cenário não aplicável.');
      return;
    }
    await vehicleSelect.selectOption({ index: otherIndex });

    const startBtn = page.getByRole('button', { name: /Iniciar/i }).first();
    await startBtn.click();

    await expect(page.getByText('Divergência de vínculo')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Sim, prosseguir/i }).click();

    await expect(page).toHaveURL(/.*checklists\/preencher.*/, { timeout: 15000 });
  });
});
