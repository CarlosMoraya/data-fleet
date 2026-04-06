import { test, expect } from '@playwright/test';
import path from 'path';

const ASSETS_PATH = path.resolve('e2e/assets');

const VEHICLES_TO_SEED = [
  {
    plate: 'GOL1A23',
    brand: 'Volkswagen',
    model: 'Gol 1.0',
    year: '2023',
    color: 'Branco',
    type: 'Passeio',
    energy: 'Combustão',
    fuel: 'Flex',
    owner: 'Arrendadora S.A.'
  },
  {
    plate: 'ACC9B45',
    brand: 'Mercedes-Benz',
    model: 'Accelo 1016',
    year: '2022',
    color: 'Azul',
    type: 'Vuc',
    energy: 'Combustão',
    fuel: 'Diesel S10',
    owner: 'Frota Própria'
  },
  {
    plate: 'FH5C000',
    brand: 'Volvo',
    model: 'FH 540 Globetrotter',
    year: '2024',
    color: 'Prata',
    type: 'Cavalo',
    energy: 'Combustão',
    fuel: 'Diesel',
    hasSemi: true,
    semiPlate: 'SRB7D89',
    owner: 'Transportadora XYZ'
  },
  {
    plate: 'BYD0E12',
    brand: 'BYD',
    model: 'Seal Performance',
    year: '2024',
    color: 'Preto',
    type: 'Passeio',
    energy: 'Elétrico',
    owner: 'Diretoria'
  },
  {
    plate: 'TOCO4F4',
    brand: 'Ford',
    model: 'F-4000',
    year: '2019',
    color: 'Vermelho',
    type: 'Toco',
    energy: 'Combustão',
    fuel: 'Diesel',
    owner: 'Operacional'
  }
];

test.describe('semeia 6 veículos e vincula apenas alguns motoristas para testes', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });
  });

  for (const v of VEHICLES_TO_SEED) {
    test(`Cadastrar Veículo: ${v.plate}`, async ({ page }) => {
      // 1. Abrir formulário
      await page.click('button:has-text("Adicionar Veículo")');
      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Cadastrar Veículo' })).toBeVisible();

      // 2. Preencher Identificação
      await modal.locator('input[name="licensePlate"]').fill(v.plate);
      await modal.locator('input[name="brand"]').fill(v.brand);
      await modal.locator('input[name="model"]').fill(v.model);
      await modal.locator('input[name="year"]').fill(v.year);
      await modal.locator('input[name="color"]').fill(v.color);
      await modal.locator('input[name="renavam"]').fill(`999${Math.random().toString().slice(2, 10)}`);
      await modal.locator('input[name="chassi"]').fill(`ABC${v.plate}XYZ${v.year}`);
      await modal.locator('input[name="detranUF"]').fill('SP');

      // 3. Propriedade
      await modal.locator('select[name="acquisition"]').selectOption('Owned');
      await modal.locator('input[name="acquisitionDate"]').fill('2024-01-01');
      await modal.locator('input[name="owner"]').fill(v.owner);
      await modal.locator('input[name="fipePrice"]').fill('100.000,00');
      await modal.locator('input[name="tracker"]').fill('Sinal Sat');
      await modal.locator('input[name="antt"]').fill('123456');
      await modal.locator('input[name="autonomy"]').fill('500');
      await modal.locator('input[name="tag"]').fill(`TAG-${v.plate}`);

      // 4. Categoria e Acessórios
      if (v.type === 'Passeio') {
         await modal.locator('select[name="category"]').selectOption('Leve');
      } else {
         await modal.locator('select[name="category"]').selectOption('Médio');
      }

      // 5. Uploads (Usando os assets de teste)
      const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
      const imgPath = path.join(ASSETS_PATH, 'test-image.png');

      await modal.locator('input[name="crlvUpload"]').setInputFiles(pdfPath);
      const fileInputs = modal.locator('input[type="file"]');
      await fileInputs.nth(1).setInputFiles(imgPath); // Sanitary
      await fileInputs.nth(2).setInputFiles(pdfPath); // GR
      await modal.locator('input[name="grExpirationDate"]').fill('2026-12-31');

      // 6. Especificações Técnicas
      await modal.locator('select[name="type"]').selectOption(v.type);
      await modal.locator('select[name="energySource"]').selectOption(v.energy);

      if (v.energy === 'Combustão') {
        await modal.locator('input[name="fuelType"]').fill(v.fuel || 'Diesel');
        await modal.locator('input[name="tankCapacity"]').fill('60');
        await modal.locator('input[name="avgConsumption"]').fill('10');
      }

      if (v.type === 'Cavalo' && v.hasSemi) {
        await modal.locator('input#semiReboque').check();
        await modal.locator('input[name="placaSemiReboque"]').fill(v.semiPlate || '');
      }

      // 7. Salvar e aguardar fechar
      await modal.locator('button:has-text("Salvar Veículo")').click();
      await expect(modal).not.toBeVisible({ timeout: 20000 });
      await expect(page.locator('table').getByText(v.plate)).toBeVisible({ timeout: 10000 });
    });
  }
});
