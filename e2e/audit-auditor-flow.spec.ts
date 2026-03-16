import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — PERFIL 2: AUDITOR (Carlos)
 * 
 * O Auditor tem acesso de leitura a múltiplos clientes, mas não pode criar/editar (teoricamente).
 * Foco: Visualização de Dashboards, Listagem de Veículos e Checklists.
 */

test.describe('Auditor — Fluxo de Auditoria', () => {
  test.use({ storageState: 'e2e/.auth/carlos.json' });

  test('A.1 Acesso e Redirecionamento Automático', async ({ page }) => {
    await page.goto('/');
    // Auditor deve ser redirecionado para /checklists
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Checklists' })).toBeVisible();
    
    // Sidebar NÃO deve mostrar Dashboard ou Cadastros
    await expect(page.locator('text=Dashboard')).not.toBeVisible();
    await expect(page.locator('text=Cadastros')).not.toBeVisible();
  });

  test('A.2 Tentativa de Acesso Proibido (Vehicles)', async ({ page }) => {
    // Tenta acessar veículos diretamente pela URL
    await page.goto('/cadastros/veiculos');
    // Deve ser redirecionado de volta para / (que vai para /checklists)
    await expect(page).toHaveURL(/.*checklists.*/, { timeout: 15000 });
  });

  test('B.1 Visualização de Checklists e Filtros', async ({ page }) => {
    await page.goto('/checklists');
    
    // Pode ver a tabela OU a mensagem de "Sem checklists"
    const content = page.locator('table').or(page.getByText('Sem checklists'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
    
    // Deve ver o botão de filtro (presente em ambos os casos)
    const filterBtn = page.locator('button').filter({ hasText: /Filtrar/i });
    await expect(filterBtn).toBeVisible();
  });

  test('C.1 Logout', async ({ page }) => {
    await page.goto('/checklists');
    const logoutBtn = page.getByRole('button', { name: /Logout/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*login.*/, { timeout: 15000 });
  });
});
