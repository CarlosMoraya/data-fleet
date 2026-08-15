import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Densidade adaptativa por altura de janela.
 *
 * A variante `tall` (@media (min-height: 901px)) restaura o espaçamento
 * confortável; abaixo disso o produto entra em modo compacto.
 * Ver "Densidade adaptativa por altura" em agent/AGENT-DESIGN.md.
 */

const VEHICLES_PATH = '/cadastros/veiculos';
const VEHICLES_SUBTITLE = 'Gerencie a frota de veículos do cliente.';

/** Abaixo do ponto de corte: densidade compacta ativa. */
const SHORT_VIEWPORT = { width: 1280, height: 720 };
/** Acima do ponto de corte: densidade confortável (comportamento histórico). */
const TALL_VIEWPORT = { width: 1280, height: 1000 };
/** Limites exatos do ponto de corte de 901px. */
const JUST_TALL_VIEWPORT = { width: 1280, height: 902 };
const JUST_SHORT_VIEWPORT = { width: 1280, height: 900 };

function mainHeading(page: Page, name: string): Locator {
  return page.locator('main').getByRole('heading', { name });
}

async function gotoVehicles(page: Page): Promise<Locator> {
  await page.goto(VEHICLES_PATH);
  await expect(mainHeading(page, 'Veículos')).toBeVisible({ timeout: 15000 });

  const rows = page.locator('main table tbody tr');
  await rows.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => undefined);
  return rows;
}

/** Quantas linhas de tbody cabem inteiramente dentro da viewport. */
async function countRowsFullyVisible(rows: Locator): Promise<number> {
  return rows.evaluateAll((nodes) =>
    nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
    }).length,
  );
}

async function firstRowHeight(rows: Locator): Promise<number> {
  return rows.first().evaluate((node) => node.getBoundingClientRect().height);
}

test.describe('Densidade adaptativa por altura', () => {
  /**
   * Alvo em 4 linhas, não 5. A linha de Veículos mede ~77px em modo compacto
   * porque a célula "Veículo" tem ícone `h-10` mais três linhas de texto —
   * a altura é dominada pelo conteúdo, não pelo padding, e reduzir a fonte
   * dos dados está vetado por acessibilidade. Antes da densidade adaptativa
   * esta tela exibia 1 linha.
   */
  test('janela baixa: ao menos 4 linhas visíveis sem rolagem', async ({ page }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    const rows = await gotoVehicles(page);

    const total = await rows.count();
    test.skip(total < 4, 'Massa atual com menos de 4 veículos; densidade não é mensurável.');

    const visible = await countRowsFullyVisible(rows);
    expect(visible).toBeGreaterThanOrEqual(4);
  });

  test('janela alta: subtítulo visível e linha mais alta que no modo compacto', async ({ page }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    const rows = await gotoVehicles(page);
    const total = await rows.count();
    test.skip(total === 0, 'Massa atual sem veículos; densidade não é mensurável.');
    const compactRowHeight = await firstRowHeight(rows);

    await page.setViewportSize(TALL_VIEWPORT);
    await expect(page.locator('main').getByText(VEHICLES_SUBTITLE)).toBeVisible();

    const comfortableRowHeight = await firstRowHeight(rows);
    expect(comfortableRowHeight).toBeGreaterThan(compactRowHeight);
  });

  test('ponto de corte: subtítulo visível em 902px e oculto em 900px', async ({ page }) => {
    await page.setViewportSize(JUST_TALL_VIEWPORT);
    await gotoVehicles(page);

    const subtitle = page.locator('main').getByText(VEHICLES_SUBTITLE);
    await expect(subtitle).toBeVisible();

    await page.setViewportSize(JUST_SHORT_VIEWPORT);
    await expect(subtitle).toBeHidden();
  });
});
