import { test, expect } from '@playwright/test';

const UID = Date.now();
const TEST_USER_NAME = `E2E Asst ${UID}`;
const TEST_USER_EMAIL = `e2e-asst-${UID}@teste.com`;
const TEST_USER_PASSWORD = 'Teste@123456';

test.describe('Usuários (Fleet Assistant — Pedro)', () => {
  test.describe.configure({ timeout: 60000 });
  test('página /users carrega e exibe tabela', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').or(page.locator('text=Nenhum usuário cadastrado'))).toBeVisible();
  });

  test('não tem acesso à área admin', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/admin\/users/, { timeout: 8000 });
  });

  test('modal mostra apenas papéis permitidos para Fleet Assistant', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Usuário")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    // Fleet Assistant (rank 3) pode criar: Yard Auditor, Driver
    const options = await page.locator('select option').allTextContents();

    expect(options).toContain('Yard Auditor');
    expect(options).toContain('Driver');
    expect(options).not.toContain('Fleet Assistant');
    expect(options).not.toContain('Fleet Analyst');
    expect(options).not.toContain('Manager');
    expect(options).not.toContain('Director');
    expect(options).not.toContain('Admin Master');

    await page.click('button:has-text("Cancelar")');
  });

  test('cria usuário com papel Yard Auditor', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Usuário")');
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    await modal.locator('input[type="text"]').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await modal.locator('input[type="text"]').first().fill(TEST_USER_NAME);
    await modal.locator('input[type="email"]').fill(TEST_USER_EMAIL);
    await modal.locator('input[type="password"]').fill(TEST_USER_PASSWORD);
    await modal.locator('select').selectOption('Yard Auditor');

    await modal.locator('button[type="submit"]').click();

    await expect(modal.locator('h2', { hasText: 'Novo Usuário' })).not.toBeVisible({ timeout: 45000 });
    await expect(page.locator('table').getByText(TEST_USER_NAME)).toBeVisible({ timeout: 8000 });
  });

  test('edita o nome do usuário criado', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder="Buscar por nome..."]', TEST_USER_NAME);
    await expect(page.locator('table').getByText(TEST_USER_NAME)).toBeVisible({ timeout: 8000 });

    const row = page.locator('tr', { hasText: TEST_USER_NAME });
    await row.locator('button[title="Editar"]').click();

    await expect(page.locator('h2', { hasText: 'Editar Usuário' })).toBeVisible();

    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.clear();
    await nameInput.fill(`${TEST_USER_NAME} Ed`);

    await page.click('button[type="submit"]:has-text("Salvar")');
    await expect(page.locator('h2', { hasText: 'Editar Usuário' })).not.toBeVisible({ timeout: 8000 });

    await page.fill('input[placeholder="Buscar por nome..."]', '');
    await expect(page.locator('table').getByText(`${TEST_USER_NAME} Ed`)).toBeVisible({ timeout: 8000 });
  });

  test('exclui o usuário criado', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const editedName = `${TEST_USER_NAME} Ed`;
    await page.fill('input[placeholder="Buscar por nome..."]', editedName);
    await expect(page.locator('table').getByText(editedName)).toBeVisible({ timeout: 8000 });

    page.on('dialog', (dialog) => dialog.accept());

    const row = page.locator('tr', { hasText: editedName });
    await row.locator('button[title="Excluir"]').click();

    await expect(page.locator('table').getByText(editedName)).not.toBeVisible({ timeout: 10000 });
  });
});
