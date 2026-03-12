import { test, expect } from '@playwright/test';
import path from 'path';

const ASSETS_PATH = path.resolve('e2e/assets');

const DRIVERS_TO_SEED = [
  {
    name: 'JOSE SILVA',
    cpf: '777' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
    category: 'AE',
    renach: 'SP123456789',
    registration: '987654321',
    issueDate: '2020-01-15',
    expirationDate: '2030-01-15',
    grExpiration: '2025-12-31'
  },
  {
    name: 'MARIA OLIVEIRA',
    cpf: '22233344455',
    category: 'B',
    renach: 'RJ987654321',
    registration: '123456789',
    issueDate: '2022-05-20',
    expirationDate: '2032-05-20',
    grExpiration: '2026-06-30'
  },
  {
    name: 'CARLOS SOUZA',
    cpf: '33344455566',
    category: 'AD',
    renach: 'MG555444333',
    registration: '444555666',
    issueDate: '2021-11-10',
    expirationDate: '2031-11-10',
    grExpiration: '2025-01-01'
  }
];

test.describe('Seeding: Massa de Dados de Motoristas', () => {
  
  test('Configurar e Cadastrar', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`));
    
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 15000 });
    const rowsCount = await page.locator('tbody tr').count();
    console.log(`Table has ${rowsCount} rows at start.`);
    if (rowsCount > 0) {
      const text = await page.locator('tbody').innerText();
      console.log(`Table content: ${text}`);
    }

    // 1. Configurações
    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Configurações' })).toBeVisible();

    const driverCard = page.locator('div.bg-white', { has: page.locator('h2', { hasText: 'Campos Obrigatórios do Motorista' }) });
    
    // Tornar tudo opcional para o seed ser fácil
    const toggles = driverCard.locator('button[role="switch"]');
    const count = await toggles.count();
    for (let i = 0; i < count; i++) {
      const toggle = toggles.nth(i);
      const isMandatory = await toggle.evaluate(el => el.getAttribute('aria-checked') === 'true');
      if (isMandatory) {
        await toggle.click();
        await page.waitForTimeout(100);
      }
    }

    await driverCard.locator('button:has-text("Salvar")').click();
    await expect(page.getByText('Configurações de motoristas salvas com sucesso')).toBeVisible({ timeout: 10000 });

    // 2. Cadastro
    await page.goto('/drivers');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible();

    for (const d of DRIVERS_TO_SEED) {
      // Buscar pelo CPF para ver se já existe (independente do nome)
      await page.fill('input[placeholder="Buscar por nome ou CPF..."]', d.cpf);
      await page.waitForTimeout(500);
      
      const exists = await page.locator('table').getByText(d.cpf).isVisible();
      if (exists) {
        console.log(`Skipping ${d.name} (CPF ${d.cpf}), already exists.`);
        await page.fill('input[placeholder="Buscar por nome ou CPF..."]', ''); // Clear search
        continue;
      }
      await page.fill('input[placeholder="Buscar por nome ou CPF..."]', ''); // Clear search

      await page.click('button:has-text("Adicionar Motorista")');
      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible();
      
      await modal.locator('input[name="name"]').fill(d.name);
      await modal.locator('input[name="cpf"]').fill(d.cpf);
      await modal.locator('input[name="issueDate"]').fill(d.issueDate);
      await modal.locator('input[name="expirationDate"]').fill(d.expirationDate);
      await modal.locator('input[name="registrationNumber"]').fill(d.registration);
      await modal.locator('input[name="category"]').fill(d.category);
      await modal.locator('input[name="renach"]').fill(d.renach);

      const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
      await modal.locator('input[name="cnhUpload"]').setInputFiles(pdfPath);
      
      const fileInputs = modal.locator('input[type="file"]');
      await fileInputs.nth(1).setInputFiles(pdfPath); // GR
      await modal.locator('input[name="grExpirationDate"]').fill(d.grExpiration);

      console.log(`Saving driver ${d.name}...`);
      await modal.locator('button:has-text("Salvar Motorista")').click();
      
      await expect(modal).not.toBeVisible({ timeout: 20000 }).catch(async () => {
         const errorText = await modal.locator('.text-red-700').textContent().catch(() => null);
         console.log(`ERROR for ${d.name}: ${errorText}`);
         throw new Error(`Failed to save driver ${d.name}: ${errorText}`);
      });
      
      await expect(page.locator('table').getByText(d.name)).toBeVisible({ timeout: 10000 });
      console.log(`Driver ${d.name} saved successfully.`);
    }
  });
});
