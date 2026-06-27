/**
 * TESTE E2E PENDENTE — IMPORTAR ITENS E DUPLICAR TEMPLATE DE CHECKLIST
 *
 * Pré-requisitos:
 * - Usuário Manager com credenciais em TEST_MANAGER_EMAIL e TEST_MANAGER_PASSWORD.
 * - Pelo menos 1 template publicado com itens no tenant do usuário.
 * - Pelo menos 1 template rascunho e 1 descontinuado para validar a restrição visual do botão Duplicar.
 *
 * Este spec permanece em e2e/pending porque a massa/usuário de teste pode não existir no DEV.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required E2E credential env: ${name}`);
  }
  return value;
}

async function loginAsManager(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', requireEnv('TEST_MANAGER_EMAIL'));
  await page.fill('input[type="password"]', requireEnv('TEST_MANAGER_PASSWORD'));
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function openTemplates(page: Page) {
  await page.goto('/checklist-templates');
  await expect(page.getByRole('heading', { name: 'Templates de Checklist' })).toBeVisible({ timeout: 15000 });
}

async function openDuplicateModal(page: Page) {
  const publishedRow = page.locator('tbody tr').filter({ has: page.locator('button[title="Duplicar"]') }).first();
  await expect(publishedRow).toBeVisible({ timeout: 10000 });
  await publishedRow.locator('button[title="Duplicar"]').click();
  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal.getByRole('heading', { name: 'Novo Template de Checklist' })).toBeVisible({ timeout: 10000 });
  return { modal, publishedRow };
}

async function getEnabledItemTitles(modal: Locator) {
  return modal.locator('input[placeholder="Título do item *"]:not([disabled])').evaluateAll(nodes =>
    nodes.map(node => (node as HTMLInputElement).value.trim()).filter(Boolean),
  );
}

test.describe.serial('Checklist template import and duplicate', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await openTemplates(page);
  });

  test('duplicates a published template into an independent draft', async ({ page }) => {
    const { modal } = await openDuplicateModal(page);
    const nameInput = modal.locator('input[type="text"]').first();
    const duplicateName = await nameInput.inputValue();

    expect(duplicateName.startsWith('Cópia de ')).toBe(true);

    await modal.getByRole('button', { name: 'Próximo' }).click();

    const importedTitles = await getEnabledItemTitles(modal);
    expect(importedTitles.length).toBeGreaterThan(0);

    await modal.locator('input[placeholder="Título do item *"]').first().fill(`Item duplicado ${Date.now()}`);
    await modal.getByRole('button', { name: 'Criar template' }).click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    await expect(page.locator('table').getByText(duplicateName)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Rascunho').first()).toBeVisible();
  });

  test('imports items from an existing template and replaces the draft list', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo Template' }).click();
    const modal = page.locator('.fixed.inset-0').first();

    await modal.locator('input[type="text"]').first().fill(`Importado E2E ${Date.now()}`);
    await modal.getByRole('button', { name: 'Próximo' }).click();

    await modal.getByRole('button', { name: 'Importar de template existente' }).click();
    const select = modal.locator('select');
    await expect(select).toBeVisible();
    await select.selectOption({ index: 1 });

    const importedTitles = await getEnabledItemTitles(modal);
    expect(importedTitles.length).toBeGreaterThan(0);
  });

  test('shows duplicate action only for published templates', async ({ page }) => {
    const publishedRows = page.locator('tbody tr').filter({ has: page.locator('text=Publicado') });
    const draftRows = page.locator('tbody tr').filter({ has: page.locator('text=Rascunho') });
    const deprecatedRows = page.locator('tbody tr').filter({ has: page.locator('text=Descontinuado') });

    await expect(publishedRows.first().locator('button[title="Duplicar"]')).toBeVisible();
    await expect(draftRows.first().locator('button[title="Duplicar"]')).toHaveCount(0);
    await expect(deprecatedRows.first().locator('button[title="Duplicar"]')).toHaveCount(0);
  });
});
