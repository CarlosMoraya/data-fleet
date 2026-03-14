import { test, expect } from '@playwright/test';

const UID = Date.now().toString().slice(-6);
const TEST_NAME = `Oficina E2E ${UID}`;
const TEST_CNPJ = `123456780001${UID.slice(-2)}`; // 14 digits total

test.describe.serial('Módulo de Oficinas (Fluxo Completo)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Manager (Alexandre) já está logado via storageState no projeto 'manager'
    await page.goto('/cadastros/oficinas');
    await expect(page.locator('h1', { hasText: 'Oficinas Parceiras' })).toBeVisible({ timeout: 15000 });
  });

  test('deve carregar a tabela de oficinas', async ({ page }) => {
    // A tabela deve estar visível após o loading
    await expect(page.locator('table')).toBeVisible();
  });

  test('deve cadastrar uma nova oficina com sucesso', async ({ page }) => {
    await page.click('button:has-text("Adicionar Oficina")');
    
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Nova Oficina' })).toBeVisible();

    // Preencher Dados da Oficina
    await modal.locator('input[name="name"]').fill(TEST_NAME);
    await modal.locator('input[name="cnpj"]').fill(TEST_CNPJ);
    await modal.locator('input[name="phone"]').fill('11999999999');
    await modal.locator('input[name="email"]').fill('contato@oficinae2e.com');
    await modal.locator('input[name="contactPerson"]').fill('João Mecânico');

    // Preencher Endereço
    await modal.locator('input[name="addressStreet"]').fill('Rua das Ferramentas');
    await modal.locator('input[name="addressNumber"]').fill('500');
    await modal.locator('input[name="addressComplement"]').fill('Galpão A');
    await modal.locator('input[name="addressNeighborhood"]').fill('Bairro Industrial');
    await modal.locator('input[name="addressCity"]').fill('São Paulo');
    await modal.locator('input[name="addressState"]').fill('SP');
    await modal.locator('input[name="addressZip"]').fill('01234567');

    // Especialidades
    await modal.getByLabel('Mecânica Geral').check();
    await modal.getByLabel('Elétrica').check();
    
    await modal.locator('textarea[name="notes"]').fill('Oficina de teste automatizado.');

    // Salvar
    await modal.locator('button:has-text("Cadastrar Oficina")').click();

    // Verificar se o modal fechou
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verificar se aparece na tabela
    await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible();
  });

  test('deve buscar oficina por nome ou CNPJ', async ({ page }) => {
    // Esperar table carregar antes de focar na busca
    await expect(page.locator('table')).toBeVisible();

    // Buscar por nome
    await page.locator('input[placeholder*="Buscar por nome ou CNPJ"]').fill(TEST_NAME);
    await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible();

    // Limpar e buscar por CNPJ (os dígitos do CNPJ de teste)
    await page.locator('input[placeholder*="Buscar por nome ou CNPJ"]').fill(TEST_CNPJ);
    await expect(page.locator('table').getByText(TEST_NAME)).toBeVisible();
  });

  test('deve editar uma oficina existente', async ({ page }) => {
    await page.locator('input[placeholder*="Buscar por nome ou CNPJ"]').fill(TEST_NAME);
    const row = page.locator('tr', { hasText: TEST_NAME });
    
    // Clicar no botão editar (lápis)
    await row.locator('button').first().click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Editar Oficina' })).toBeVisible();

    // Alterar nome
    const updatedName = `${TEST_NAME} EDITADO`;
    await modal.locator('input[name="name"]').fill(updatedName);
    
    // Adicionar mais uma especialidade
    await modal.getByLabel('Freios').check();

    await modal.locator('button:has-text("Salvar Alterações")').click();
    await expect(modal).not.toBeVisible();

    // Verificar persistência
    await page.locator('input[placeholder*="Buscar por nome ou CNPJ"]').fill(updatedName);
    await expect(page.locator('table').getByText(updatedName)).toBeVisible();
  });

  test('deve validar CNPJ duplicado', async ({ page }) => {
    await page.click('button:has-text("Adicionar Oficina")');
    const modal = page.locator('.fixed.inset-0');

    await modal.locator('input[name="name"]').fill('Outra Oficina Mesma CNPJ');
    await modal.locator('input[name="cnpj"]').fill(TEST_CNPJ); // Já cadastrado acima

    await modal.locator('button:has-text("Cadastrar Oficina")').click();

    // Deve mostrar mensagem de erro (código 23505 capturado no WorkshopForm)
    await expect(modal.locator('text=Este CNPJ já está cadastrado para este cliente.')).toBeVisible();
    
    await modal.locator('button:has-text("Cancelar")').click();
  });

  /* 
  test('deve excluir a oficina cadastrada', async ({ page }) => {
    await page.locator('input[placeholder*="Buscar por nome ou CNPJ"]').fill(TEST_NAME);
    const row = page.locator('tr', { hasText: TEST_NAME }).or(page.locator('tr', { hasText: `${TEST_NAME} EDITADO` }));
    
    // Configurar para aceitar o window.confirm
    page.on('dialog', dialog => dialog.accept());
    
    // Clicar no botão excluir (lixeira)
    await row.locator('button').last().click();

    // Verificar se sumiu da tabela
    await expect(page.locator('table').getByText(TEST_NAME)).not.toBeVisible({ timeout: 10000 });
  });
  */

});
