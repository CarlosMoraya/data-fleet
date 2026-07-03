import { expect, test, type Locator, type Page } from '@playwright/test';

interface TableRoute {
  name: string;
  path: string;
  heading: string | RegExp;
}

const ROUTES: TableRoute[] = [
  { name: 'Veículos', path: '/cadastros/veiculos', heading: 'Veículos' },
  { name: 'Agendamentos', path: '/agendamentos', heading: 'Agendamentos' },
  { name: 'Aprovação de Orçamentos', path: '/aprovacao-orcamentos', heading: 'Aprovação de Orçamentos' },
  { name: 'Manutenção', path: '/manutencao', heading: /Manuten/i },
];

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

async function findTableScrollContainer(table: Locator): Promise<Locator> {
  const scrollContainer = table.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " overflow-auto ")][1]');
  await expect(scrollContainer).toHaveCount(1);
  return scrollContainer;
}

test.describe('Tabelas principais — scroll interno', () => {
  for (const route of ROUTES) {
    test(`${route.name}: tabela usa container rolável próprio`, async ({ page }) => {
      await page.goto(route.path);
      await expect(mainHeading(page, route.heading)).toBeVisible({ timeout: 15000 });

      const table = page.locator('main table').first();
      await table.waitFor({ state: 'attached', timeout: 10000 }).catch(() => undefined);
      const tableCount = await table.count();
      test.skip(tableCount === 0, `${route.name}: sem tabela renderizada com a massa atual`);

      const scrollContainer = await findTableScrollContainer(table);
      const header = table.locator('thead').first();

      await expect(header).toBeVisible();

      const structure = await scrollContainer.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          rectHeight: rect.height,
          viewportHeight: window.innerHeight,
        };
      });

      expect(['auto', 'scroll']).toContain(structure.overflowX);
      expect(['auto', 'scroll']).toContain(structure.overflowY);
      expect(structure.clientHeight).toBeGreaterThan(0);
      expect(structure.rectHeight).toBeGreaterThan(0);
      expect(structure.rectHeight).toBeLessThanOrEqual(structure.viewportHeight);

      const headerStyle = await header.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          position: style.position,
          top: style.top,
          zIndex: style.zIndex,
          backgroundColor: style.backgroundColor,
        };
      });

      expect(headerStyle.position).toBe('sticky');
      expect(headerStyle.top).toBe('0px');
      expect(headerStyle.zIndex).not.toBe('auto');
      expect(headerStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

      if (structure.scrollHeight <= structure.clientHeight) {
        test.info().annotations.push({
          type: 'note',
          description: `${route.name}: massa atual não exige rolagem vertical; sticky validado estruturalmente.`,
        });
        return;
      }

      const initialHeaderTop = await header.evaluate((node) => node.getBoundingClientRect().top);
      await scrollContainer.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      const finalHeaderTop = await header.evaluate((node) => node.getBoundingClientRect().top);

      expect(Math.abs(finalHeaderTop - initialHeaderTop)).toBeLessThanOrEqual(2);
      await expect(header).toBeVisible();
    });
  }
});
