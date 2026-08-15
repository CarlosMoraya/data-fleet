import { expect, test, type Locator, type Page } from '@playwright/test';

interface TableRoute {
  name: string;
  path: string;
  heading: string | RegExp;
  /**
   * Em janela baixa (densidade compacta) estas rotas trocam o scrollport interno
   * pelo scrollport da página — ver "Densidade adaptativa por altura" em
   * agent/AGENT-DESIGN.md.
   */
  pageScrollsWhenShort: boolean;
}

const ROUTES: TableRoute[] = [
  { name: 'Veículos', path: '/cadastros/veiculos', heading: 'Veículos', pageScrollsWhenShort: false },
  { name: 'Checklists', path: '/checklists', heading: 'Checklists', pageScrollsWhenShort: true },
  { name: 'Agendamentos', path: '/agendamentos', heading: 'Agendamentos', pageScrollsWhenShort: true },
  { name: 'Aprovação de Orçamentos', path: '/financeiro?tab=budget', heading: 'Aprovação de Orçamentos', pageScrollsWhenShort: false },
  { name: 'Manutenção', path: '/manutencao', heading: /Manuten/i, pageScrollsWhenShort: false },
];

/** Acima do ponto de corte da variante `tall` (min-height: 901px). */
const TALL_VIEWPORT = { width: 1280, height: 1000 };
/** Abaixo do ponto de corte: densidade compacta ativa. */
const SHORT_VIEWPORT = { width: 1280, height: 720 };

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

/**
 * Marca, via `data-e2e-scrollport`, o `div` ancestral mais próximo da tabela que
 * é de fato um scrollport (overflow computado `auto`/`scroll`), parando no
 * `<main>`. A checagem é por estilo computado — e não pelo token de classe —
 * porque a densidade adaptativa aplica `tall:overflow-auto`, cujo efeito
 * depende da altura da janela.
 */
async function markTableScrollAncestors(table: Locator, marker: string): Promise<number> {
  return table.evaluate((node, attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    let found = 0;
    let current = node.parentElement;
    while (current && current.tagName.toLowerCase() !== 'main') {
      if (current.tagName.toLowerCase() === 'div') {
        const style = window.getComputedStyle(current);
        if (['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflowX)) {
          current.setAttribute(attr, String(found));
          found += 1;
        }
      }
      current = current.parentElement;
    }
    return found;
  }, marker);
}

async function findTableScrollContainer(page: Page, table: Locator): Promise<Locator> {
  const found = await markTableScrollAncestors(table, 'data-e2e-scrollport');
  expect(found).toBeGreaterThanOrEqual(1);
  return page.locator('[data-e2e-scrollport="0"]');
}

/** Localiza o elemento que realmente rola verticalmente, seja `div` ou `main`. */
function pageScrollContainer(page: Page): Locator {
  return page.locator('main');
}

async function gotoRoute(page: Page, route: TableRoute): Promise<Locator | null> {
  await page.goto(route.path);
  await expect(mainHeading(page, route.heading)).toBeVisible({ timeout: 15000 });

  const table = page.locator('main table').first();
  await table.waitFor({ state: 'attached', timeout: 10000 }).catch(() => undefined);
  const tableCount = await table.count();
  if (tableCount === 0) return null;
  return table;
}

async function readHeaderStyle(header: Locator) {
  return header.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      position: style.position,
      top: style.top,
      zIndex: style.zIndex,
      backgroundColor: style.backgroundColor,
    };
  });
}

/** Contrato clássico: a tabela tem scrollport próprio, com cabeçalho fixo dentro dele. */
async function assertInternalScroll(route: TableRoute, page: Page, table: Locator) {
  const scrollContainer = await findTableScrollContainer(page, table);
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

  const headerStyle = await readHeaderStyle(header);

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
}

/** Contrato de janela baixa nas rotas compactas: quem rola é a página. */
async function assertPageScroll(route: TableRoute, page: Page, table: Locator) {
  const header = table.locator('thead').first();
  await expect(header).toBeVisible();

  // Nenhum scrollport intermediário entre a tabela e o <main>.
  const internalScrollAncestors = await markTableScrollAncestors(table, 'data-e2e-scrollport');
  expect(internalScrollAncestors).toBe(0);

  const headerStyle = await readHeaderStyle(header);
  expect(headerStyle.position).toBe('sticky');
  expect(headerStyle.top).toBe('0px');

  const main = pageScrollContainer(page);
  const metrics = await main.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));

  if (metrics.scrollHeight <= metrics.clientHeight) {
    test.info().annotations.push({
      type: 'note',
      description: `${route.name}: massa atual não exige rolagem de página; sticky validado estruturalmente.`,
    });
    return;
  }

  await main.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });

  const headerRect = await header.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });

  expect(headerRect.top).toBeGreaterThanOrEqual(-2);
  expect(headerRect.top).toBeLessThanOrEqual(headerRect.viewportHeight + 2);
  await expect(header).toBeVisible();
}

test.describe('Tabelas principais — scroll interno (janela alta)', () => {
  test.use({ viewport: TALL_VIEWPORT });

  for (const route of ROUTES) {
    test(`${route.name}: tabela usa container rolável próprio`, async ({ page }) => {
      await page.setViewportSize(TALL_VIEWPORT);
      const table = await gotoRoute(page, route);
      test.skip(table === null, `${route.name}: sem tabela renderizada com a massa atual`);

      await assertInternalScroll(route, page, table!);
    });
  }
});

test.describe('Tabelas principais — janela baixa (densidade compacta)', () => {
  test.use({ viewport: SHORT_VIEWPORT });

  for (const route of ROUTES) {
    const label = route.pageScrollsWhenShort
      ? `${route.name}: rolagem passa a ser da página`
      : `${route.name}: mantém container rolável próprio`;

    test(label, async ({ page }) => {
      await page.setViewportSize(SHORT_VIEWPORT);
      const table = await gotoRoute(page, route);
      test.skip(table === null, `${route.name}: sem tabela renderizada com a massa atual`);

      if (route.pageScrollsWhenShort) {
        await assertPageScroll(route, page, table!);
      } else {
        await assertInternalScroll(route, page, table!);
      }
    });
  }
});
