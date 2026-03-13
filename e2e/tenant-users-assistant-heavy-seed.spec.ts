import { test, expect } from '@playwright/test';
import path from 'path';

const ASSETS_PATH = path.resolve('e2e/assets');

const VEHICLES = [
  {
    plate: 'VEC0001',
    brand: 'Fiat',
    model: 'Mobi Trekking',
    year: '2024',
    color: 'Cinza',
    type: 'Passeio',
    energy: 'Combustão',
    fuel: 'Flex',
    owner: 'Localiza Rent a Car',
    warranty: true,
    warrantyEnd: '2027-12-31',
    hasInsurance: true,
    hasMaintenance: true
  },
  {
    plate: 'VEC0002',
    brand: 'Iveco',
    model: 'Daily 30-130',
    year: '2023',
    color: 'Branco',
    type: 'Vuc',
    energy: 'Combustão',
    fuel: 'Diesel S10',
    owner: 'Frota Própria',
    warranty: true,
    warrantyEnd: '2026-06-15',
    hasInsurance: true,
    hasMaintenance: false
  },
  {
    plate: 'VEC0003',
    brand: 'Scania',
    model: 'R 450 A6x2',
    year: '2024',
    color: 'Vermelho',
    type: 'Cavalo',
    energy: 'Combustão',
    fuel: 'Diesel',
    owner: 'Transp. Rodoviário S.A.',
    hasSemi: true,
    semiPlate: 'REB5E12',
    warranty: true,
    warrantyEnd: '2028-01-01',
    hasInsurance: true,
    hasMaintenance: true
  }
];

test.describe('Seeding Heavy (Assistant): Cadastro de Veículos', () => {
  
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });
    await page.goto('/vehicles');
    await expect(page.locator('h1', { hasText: 'Vehicles' })).toBeVisible({ timeout: 15000 });
  });

  test('Cadastrar Veículos (Assistant)', async ({ page }) => {
    for (const v of VEHICLES) {
      console.log(`\n--- Cadastrando veículo: ${v.plate} ---`);
      
      await page.click('button:has-text("Add Vehicle")');
      const modal = page.locator('.fixed.inset-0').last();
      await expect(modal.locator('h2', { hasText: 'Veículo' })).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      await modal.locator('input[name="licensePlate"]').fill(v.plate);
      await modal.locator('input[name="brand"]').fill(v.brand);
      await modal.locator('input[name="model"]').fill(v.model);
      await modal.locator('input[name="year"]').fill(v.year);
      await modal.locator('input[name="color"]').fill(v.color);
      const randomRenavam = Math.floor(Math.random() * 90000000000) + 10000000000;
      await modal.locator('input[name="renavam"]').fill(randomRenavam.toString());
      await modal.locator('input[name="chassi"]').fill(`CHS${v.plate}FLT2024`.padEnd(17, '0'));
      await modal.locator('input[name="detranUF"]').fill('SP');

      await modal.locator('select[name="acquisition"]').selectOption('Owned');
      await modal.locator('input[name="acquisitionDate"]').fill('2024-01-10');
      await modal.locator('input[name="owner"]').fill(v.owner);
      await modal.locator('input[name="fipePrice"]').fill('120.000,00');
      await modal.locator('input[name="tracker"]').fill('Omnilink');
      await modal.locator('input[name="antt"]').fill('654321');
      await modal.locator('input[name="autonomy"]').fill('450');
      await modal.locator('input[name="tag"]').fill(`TAG-${v.plate}`);

      const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
      const imgPath = path.join(ASSETS_PATH, 'test-image.png');
      await modal.locator('input[name="crlvUpload"]').setInputFiles(pdfPath);

      await modal.locator('select[name="category"]').selectOption(v.type === 'Passeio' ? 'Leve' : (v.type === 'Truck' || v.type === 'Cavalo' ? 'Pesado' : 'Médio'));
      await modal.locator('label[for="spareKey"]').click();
      await modal.locator('label[for="vehicleManual"]').click();

      const fileInputs = modal.locator('input[type="file"]');
      await fileInputs.nth(1).setInputFiles(imgPath); 
      await fileInputs.nth(2).setInputFiles(pdfPath); 
      await modal.locator('input[name="grExpirationDate"]').fill('2026-12-31');

      await modal.locator('select[name="type"]').selectOption(v.type);
      await modal.locator('select[name="energySource"]').selectOption(v.energy);

      if (v.energy === 'Combustão') {
        await modal.locator('input[name="fuelType"]').fill(v.fuel || 'Diesel');
        await modal.locator('input[name="tankCapacity"]').fill('80');
        await modal.locator('input[name="avgConsumption"]').fill('8,5');
      }

      await modal.locator('input[name="pbt"]').fill('3,5');
      await modal.locator('input[name="cmt"]').fill('45,0');
      await modal.locator('input[name="eixos"]').fill('2');

      if (v.type === 'Cavalo' && (v as any).hasSemi) {
        await modal.locator('label[for="semiReboque"]').click();
        await modal.locator('input[name="placaSemiReboque"]').fill((v as any).semiPlate || '');
      }

      if (v.warranty) {
        await modal.locator('label[for="warranty"]').click();
        await modal.locator('input[name="warrantyEndDate"]').fill(v.warrantyEnd || '2026-12-31');
      }
      await modal.locator('input[name="firstRevisionMaxKm"]').fill('10000');
      await modal.locator('input[name="firstRevisionDeadline"]').fill('2025-06-30');

      if (v.hasInsurance) {
        await modal.locator('label[for="hasInsurance"]').click();
        await modal.locator('input[name="insurancePolicyUpload"]').setInputFiles(pdfPath);
      }
      if (v.hasMaintenance) {
        await modal.locator('label[for="hasMaintenanceContract"]').click();
        await modal.locator('input[name="maintenanceContractUpload"]').setInputFiles(pdfPath);
      }

      const driverSelect = modal.locator('select[name="driverId"]');
      const driverOptions = await driverSelect.locator('option').all();
      if (driverOptions.length > 1) {
        const optionToSelect = await driverOptions[1].getAttribute('value');
        if (optionToSelect) {
          await driverSelect.selectOption(optionToSelect);
        }
      }

      await modal.locator('button:has-text("Salvar Veículo")').click();
      await expect(modal).not.toBeVisible({ timeout: 45000 });
      await expect(page.locator('table').getByText(v.plate)).toBeVisible({ timeout: 20000 });
      console.log(`Veículo ${v.plate} cadastrado com sucesso.`);
    }
  });
});
