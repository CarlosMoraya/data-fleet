import { test, expect } from '@playwright/test';

const UID = Date.now().toString().slice(-6);
// Nome auto-gerado pelo form: "Checklist {categoria} {contexto}"
const TPL_LEVE = 'Checklist Leve Rotina';
const TPL_LIVRE = `Auditoria de Pátio E2E ${UID}`;

test.describe.serial('Módulo de Templates de Checklist (Manager)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checklist-templates');
    await expect(page.locator('h1', { hasText: 'Templates de Checklist' })).toBeVisible({ timeout: 15000 });
  });

  // ── Template vinculado a categoria de veículo ──────────────────────────────

  test('deve carregar a página de templates', async ({ page }) => {
    await expect(page.locator('button:has-text("Novo Template")')).toBeVisible();
  });

  test('deve criar template para categoria Leve (com sugestões)', async ({ page }) => {
    await page.click('button:has-text("Novo Template")');

    const modal = page.locator('.fixed.inset-0').first();
    await expect(modal.locator('h2', { hasText: 'Novo Template de Checklist' })).toBeVisible({ timeout: 10000 });

    // Passo 1: Metadados — o nome é auto-gerado (Checklist Leve Rotina)
    await modal.locator('input[value="Leve"]').check();
    await modal.locator('textarea').fill('Template de teste para veículos leves');
    await modal.locator('button:has-text("Próximo")').click();

    // Passo 2: Itens — sugestões pré-carregadas para categoria Leve
    await expect(modal.locator('button:has-text("Adicionar item")')).toBeVisible({ timeout: 10000 });

    // Verifica que existe ao menos um item obrigatório do sistema (Lock icon)
    await expect(modal.locator('[title="Item obrigatório do sistema"]').first()).toBeVisible({ timeout: 5000 });

    // Adiciona item customizado
    await modal.locator('button:has-text("Adicionar item")').click();
    const inputs = modal.locator('input[placeholder="Título do item *"]');
    await inputs.last().fill('Item customizado E2E');

    await modal.locator('button:has-text("Criar template")').click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Nome auto-gerado: "Checklist Leve Rotina"
    await expect(page.locator('table').getByText('Checklist Leve Rotina')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Rascunho').first()).toBeVisible();
  });

  test('deve publicar o template Leve', async ({ page }) => {
    const row = page.locator('tr').filter({ hasText: TPL_LEVE });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click publish button (CheckCircle icon)
    await row.locator('button[title="Publicar"]').click();

    // Confirm dialog
    const dialog = page.locator('.fixed.inset-0').last();
    await expect(dialog.locator('h3', { hasText: 'Publicar template' })).toBeVisible({ timeout: 5000 });
    await dialog.locator('button:has-text("Publicar")').click();

    // Wait for status to change
    await expect(row.locator('text=Publicado')).toBeVisible({ timeout: 15000 });
  });

  test('deve criar nova versão do template Leve', async ({ page }) => {
    const row = page.locator('tr').filter({ hasText: TPL_LEVE });
    await row.locator('button[title="Nova versão"]').click();

    const dialog = page.locator('.fixed.inset-0').last();
    await expect(dialog.locator('h3', { hasText: 'Criar nova versão' })).toBeVisible({ timeout: 5000 });
    await dialog.locator('button:has-text("Criar nova versão")').click();

    // Should now show draft again with v2
    await expect(row.locator('text=Rascunho')).toBeVisible({ timeout: 15000 });
    await expect(row.locator('text=v2')).toBeVisible();
  });

  // ── Template Livre ─────────────────────────────────────────────────────────

  test('deve criar template Livre sem sugestões pré-carregadas', async ({ page }) => {
    await page.click('button:has-text("Novo Template")');

    const modal = page.locator('.fixed.inset-0').first();
    await expect(modal.locator('h2', { hasText: 'Novo Template de Checklist' })).toBeVisible({ timeout: 10000 });

    // Step 1: Metadata - select Livre
    await modal.locator('input[type="text"]').first().fill(TPL_LIVRE);
    await modal.locator('input[value="Livre"]').check();
    await modal.locator('button:has-text("Próximo")').click();

    // Step 2: Action config
    await modal.locator('button:has-text("Próximo")').click();

    // Step 3: should be empty (no suggestions for Livre)
    await expect(modal.locator('text=Template Livre')).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('[title="Item obrigatório do sistema"]')).not.toBeVisible();

    // Add 2 custom items
    await modal.locator('button:has-text("Adicionar item")').click();
    await modal.locator('input[placeholder="Título do item *"]').nth(0).fill('Verificar iluminação do pátio');

    await modal.locator('button:has-text("Adicionar item")').click();
    await modal.locator('input[placeholder="Título do item *"]').nth(1).fill('Verificar portões e cancelas');

    await modal.locator('button:has-text("Criar template")').click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verify in table with Livre badge
    await expect(page.locator('table').getByText(TPL_LIVRE)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Livre').first()).toBeVisible();
  });

  test('deve publicar o template Livre', async ({ page }) => {
    const row = page.locator('tr').filter({ hasText: TPL_LIVRE });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('button[title="Publicar"]').click();

    const dialog = page.locator('.fixed.inset-0').last();
    await dialog.locator('button:has-text("Publicar")').click();

    await expect(row.locator('text=Publicado')).toBeVisible({ timeout: 15000 });
  });

  test('deve filtrar por categoria Livre', async ({ page }) => {
    await page.locator('button:has-text("Livre")').first().click();
    await expect(page.locator('table').getByText(TPL_LIVRE)).toBeVisible({ timeout: 5000 });
  });
});
