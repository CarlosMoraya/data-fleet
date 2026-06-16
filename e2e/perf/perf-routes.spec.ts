import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUTPUT = path.resolve('docs/reports/perf/.last-routes.json');

interface RouteDesc {
  key: string;
  label: string;
  action: (page: import('@playwright/test').Page) => Promise<void>;
  url: string | RegExp;
  heading: string;
}

async function measureNavigation(
  page: import('@playwright/test').Page,
  action: () => Promise<void>,
  expectedUrl: string | RegExp,
  headingName: string,
  requestCounter: { count: number },
): Promise<{ ms: number; requestCount: number }> {
  const before = requestCounter.count;
  const t0 = Date.now();
  await action();
  await expect(page).toHaveURL(expectedUrl);
  await expect(
    page.locator('main').getByRole('heading', { name: headingName }),
  ).toBeVisible({ timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  const ms = Date.now() - t0;
  const requestCount = requestCounter.count - before;
  return { ms, requestCount };
}

test('mede performance das rotas principais', async ({ page }) => {
  const requestCounter = { count: 0 };
  page.on('request', () => {
    requestCounter.count++;
  });

  const ROUTES: RouteDesc[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      action: (p) =>
        p.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click(),
      url: '/',
      heading: 'Dashboard',
    },
    {
      key: 'veiculos',
      label: 'Veículos',
      action: async (p) => {
        await p.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
        await p.getByRole('link', { name: 'Veículos' }).click();
      },
      url: '/cadastros/veiculos',
      heading: 'Veículos',
    },
    {
      key: 'motoristas',
      label: 'Motoristas',
      action: async (p) => {
        await p.getByRole('link', { name: 'Motoristas' }).click();
      },
      url: '/cadastros/motoristas',
      heading: 'Motoristas',
    },
    {
      key: 'manutencao',
      label: 'Manutenção',
      action: (p) =>
        p.getByRole('navigation').getByRole('link', { name: 'Manutenção' }).click(),
      url: '/manutencao',
      heading: 'Manutenção',
    },
    {
      key: 'pneus',
      label: 'Pneus',
      action: async (p) => {
        await p.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
        await p.getByRole('link', { name: 'Pneus' }).click();
      },
      url: '/cadastros/pneus',
      heading: 'Gestão de Pneus',
    },
    {
      key: 'checklists',
      label: 'Checklists',
      action: (p) =>
        p.getByRole('navigation').getByRole('link', { name: 'Checklists' }).click(),
      url: '/checklists',
      heading: 'Checklists',
    },
  ];

  // Phase A — Cold Start
  requestCounter.count = 0;
  const t0 = Date.now();
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('nav').filter({ has: page.getByRole('link', { name: 'Dashboard' }) })).toBeVisible({ timeout: 30000 });
  const shellMs = Date.now() - t0;
  await expect(
    page.locator('main').getByRole('heading', { name: 'Dashboard' }),
  ).toBeVisible({ timeout: 30000 });
  const firstUsefulMs = Date.now() - t0;
  const coldRequestCount = requestCounter.count;

  const coldStart = { shellMs, firstUsefulMs, requestCount: coldRequestCount };

  // Phase B — Route entry
  const routes: {
    key: string;
    label: string;
    url: string;
    entryMs: number;
    requestCount: number;
  }[] = [];

  for (const desc of ROUTES) {
    const result = await measureNavigation(
      page,
      () => desc.action(page),
      desc.url,
      desc.heading,
      requestCounter,
    );
    routes.push({
      key: desc.key,
      label: desc.label,
      url: typeof desc.url === 'string' ? desc.url : desc.url.source,
      entryMs: result.ms,
      requestCount: result.requestCount,
    });
  }

  // Phase C — Return behavior (reference route: Veículos)
  const firstVeiculos = await measureNavigation(
    page,
    async () => {
      await page.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
      await page.getByRole('link', { name: 'Veículos' }).click();
    },
    '/cadastros/veiculos',
    'Veículos',
    requestCounter,
  );

  await page.getByRole('navigation').getByRole('link', { name: 'Manutenção' }).click();
  await expect(page).toHaveURL('/manutencao');
  await expect(
    page.locator('main').getByRole('heading', { name: 'Manutenção' }),
  ).toBeVisible({ timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

  const returnVeiculos = await measureNavigation(
    page,
    async () => {
      await page.getByRole('navigation').getByRole('link', { name: 'Cadastros' }).click();
      await page.getByRole('link', { name: 'Veículos' }).click();
    },
    '/cadastros/veiculos',
    'Veículos',
    requestCounter,
  );

  const returnBehavior = {
    route: 'veiculos',
    firstEntryMs: firstVeiculos.ms,
    firstRequestCount: firstVeiculos.requestCount,
    returnEntryMs: returnVeiculos.ms,
    returnRequestCount: returnVeiculos.requestCount,
  };

  // Write results
  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), coldStart, routes, returnBehavior },
      null,
      2,
    ),
  );
});
