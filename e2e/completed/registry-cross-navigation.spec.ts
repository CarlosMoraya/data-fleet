import { expect, test, type Page } from '@playwright/test';

async function expectRegistryRouteWithoutOpen(page: Page, route: string) {
  await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
  await expect(page).not.toHaveURL(/open=/);
}

function detailEditButton(page: Page) {
  return page.locator('div.fixed').getByRole('button', { name: 'Editar' });
}

test.describe('Navegação cruzada entre Motoristas e Veículos — Fleet Analyst+', () => {
  test.use({ storageState: 'e2e/.auth/mariana.json' });

  test('Analista+ — Motoristas → Veículos abre o veículo e exibe Editar', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const link = page.locator('tbody a[title^="Abrir o veículo "]').first();
    if (await link.count() === 0) {
      test.skip(true, 'Nenhum motorista com veículo vinculado');
    }

    await link.click();
    await expectRegistryRouteWithoutOpen(page, '/cadastros/veiculos');
    await expect(detailEditButton(page)).toBeVisible();
  });

  test('Analista+ — Veículos → Motoristas abre o motorista e exibe Editar', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.getByRole('heading', { name: 'Veículos' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const link = page.locator('tbody a[title^="Abrir o motorista "]').first();
    if (await link.count() === 0) {
      test.skip(true, 'Nenhum veículo com motorista vinculado');
    }

    await link.click();
    await expectRegistryRouteWithoutOpen(page, '/cadastros/motoristas');
    await expect(detailEditButton(page)).toBeVisible();
  });

  test('Analista+ — Editar troca o modal de veículo pelo formulário com a placa preenchida', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const link = page.locator('tbody a[title^="Abrir o veículo "]').first();
    if (await link.count() === 0) {
      test.skip(true, 'Nenhum motorista com veículo vinculado');
    }
    const title = await link.getAttribute('title');
    const plate = title?.replace('Abrir o veículo ', '');

    await link.click();
    await expect(detailEditButton(page)).toBeVisible();
    await detailEditButton(page).click();

    await expect(page.getByRole('heading', { name: 'Editar Veículo' })).toBeVisible();
    await expect(page.locator('input[name="licensePlate"]')).toHaveValue(plate ?? '');
  });

  test('Analista+ — cancelar o formulário fecha também o modal de visualização', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const link = page.locator('tbody a[title^="Abrir o veículo "]').first();
    if (await link.count() === 0) {
      test.skip(true, 'Nenhum motorista com veículo vinculado');
    }

    await link.click();
    await detailEditButton(page).click();
    await expect(page.getByRole('heading', { name: 'Editar Veículo' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Veículo' })).toHaveCount(0);
    await expect(detailEditButton(page)).toHaveCount(0);
  });

  test('Analista+ — ícone de visualização também exibe Editar', async ({ page }) => {
    await page.goto('/cadastros/veiculos');
    await expect(page.getByRole('heading', { name: 'Veículos' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const viewButton = page.locator('tbody button[title="Visualizar"]').first();
    if (await viewButton.count() === 0) {
      test.skip(true, 'Nenhum veículo cadastrado');
    }

    await viewButton.click();
    await expect(detailEditButton(page)).toBeVisible();
  });

  test('Analista+ — motorista sem vínculo exibe Sem veículo sem link', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const row = page.locator('tbody tr').filter({ hasText: 'Sem veículo' }).first();
    if (await row.count() === 0) {
      test.skip(true, 'Nenhum motorista sem veículo vinculado');
    }

    await expect(row.getByText('Sem veículo')).toBeVisible();
    await expect(row.locator('a')).toHaveCount(0);
  });
});

test.describe('Navegação cruzada entre Motoristas e Veículos — Fleet Assistant', () => {
  test.use({ storageState: 'e2e/.auth/pedro.json' });

  test('Assistente — modal de veículo não exibe Editar', async ({ page }) => {
    await page.goto('/cadastros/motoristas');
    await expect(page.getByRole('heading', { name: 'Motoristas' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const link = page.locator('tbody a[title^="Abrir o veículo "]').first();
    if (await link.count() === 0) {
      test.skip(true, 'Nenhum motorista com veículo vinculado');
    }

    await link.click();
    await expectRegistryRouteWithoutOpen(page, '/cadastros/veiculos');
    await expect(detailEditButton(page)).toHaveCount(0);
  });
});
