import { test, expect } from '@playwright/test';

test.describe('Admin → Usuários', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users');
    const topSelect = page.locator('header select');
    await page.waitForTimeout(2000);
    await expect(topSelect).toBeVisible({ timeout: 15000 });
    
    await expect(async () => {
      await topSelect.selectOption('');
      await expect(topSelect).toHaveValue('');
    }).toPass({ timeout: 5000 });
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('página carrega e exibe tabela de usuários', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Usuários' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Admin Master aparece na lista', async ({ page }) => {
    await expect(page.locator('td', { hasText: 'Admin Master' }).first()).toBeVisible({ timeout: 8000 });
  });

  test('filtro de busca por nome funciona', async ({ page }) => {

    // Aguarda tabela carregar
    await expect(page.locator('table')).toBeVisible();

    await page.fill('input[placeholder="Buscar por nome..."]', 'xyzimpossível');
    await expect(page.locator('text=Nenhum usuário encontrado.')).toBeVisible();

    // Limpa busca e tabela volta a mostrar usuários
    await page.fill('input[placeholder="Buscar por nome..."]', '');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('modal de novo usuário abre com campos corretos', async ({ page }) => {
    await page.click('button:has-text("Novo Usuário")');

    await expect(page.locator('input[placeholder*="@"]')).toBeVisible(); // email
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // role ou client
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Criar")')).toBeVisible();
  });

  test('modal de novo usuário valida campos obrigatórios', async ({ page }) => {
    await page.click('button:has-text("Novo Usuário")');

    // Tenta salvar sem preencher nada
    const submitBtn = page.locator('button[type="submit"]:has-text("Criar")');
    await submitBtn.click();

    // Modal permanece aberto (campos required impedem submit)
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();
  });

  test('botão cancelar fecha o modal', async ({ page }) => {
    await page.click('button:has-text("Novo Usuário")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).toBeVisible();

    await page.click('button:has-text("Cancelar")');
    await expect(page.locator('h2', { hasText: 'Novo Usuário' })).not.toBeVisible();
  });

  test('filtro por cliente funciona', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 8000 });

    const select = page.locator('header select');
    const optionsCount = await select.locator('option').count();
    if (optionsCount > 1) {
      await select.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      
      // Verifica se a tabela continua visível ou mostra mensagem de vazio
      const hasRows = await page.locator('table tbody tr').first().isVisible();
      const hasEmptyMsg = await page.locator('text=Nenhum usuário encontrado.').isVisible();
      expect(hasRows || hasEmptyMsg).toBe(true);
    }
  });
});
