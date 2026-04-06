import { test, expect } from '@playwright/test';
import path from 'path';

const UID = Date.now().toString().slice(-6);
const TEST_PLATE = `E2E${UID}`;
const ASSETS_PATH = path.resolve('e2e/assets');

test.describe('Módulo de Veículos (Fluxo Completo)', () => {
  
  test.beforeEach(async ({ page }) => {
    // A maioria dos testes será via Manager (Alexandre) que já está logado via storageState no projeto 'manager'
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });
  });

  test('configura campos obrigatórios e valida no formulário', async ({ page }) => {
    // 1. Ir para Settings como Manager
    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Configurações' })).toBeVisible();

    // 2. Garantir que 'Renavam' e 'Chassi' estão marcados como OBRIGATÓRIOS (bg-orange-500)
    // No Settings.tsx, o botão tem bg-orange-500 quando obrigatório (optional = false)
    const renavamSwitch = page.locator('button[aria-label="Renavam obrigatório"]');
    const chassiSwitch = page.locator('button[aria-label="Chassi obrigatório"]');

    if (await renavamSwitch.getAttribute('class').then(c => c?.includes('bg-zinc-200'))) {
      await renavamSwitch.click();
    }
    if (await chassiSwitch.getAttribute('class').then(c => c?.includes('bg-zinc-200'))) {
      await chassiSwitch.click();
    }
    
    await page.locator('.bg-white').filter({ hasText: 'Campos Obrigatórios do Veículo' }).locator('button:has-text("Salvar")').click();
    await expect(page.locator('text=Configurações de veículos salvas com sucesso')).toBeVisible();

    // 3. Voltar para Veículos e abrir o formulário
    await page.goto('/cadastros/veiculos');
    await page.click('button:has-text("Adicionar Veículo")');
    
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Cadastrar Veículo' })).toBeVisible();

    // 4. Verificar se os campos têm o asterisco vermelho (*)
    // O componente Label adiciona <span class="text-red-500 ml-0.5">*</span> se req(name) for true
    await expect(modal.locator('label:has-text("Renavam")').locator('span.text-red-500')).toBeVisible();
    await expect(modal.locator('label:has-text("Chassi")').locator('span.text-red-500')).toBeVisible();

    await modal.locator('button:has-text("Cancelar")').click();
  });

  test('cadastra veículo com todos os campos e anexos', async ({ page }) => {
    await page.click('button:has-text("Adicionar Veículo")');
    const modal = page.locator('.fixed.inset-0');

    // Preencher dados básicos
    await modal.locator('input[name="licensePlate"]').fill(TEST_PLATE);
    await modal.locator('input[name="brand"]').fill('Toyota');
    await modal.locator('input[name="model"]').fill('Corolla E2E');
    await modal.locator('input[name="year"]').fill('2024');
    await modal.locator('input[name="color"]').fill('Prata');
    await modal.locator('input[name="renavam"]').fill('12345678901');
    await modal.locator('input[name="chassi"]').fill('BRTEST1234567890X');
    await modal.locator('input[name="detranUF"]').fill('SP');

    // Propriedade
    await modal.locator('select[name="acquisition"]').selectOption('Owned');
    await modal.locator('input[name="acquisitionDate"]').fill('2024-01-01');
    await modal.locator('input[name="owner"]').fill('Fleet Management S.A.');
    await modal.locator('input[name="fipePrice"]').fill('150000,00');
    await modal.locator('input[name="tracker"]').fill('Ituran');
    await modal.locator('input[name="antt"]').fill('999999');
    await modal.locator('input[name="autonomy"]').fill('600,5');
    await modal.locator('input[name="tag"]').fill('TAG123456');

    // Documentos & Acessórios
    await modal.locator('select[name="category"]').selectOption('Leve');
    await modal.locator('label[for="spareKey"]').click(); // Chave reserva
    await modal.locator('label[for="vehicleManual"]').click(); // Manual
    
    // Uploads
    const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
    const imgPath = path.join(ASSETS_PATH, 'test-image.png');

    await modal.locator('input[name="crlvUpload"]').setInputFiles(pdfPath);
    // Para os outros inputs que não têm 'name' (foram criados com makeFileHandler sem name as vezes)
    // Mas no código vi: onChange={handleSanitaryFileChange} etc.
    // Vamos usar o label ou a ordem.
    const fileInputs = modal.locator('input[type="file"]');
    await fileInputs.nth(1).setInputFiles(imgPath); // Inspeção Sanitária
    await fileInputs.nth(2).setInputFiles(pdfPath); // GR

    await modal.locator('input[name="grExpirationDate"]').fill('2026-12-31');

    // Especificações
    await modal.locator('select[name="type"]').selectOption('Vuc');
    await modal.locator('select[name="energySource"]').selectOption('Combustão');
    await modal.locator('input[name="fuelType"]').fill('Diesel');
    await modal.locator('input[name="tankCapacity"]').fill('80');
    await modal.locator('input[name="avgConsumption"]').fill('12,5');

    // Campos adicionais obrigatórios: Peso e Eixos
    await modal.locator('input[name="pbt"]').fill('3,5');
    await modal.locator('input[name="cmt"]').fill('45,0');
    await modal.locator('input[name="eixos"]').fill('2');

    // Revisão (Obrigatórios por default)
    await modal.locator('input[name="firstRevisionMaxKm"]').fill('10000');
    await modal.locator('input[name="firstRevisionDeadline"]').fill('2026-12-31');

    // Salvar
    await modal.locator('button:has-text("Salvar Veículo")').click();

    // Se o modal não fechar em 10s, logar o erro da UI
    try {
      await expect(modal).not.toBeVisible({ timeout: 10000 });
    } catch (e) {
      const errorMsg = await modal.locator('.text-red-700').textContent();
      console.error('Erro na UI:', errorMsg);
      throw e;
    }

    await expect(page.locator('table').getByText(TEST_PLATE)).toBeVisible({ timeout: 10000 });
  });

  test('edita veículo e verifica persistência dos anexos', async ({ page }) => {
    // 1. Buscar o veículo
    await page.fill('input[placeholder*="Buscar por placa"]', TEST_PLATE);
    const row = page.locator('tr', { hasText: TEST_PLATE });
    await row.locator('button').first().click(); // Botão Editar (o primeiro da div de ações)

    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Editar Veículo' })).toBeVisible();

    // 2. Verificar se links de "Visualizar" estão presentes
    await expect(modal.locator('a:has-text("Visualizar")')).toHaveCount(3);

    // 3. Alterar um campo
    await modal.locator('input[name="model"]').fill('Corolla E2E Modificado');
    
    await modal.locator('button:has-text("Salvar Veículo")').click();
    await expect(modal).not.toBeVisible();

    // 4. Verificar alteração na tabela
    await expect(page.locator('table').getByText('Corolla E2E Modificado')).toBeVisible();
  });

  test('exclui o veículo criado', async ({ page }) => {
    await page.fill('input[placeholder*="Buscar por placa"]', TEST_PLATE);
    const row = page.locator('tr', { hasText: TEST_PLATE });
    
    // Aceitar confirm
    page.on('dialog', dialog => dialog.accept());
    
    await row.locator('button').last().click(); // Botão Excluir

    await expect(page.locator('table').getByText(TEST_PLATE)).not.toBeVisible({ timeout: 10000 });
  });

});
