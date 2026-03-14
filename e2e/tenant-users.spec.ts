import { test, expect } from '@playwright/test';

const UID = Date.now();
const TEST_USER_NAME = `E2E User ${UID}`;
const TEST_USER_EMAIL = `e2e-${UID}@teste.com`;
const TEST_USER_PASSWORD = 'Teste@123456';

test.describe('Usuários (Fleet Analyst — Mariana)', () => {
  test.describe.configure({ timeout: 60000 });
  test('página /users carrega e exibe tabela', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').or(page.locator('text=Nenhum usuário cadastrado'))).toBeVisible();
  });

  test('não tem acesso à área admin', async ({ page }) => {
    await page.goto('/admin/users');
    // Fleet Analyst não é Admin Master, deve ser redirecionado
    await expect(page).not.toHaveURL(/admin\/users/, { timeout: 8000 });
  });

  test('filtro de busca por nome funciona', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });

    await page.fill('input[placeholder="Buscar por nome..."]', 'xyzimpossivel');
    await expect(page.locator('text=Nenhum usuário encontrado.')).toBeVisible();

    await page.fill('input[placeholder="Buscar por nome..."]', '');
  });

  test('modal de novo usuário abre com papéis corretos para Fleet Analyst', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Usuário")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    // Fleet Analyst (rank 4) pode criar: Fleet Assistant, Yard Auditor, Driver
    const roleSelect = page.locator('select');
    const options = roleSelect.locator('option');
    const optionTexts = await options.allTextContents();

    expect(optionTexts).toContain('Fleet Assistant');
    expect(optionTexts).toContain('Yard Auditor');
    expect(optionTexts).toContain('Driver');
    expect(optionTexts).not.toContain('Fleet Analyst');
    expect(optionTexts).not.toContain('Manager');
    expect(optionTexts).not.toContain('Director');
    expect(optionTexts).not.toContain('Admin Master');

    await page.click('button:has-text("Cancelar")');
  });

  test('cria usuário com papel Driver', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Usuário")');
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    // Aguarda o useEffect do React estabilizar o form
    await modal.locator('input[type="text"]').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await modal.locator('input[type="text"]').first().fill(TEST_USER_NAME);
    await modal.locator('input[type="email"]').fill(TEST_USER_EMAIL);
    await modal.locator('input[type="password"]').fill(TEST_USER_PASSWORD);
    await modal.locator('select').selectOption('Driver');

    await modal.locator('button[type="submit"]').click();

    // Modal fecha e usuário aparece na tabela
    await expect(modal.locator('h2', { hasText: 'Novo Usuário' })).not.toBeVisible({ timeout: 45000 });
    await expect(page.locator('table').getByText(TEST_USER_NAME)).toBeVisible({ timeout: 8000 });
  });

  test('busca encontra o usuário criado', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    // Aguarda tabela carregar
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder="Buscar por nome..."]', TEST_USER_NAME);
    await expect(page.locator('table').getByText(TEST_USER_NAME)).toBeVisible({ timeout: 8000 });
  });

  test('edita o nome do usuário criado', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Buscar o usuário para isolá-lo
    await page.fill('input[placeholder="Buscar por nome..."]', TEST_USER_NAME);
    await expect(page.locator('table').getByText(TEST_USER_NAME)).toBeVisible({ timeout: 8000 });

    // Clicar no botão editar da linha
    const row = page.locator('tr', { hasText: TEST_USER_NAME });
    await row.locator('button[title="Editar"]').click();

    await expect(page.locator('h2', { hasText: 'Editar Usuário' })).toBeVisible();

    // Alterar nome
    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.clear();
    await nameInput.fill(`${TEST_USER_NAME} Editado`);

    await page.click('button[type="submit"]:has-text("Salvar")');
    await expect(page.locator('h2', { hasText: 'Editar Usuário' })).not.toBeVisible({ timeout: 8000 });

    // Limpar busca e verificar nome atualizado
    await page.fill('input[placeholder="Buscar por nome..."]', '');
    await expect(page.locator('table').getByText(`${TEST_USER_NAME} Editado`)).toBeVisible({ timeout: 8000 });
  });

  test('exclui o usuário criado', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const editedName = `${TEST_USER_NAME} Editado`;

    await page.fill('input[placeholder="Buscar por nome..."]', editedName);
    await expect(page.locator('table').getByText(editedName)).toBeVisible({ timeout: 8000 });

    // Aceitar o confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    const row = page.locator('tr', { hasText: editedName });
    await row.locator('button[title="Excluir"]').click();

    // Usuário deve sumir da lista
    await expect(page.locator('table').getByText(editedName)).not.toBeVisible({ timeout: 10000 });
  });
});
