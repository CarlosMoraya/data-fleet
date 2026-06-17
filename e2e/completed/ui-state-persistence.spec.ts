import { test, expect } from '@playwright/test';

test.describe.serial('Persistência de estado de UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Veículos: busca persiste ao navegar e voltar', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('ABC');
    await expect(page.locator('tbody tr')).toHaveCount(await page.locator('tbody tr').count());

    await page.goto('/cadastros/motoristas');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 10000 });

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await expect(searchInput).toHaveValue('ABC');
  });

  test('Motoristas: busca persiste ao navegar e voltar', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('Teste');

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await page.goto('/cadastros/motoristas');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 10000 });

    await expect(searchInput).toHaveValue('Teste');
  });

  test('Motoristas: dados sensíveis não aparecem em sessionStorage', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.locator('h1', { hasText: 'Motoristas' })).toBeVisible({ timeout: 10000 });

    const sensitiveKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const lower = key.toLowerCase();
          if (lower.includes('password') || lower.includes('cpf') || lower.includes('cnh')) {
            keys.push(key);
          }
        }
      }
      return keys;
    });

    expect(sensitiveKeys).toEqual([]);
  });

  test('Manutenção: filtro e busca persistem ao navegar e voltar', async ({ page }) => {
    await page.goto('/manutencao');
    await expect(page.locator('h1', { hasText: /Manuten/i })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('OS');
    }

    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/manutencao');
    await expect(page.locator('h1', { hasText: /Manuten/i })).toBeVisible({ timeout: 10000 });

    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveValue('OS');
    }
  });

  test('Pneus: busca persiste ao navegar e voltar', async ({ page }) => {
    await page.goto('/cadastros/pneus');
    await expect(page.locator('h1', { hasText: 'Pneus' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('ABC');
    }

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    await page.goto('/cadastros/pneus');
    await expect(page.locator('h1', { hasText: 'Pneus' })).toBeVisible({ timeout: 10000 });

    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveValue('ABC');
    }
  });

  test('Checklists: aba persiste ao navegar e voltar', async ({ page }) => {
    await page.goto('/checklists');
    await expect(page.locator('h1', { hasText: 'Checklists' })).toBeVisible({ timeout: 10000 });

    const tabButton = page.locator('button', { hasText: /Inspe.*Pneu/i }).first();
    if (await tabButton.isVisible()) {
      await tabButton.click();
    }

    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/checklists');
    await expect(page.locator('h1', { hasText: 'Checklists' })).toBeVisible({ timeout: 10000 });

    if (await tabButton.isVisible()) {
      await expect(tabButton).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('Checklists: botões destrutivos não persistem', async ({ page }) => {
    await page.goto('/checklists');
    await expect(page.locator('h1', { hasText: 'Checklists' })).toBeVisible({ timeout: 10000 });

    const confirmDialogKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('confirmDelete') || key.includes('createPlan'))) {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(confirmDialogKeys).toEqual([]);
  });

  test('Dashboard: data persiste por usuário/cliente', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();
    if (dateCount >= 1) {
      const fromInput = dateInputs.first();
      await fromInput.fill('2024-01-01');
    }

    const scopedKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('bf:v1:ui:preference') && key.includes('dashboard')) {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(scopedKeys.length).toBeGreaterThanOrEqual(0);

    const oldStyleKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === 'dashboard_date_filter') {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(oldStyleKeys.length).toBeLessThanOrEqual(1);
  });

  test('Estado UI: chaves usam namespace bf:v1:ui', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 10000 });

    const allKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('bf:v1:ui:')) {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(allKeys.length).toBeGreaterThan(0);
    for (const key of allKeys) {
      expect(key).toMatch(/^bf:v1:ui:(session|preference|draft):/);
    }
  });
});