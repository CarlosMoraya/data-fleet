import { expect, test, type Page } from '@playwright/test';

const CHUNK_RELOAD_FLAG = 'chunk-reload-attempted';
const VEHICLES_CHUNK =
  /(?:\/assets\/Vehicles-[^/]+\.js|\/src\/pages\/Vehicles(?:\.tsx)?)(?:\?.*)?$/;

function trackMainFrameNavigations(page: Page) {
  let count = 0;

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && frame.url() !== 'about:blank') {
      count += 1;
    }
  });

  return () => count;
}

test.describe('Regressão pós-otimização — recuperação de chunk ausente', () => {
  test('falha de chunk dispara um único reload e recupera a rota alvo', async ({ page }) => {
    const getNavigationCount = trackMainFrameNavigations(page);
    let blockedRequests = 0;

    await page.route(VEHICLES_CHUNK, async (route) => {
      if (blockedRequests === 0) {
        blockedRequests += 1;
        await route.fulfill({
          status: 404,
          contentType: 'text/plain',
          body: 'Not Found',
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/cadastros/veiculos');

    await expect.poll(getNavigationCount, { timeout: 20000 }).toBeGreaterThan(1);
    await expect(page.locator('main').getByRole('heading', { name: 'Veículos' })).toBeVisible({ timeout: 20000 });

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.trim().length).toBeGreaterThan(0);
    expect(blockedRequests).toBe(1);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').at(-1)?.type)).toBe('reload');

    const settledNavigationCount = getNavigationCount();
    await page.waitForTimeout(1000);
    expect(getNavigationCount()).toBe(settledNavigationCount);
  });

  test('falha persistente após reload exibe fallback amigável sem loop', async ({ page }) => {
    const getNavigationCount = trackMainFrameNavigations(page);

    await page.route(VEHICLES_CHUNK, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found',
      });
    });

    await page.goto('/cadastros/veiculos');

    await expect.poll(getNavigationCount, { timeout: 20000 }).toBeGreaterThan(1);
    await expect(page.getByText('Não foi possível carregar esta parte do aplicativo. Atualize a página.')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Atualizar' })).toBeVisible();

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.trim().length).toBeGreaterThan(0);
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), CHUNK_RELOAD_FLAG)).toBe('true');
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').at(-1)?.type)).toBe('reload');

    const settledNavigationCount = getNavigationCount();
    await page.waitForTimeout(1000);
    expect(getNavigationCount()).toBe(settledNavigationCount);
  });
});
