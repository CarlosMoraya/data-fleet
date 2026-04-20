import { test, expect } from '@playwright/test';
import path from 'path';

const ASSETS_PATH = path.resolve('e2e/assets');

test.describe('Módulo de Motoristas - Fluxo Manager', () => {
  const driverName = `TEST MANAGER ${Date.now()}`;
  const driverCPF = `999${Math.random().toString().slice(2, 10)}`;

  test('Deve criar, editar e excluir um motorista', async ({ page }) => {
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible();

    // 1. Criar
    await page.click('button:has-text("Adicionar Motorista")');
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();
    
    await modal.locator('input[name="name"]').fill(driverName);
    await modal.locator('input[name="cpf"]').fill(driverCPF);
    await modal.locator('input[name="issueDate"]').fill('2024-01-01');
    await modal.locator('input[name="expirationDate"]').fill('2034-01-01');
    await modal.locator('input[name="registrationNumber"]').fill('123456789');
    await modal.locator('input[name="category"]').fill('B');
    await modal.locator('input[name="renach"]').fill('SP999888777');

    const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
    await modal.locator('input[name="cnhUpload"]').setInputFiles(pdfPath);
    
    await modal.locator('button:has-text("Salvar Motorista")').click();
    await expect(modal).not.toBeVisible({ timeout: 20000 });
    
    // Buscar para garantir que aparece na tabela
    await page.fill('input[placeholder="Buscar por nome ou CPF..."]', driverName);
    await expect(page.locator('table').getByText(driverName)).toBeVisible();

    // 2. Editar
    // O botão de editar tem um span "Editar" dentro (sr-only)
    const row = page.locator('tr', { hasText: driverName });
    await row.locator('button:has(.sr-only:has-text("Editar"))').click();
    
    const editModal = page.locator('.fixed.inset-0');
    await expect(editModal.locator('h2', { hasText: 'Editar Motorista' })).toBeVisible();
    
    await editModal.locator('input[name="name"]').fill(`${driverName} UPDATED`);
    await editModal.locator('button:has-text("Salvar Motorista")').click();
    
    await expect(editModal).not.toBeVisible();
    await expect(page.locator('table').getByText(`${driverName} UPDATED`)).toBeVisible();

    // 3. Excluir
    page.on('dialog', dialog => dialog.accept());
    const updatedRow = page.locator('tr', { hasText: `${driverName} UPDATED` });
    await updatedRow.locator('button:has(.sr-only:has-text("Excluir"))').click();
    
    await expect(page.locator('table').getByText(`${driverName} UPDATED`)).not.toBeVisible();
  });
});
