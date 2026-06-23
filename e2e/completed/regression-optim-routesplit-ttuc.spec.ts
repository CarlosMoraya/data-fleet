import { expect, test, type Locator, type Page } from '@playwright/test';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

const ROUTES = [
  {
    label: 'Dashboard',
    heading: 'Dashboard',
    navigate: (page: Page) => page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click(),
  },
  {
    label: 'Veículos',
    heading: 'Veículos',
    navigate: async (page: Page) => {
      await page.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
      await page.getByRole('link', { name: 'Veículos' }).click();
    },
  },
  {
    label: 'Motoristas',
    heading: 'Motoristas',
    navigate: (page: Page) => page.getByRole('link', { name: 'Motoristas' }).click(),
  },
  {
    label: 'Pneus',
    heading: 'Gestão de Pneus',
    navigate: async (page: Page) => {
      await page.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
      await page.getByRole('link', { name: 'Pneus' }).click();
    },
  },
  {
    label: 'Manutenção',
    heading: /Manuten/i,
    navigate: (page: Page) => page.getByRole('navigation').getByRole('link', { name: 'Manutenção' }).click(),
  },
  {
    label: 'Checklists',
    heading: 'Checklists',
    navigate: (page: Page) => page.getByRole('navigation').getByRole('link', { name: 'Checklists' }).click(),
  },
  {
    label: 'Agendamentos',
    heading: 'Agendamentos',
    navigate: (page: Page) => page.getByRole('navigation').getByRole('link', { name: 'Agendamentos' }).click(),
  },
] satisfies {
  label: string;
  heading: string | RegExp;
  navigate: (page: Page) => Promise<void>;
}[];

test.describe('Regressão pós-otimização — route split e TTUC', () => {
  test('rotas principais resolvem chunks e conteúdo útil dentro do limiar', async ({ page }) => {
    const failedChunks: string[] = [];
    const pageErrors: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (/\.(js|mjs)(?:\?|$)/.test(url) && response.status() >= 400) {
        failedChunks.push(`${response.status()} ${url}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(mainHeading(page, 'Dashboard')).toBeVisible({ timeout: 15000 });

    for (const route of ROUTES) {
      const startedAt = Date.now();
      await route.navigate(page);
      await expect(mainHeading(page, route.heading)).toBeVisible({ timeout: 10000 });
      const elapsed = Date.now() - startedAt;
      console.log(`TTUC ${route.label}: ${elapsed}ms`);
    }

    expect(failedChunks).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
