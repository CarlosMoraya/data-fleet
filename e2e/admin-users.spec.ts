import { test, expect } from '@playwright/test';

test.describe('Admin → Usuários', () => {
  test('página carrega e exibe tabela de usuários', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Admin Master aparece na lista', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('td', { hasText: 'Admin Master' }).first()).toBeVisible({ timeout: 8000 });
  });

  test('filtro de busca por nome funciona', async ({ page }) => {
    await page.goto('/admin/users');

    // Aguarda tabela carregar
    await expect(page.locator('table')).toBeVisible();

    await page.fill('input[placeholder="Buscar por nome..."]', 'xyzimpossível');
    await expect(page.locator('text=Nenhum usuário encontrado.')).toBeVisible();

    // Limpa busca e tabela volta a mostrar usuários
    await page.fill('input[placeholder="Buscar por nome..."]', '');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('modal de novo usuário abre com campos corretos', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('button:has-text("Novo Usuário")');

    await expect(page.locator('input[placeholder*="@"]')).toBeVisible(); // email
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // role ou client
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Criar")')).toBeVisible();
  });

  test('modal de novo usuário valida campos obrigatórios', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('button:has-text("Novo Usuário")');

    // Tenta salvar sem preencher nada
    const submitBtn = page.locator('button[type="submit"]:has-text("Criar")');
    await submitBtn.click();

    // Modal permanece aberto (campos required impedem submit)
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();
  });

  test('botão cancelar fecha o modal', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('button:has-text("Novo Usuário")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    await page.click('button:has-text("Cancelar")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).not.toBeVisible();
  });

  test('filtro por cliente funciona', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 8000 });

    const select = page.locator('main select');
    await expect(select).toBeVisible();

    // Seleciona opção "Todos os clientes"
    await select.selectOption({ index: 0 });
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });
});
