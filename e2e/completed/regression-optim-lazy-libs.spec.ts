import { expect, test, type Page } from '@playwright/test';

const CHUNK_ERROR = /Loading chunk|Failed to fetch dynamically imported module|ChunkLoadError/;

function collectChunkErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  return {
    assertNoChunkErrors() {
      expect(pageErrors.filter((message) => CHUNK_ERROR.test(message))).toEqual([]);
      expect(consoleErrors.filter((message) => CHUNK_ERROR.test(message))).toEqual([]);
    },
  };
}

test.describe('Regressão pós-otimização — lazy loading de bibliotecas pesadas', () => {
  test('Dashboard carrega gráficos sob demanda sem erro de chunk', async ({ page }) => {
    const errors = collectChunkErrors(page);

    await page.goto('/');
    await expect(page.locator('main').getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Custos' }).click();
    await expect(page.getByText('Período de análise')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.recharts-responsive-container, svg.recharts-surface').first()).toBeVisible({ timeout: 30000 });

    errors.assertNoChunkErrors();
  });

  test('Fluxo PDF não emite erro de chunk ao carregar rota de Veículos', async ({ page }) => {
    const errors = collectChunkErrors(page);

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('main').getByRole('heading', { name: 'Veículos' })).toBeVisible({ timeout: 15000 });

    const pdfTrigger = page.getByRole('button', { name: /CRLV|PDF|Extrair/i }).first();
    if (await pdfTrigger.isVisible()) {
      await pdfTrigger.click();
      await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    } else {
      test.info().annotations.push({
        type: 'not-covered',
        description: 'Fluxo PDF não acessível para Admin sem dado específico; validada ausência de erro de chunk no carregamento da rota.',
      });
    }

    errors.assertNoChunkErrors();
  });
});
