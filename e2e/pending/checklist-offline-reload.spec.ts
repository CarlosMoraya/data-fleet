import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — CHECKLIST: RELOAD OFFLINE (Jorge — Motorista)
 *
 * Este spec deve rodar contra build/preview, não contra o dev server, porque
 * depende do service worker gerado pelo vite-plugin-pwa.
 */

test.describe.serial('Checklist — Reload Offline (Jorge)', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  test('reabre offline e permanece na etapa dos itens após confirmar hodômetro e responder item', async ({ page, context }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible().catch(() => false);
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

    const iniciarBtn = page.locator('button', { hasText: /Iniciar/i }).first();
    const btnVisible = await iniciarBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Nenhum template publicado para iniciar checklist');
      return;
    }

    await iniciarBtn.click();
    await page.waitForURL(/.*checklists\/preencher\/.*/, { timeout: 10000 }).catch(() => {});
    if (!page.url().includes('checklists/preencher/')) {
      test.skip(true, 'Não foi possível navegar para o preenchimento do checklist');
      return;
    }

    await page.waitForLoadState('networkidle');

    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    const kmInput = page.locator('input[inputMode="numeric"]').first();
    const kmVisible = await kmInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (!kmVisible) {
      test.skip(true, 'Passo hodômetro não visível — pode já estar confirmado');
      return;
    }

    await kmInput.fill('45000');
    await page.locator('button', { hasText: /Confirmar hodômetro/i }).click();
    await expect(page.locator('text=Hodômetro:')).toBeVisible({ timeout: 5000 });

    const okButtons = page.locator('button', { hasText: /^OK$/ });
    const okCount = await okButtons.count();
    if (okCount === 0) {
      test.skip(true, 'Nenhum item respondível encontrado');
      return;
    }
    await okButtons.first().click();
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Esta página não está funcionando')).toHaveCount(0);
    await expect(page.locator('text=Hodômetro:')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: /^OK$/ }).first()).toBeVisible({ timeout: 5000 });

    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    await page.waitForTimeout(3000);
  });
});
