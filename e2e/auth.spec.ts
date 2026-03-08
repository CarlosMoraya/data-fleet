import { test, expect } from '@playwright/test';

// Estes testes rodam SEM a storageState do admin (sem autenticação prévia)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Autenticação', () => {
  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login com credenciais inválidas exibe erro', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalido@teste.com');
    await page.fill('input[type="password"]', 'senhaerrada');
    await page.click('button[type="submit"]');

    // Aguarda mensagem de erro aparecer
    const error = page.locator('text=Invalid login credentials').or(
      page.locator('[class*="red"]').filter({ hasText: /erro|inválid|invalid/i })
    );
    await expect(error.first()).toBeVisible({ timeout: 8000 });
  });

  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    if (!email || !password) test.skip();

    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
