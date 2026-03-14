import { test, expect } from '@playwright/test';

test.describe('Módulo de Oficinas (Permissões Analyst)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Analyst (Mariana) já está logada via storageState no projeto 'analyst'
    await page.goto('/cadastros/oficinas');
    await expect(page.locator('h1', { hasText: 'Oficinas Parceiras' })).toBeVisible({ timeout: 15000 });
  });

  test('deve permitir editar mas não excluir sem flag', async ({ page }) => {
    // 1. Verificar se existe pelo menos uma oficina (as criadas no teste de manager podem estar lá se não deletadas, 
    // ou usamos uma que sabemos que existe ou criamos uma)
    // Para simplificar, vamos assumir que a tabela carregou.
    
    const row = page.locator('tr').nth(1); // Pega a primeira linha de dados
    if (await row.count() > 0 && !(await row.innerText()).includes('Nenhuma oficina')) {
      // Botão Editar deve estar visível (é o primeiro)
      await expect(row.locator('button').first()).toBeVisible();
      
      // Botão Excluir (último) não deve estar visível para Analyst padrão (can_delete_workshops = false)
      await expect(row.locator('button').last()).not.toBeVisible();
    }
  });

  test('deve permitir adicionar oficina', async ({ page }) => {
    await expect(page.locator('button:has-text("Adicionar Oficina")')).toBeVisible();
  });

});
