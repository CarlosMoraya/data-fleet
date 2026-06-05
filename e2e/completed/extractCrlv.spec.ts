import { expect, test } from '@playwright/test';
import path from 'node:path';

const crlvPath = path.join(process.cwd(), 'public/downloads/CRLV_teste.pdf');

test.describe('CRLV extraction', () => {
  test.use({ storageState: 'e2e/.auth/alexandre.json' });

  test('extracts vehicle data from CRLV with old license plate format', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.getByRole('heading', { name: 'Veículos' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Adicionar Veículo' }).click();
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('heading', { name: 'Cadastrar Veículo' })).toBeVisible();

    await modal.locator('input[name="crlvUpload"]').setInputFiles(crlvPath);

    await expect(modal.locator('input[name="licensePlate"]')).toHaveValue('KRG3937', { timeout: 15000 });
    await expect(
      modal.getByText(/(?:[8-9]|1[0-1])\/12 campos extraídos via leitura direta|12 campos preenchidos automaticamente via leitura direta/)
    ).toBeVisible();
  });
});
