import { test, expect } from '@playwright/test';

test.describe.serial('Motoristas: filtros estruturados', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible({ timeout: 15000 });
  });

  test('filtros estruturados estão visíveis', async ({ page }) => {
    await expect(page.getByLabel('Embarcador')).toBeVisible();
    await expect(page.getByLabel('Base / Unidade Operacional')).toBeVisible();
    await expect(page.getByLabel('Situação')).toBeVisible();
  });

  test('aplicar situação atualiza URL e mostra banner', async ({ page }) => {
    await page.getByLabel('Situação').selectOption('sem_veiculo');

    await expect(page).toHaveURL(/situacao=sem_veiculo/);
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();
  });

  test('limpar filtros remove parâmetros e banner', async ({ page }) => {
    await page.getByLabel('Situação').selectOption('sem_veiculo');
    await expect(page.getByTestId('active-filter-banner')).toBeVisible();

    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    await expect(page).not.toHaveURL(/situacao=|embarcador=|unidade=/);
    await expect(page.getByTestId('active-filter-banner')).toHaveCount(0);
  });

  test('filtros estruturados não persistem PII em storage', async ({ page }) => {
    const shipperSelect = page.getByLabel('Embarcador');
    const firstShipper = await shipperSelect.evaluate((select) => {
      const options = Array.from((select as HTMLSelectElement).options);
      return options.find((option) => option.value !== '')?.value ?? null;
    });

    if (!firstShipper) {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Seed sem embarcador derivado de veículos vinculados a motoristas; validação ficou limitada a URL e ausência de chaves persistidas.',
      });
    } else {
      await shipperSelect.selectOption(firstShipper);
    }

    await page.getByLabel('Situação').selectOption('com_veiculo');
    await expect(page).toHaveURL(/situacao=com_veiculo/);
    if (firstShipper) {
      await expect(page).toHaveURL(/embarcador=/);
    }

    const persistedStructuredFilters = await page.evaluate(() => {
      const collect = (storage: Storage) =>
        Array.from({ length: storage.length }, (_, index) => storage.key(index))
          .filter((key): key is string => !!key)
          .filter((key) => key.startsWith('bf:v1:ui'))
          .filter((key) => key.includes(':drivers:filter:'))
          .filter((key) => !key.endsWith(':search'));

      return {
        local: collect(window.localStorage),
        session: collect(window.sessionStorage),
        search: window.location.search,
      };
    });

    expect(persistedStructuredFilters.local).toEqual([]);
    expect(persistedStructuredFilters.session).toEqual([]);
    expect(persistedStructuredFilters.search).toContain('situacao=com_veiculo');
    if (firstShipper) {
      expect(persistedStructuredFilters.search).toContain('embarcador=');
    }
  });
});
