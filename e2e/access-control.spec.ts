import { test, expect } from '@playwright/test';

// Testes sem autenticação — verifica proteção de rotas
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Controle de Acesso', () => {
  test('usuário não autenticado é redirecionado ao acessar /', async ({ page }) => {
    await page.goto('/');
    // Deve cair na tela de login ou ser redirecionado
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });

  test('usuário não autenticado não acessa /admin/clients', async ({ page }) => {
    await page.goto('/admin/clients');
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });

  test('usuário não autenticado não acessa /admin/users', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });

  test('rota inexistente redireciona para login', async ({ page }) => {
    await page.goto('/pagina-que-nao-existe');
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
