import { test, expect } from '@playwright/test';

test.describe('Password self-service public flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login exibe link Esqueci minha senha e navega para /recuperar-senha', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page).toHaveURL(/\/recuperar-senha$/);
  });

  test('recuperar-senha exibe mensagem neutra após enviar', async ({ page }) => {
    await page.goto('/recuperar-senha');
    await page.getByLabel('Email').fill('nao-existe@example.com');
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByText('receberá um link')).toBeVisible({ timeout: 10000 });
  });

  test('redefinir-senha sem sessão exibe link inválido/expirado', async ({ page }) => {
    await page.goto('/redefinir-senha');
    await expect(page.getByText('Link inválido ou expirado. Solicite um novo link de recuperação.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute('href', '/recuperar-senha');
  });
});

test.describe('Password self-service authenticated flow', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('alterar senha está acessível e mostra os 3 campos', async ({ page }) => {
    await page.goto('/conta/senha');
    await expect(page.getByRole('heading', { name: 'Alterar senha' })).toBeVisible();
    await expect(page.getByLabel('Senha atual')).toBeVisible();
    await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirmar nova senha')).toBeVisible();
  });

  test('validação client-side bloqueia senha curta/divergente', async ({ page }) => {
    await page.goto('/conta/senha');
    await page.getByLabel('Senha atual').fill('senha-atual');
    await page.getByLabel('Nova senha', { exact: true }).fill('123');
    await page.getByLabel('Confirmar nova senha').fill('123');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeVisible();

    await page.getByLabel('Nova senha', { exact: true }).fill('senha1234');
    await page.getByLabel('Confirmar nova senha').fill('outra1234');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  });
});
