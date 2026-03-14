import { test, expect } from '@playwright/test';

const TEST_CLIENT_NAME = `Teste E2E ${Date.now()}`;
const EDITED_NAME = `${TEST_CLIENT_NAME} Editado`;

test.describe.serial('Admin → Clientes', () => {
  test('página carrega e exibe tabela de clientes', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page.locator('h1', { hasText: 'Clientes' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('seção Admin aparece na sidebar para Admin Master', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Admin').first()).toBeVisible();
    await expect(page.locator('a[href="/admin/clients"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
  });

  test('cria novo cliente', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.click('button:has-text("Novo Cliente")');

    // Modal abre
    await expect(page.locator('h2', { hasText: 'Novo Cliente' })).toBeVisible();

    await page.fill('input[placeholder="Ex: Acme Logistics"]', TEST_CLIENT_NAME);
    await page.click('button[type="submit"]:has-text("Salvar")');

    // Modal fecha e cliente aparece na tabela
    await expect(page.locator('table').getByText(TEST_CLIENT_NAME)).toBeVisible({ timeout: 8000 });
  });

  test('edita cliente existente', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page.locator('table').getByText(TEST_CLIENT_NAME)).toBeVisible({ timeout: 8000 });

    // Clica no botão de editar da linha do cliente criado
    const row = page.locator('tr').filter({ hasText: TEST_CLIENT_NAME });
    await row.locator('button[title="Editar"]').click();

    await expect(page.locator('h2', { hasText: 'Editar Cliente' })).toBeVisible();

    const nameInput = page.locator('input[placeholder="Ex: Acme Logistics"]');
    await nameInput.clear();
    await page.waitForTimeout(500);
    await nameInput.fill(EDITED_NAME);
    await expect(nameInput).toHaveValue(EDITED_NAME); // verifica que React atualizou o estado
    await page.click('button:has-text("Salvar")');
    await page.waitForTimeout(1000); // Aguarda a tabela recarregar com folga

    // Verifica que o modal fechou (save completou sem erro)
    await expect(page.locator('h2', { hasText: 'Editar Cliente' })).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table').getByText(EDITED_NAME)).toBeVisible({ timeout: 8000 });
  });

  test('busca filtra clientes por nome', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.fill('input[placeholder="Buscar por nome..."]', EDITED_NAME);

    // Apenas o cliente editado deve aparecer
    await expect(page.locator('table').getByText(EDITED_NAME)).toBeVisible();

    // Limpa busca
    await page.fill('input[placeholder="Buscar por nome..."]', 'xyzimpossível');
    await expect(page.locator('text=Nenhum cliente encontrado.')).toBeVisible();
  });

  test('exclui cliente', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page.locator('table').getByText(EDITED_NAME)).toBeVisible({ timeout: 8000 });

    const row = page.locator('tr').filter({ hasText: EDITED_NAME });
    page.once('dialog', (dialog) => dialog.accept());
    await row.locator('button[title="Excluir"]').click();

    await expect(page.locator('table').getByText(EDITED_NAME)).not.toBeVisible({ timeout: 8000 });
  });
});
